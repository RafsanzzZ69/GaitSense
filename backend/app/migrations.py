"""Versioned, non-destructive MongoDB schema installer and read-only verifier."""
import hashlib
import json
from pathlib import Path

from bson import json_util
from pymongo.errors import DuplicateKeyError

from app.db import utcnow

MANIFEST = Path(__file__).resolve().parents[2] / "database/schema-v2.json"


def manifest():
    return json_util.loads(MANIFEST.read_text(encoding="utf-8"))


def migrate(db):
    # Persistent lock deliberately has no automatic timeout. If a migrator dies,
    # an operator must confirm it stopped before removing this one marker.
    spec = manifest()
    if "schema_migrations" not in db.list_collection_names():
        db.create_collection("schema_migrations", **spec["collections"]["schema_migrations"])
    db.schema_migrations.create_index("version", unique=True, name="uq_schema_migration_version")
    lock = {"version": 2147483647, "name": "migration_lock", "appliedAt": utcnow()}
    try:
        db.schema_migrations.insert_one(lock)
    except DuplicateKeyError:
        raise RuntimeError("Another migration is running, or a stale migration_lock requires operator review") from None
    try:
        return _apply(db)
    finally:
        db.schema_migrations.delete_one({"_id": lock["_id"]})


def _apply(db):
    spec = manifest()
    checksum = hashlib.sha256(MANIFEST.read_bytes()).hexdigest()
    previous = db.schema_migrations.find_one({"version": spec["version"]})
    if previous and previous.get("checksum") not in (None, checksum):
        raise RuntimeError("Applied migration checksum differs; create a new version instead of editing it")
    for name, options in spec["collections"].items():
        incompatible = db[name].count_documents({"$nor": [options["validator"]]})
        if incompatible:
            raise RuntimeError(f"{name}: {incompatible} existing documents conflict with v2; migration stopped")
    # Run with the API/worker stopped. MongoDB DDL is not transactional.
    for name, options in spec["collections"].items():
        if name in db.list_collection_names():
            db.command({"collMod": name, **options})
        else:
            db.create_collection(name, **options)
    for name, index in spec["removeIndexes"]:
        if index in db[name].index_information():
            db[name].drop_index(index)
    for index in spec["indexes"]:
        db[index["collection"]].create_index(list(index["keys"].items()), **index["options"])
    for seed in spec["seeds"]:
        update = seed["update"]
        # Preserve existing seeds, user edits and creation dates.
        if "$setOnInsert" in update:
            for key in ("createdAt", "updatedAt", "appliedAt"):
                if key in update["$setOnInsert"]:
                    update["$setOnInsert"][key] = utcnow()
        db[seed["collection"]].update_one(seed["filter"], update, upsert=True)
    db.schema_migrations.update_one({"version": spec["version"]}, {"$set": {"checksum": checksum}})
    return verify(db)


def verify(db):
    spec = manifest()
    errors = []
    actual = {item["name"]: item for item in db.list_collections()}
    for name, expected in spec["collections"].items():
        options = actual.get(name, {}).get("options", {})
        if any(options.get(k) != v for k, v in expected.items()):
            errors.append(f"Validator mismatch: {name}")
    for index in spec["indexes"]:
        actual_index = db[index["collection"]].index_information().get(index["options"]["name"], {})
        if list(index["keys"].items()) != actual_index.get("key"):
            errors.append(f"Index missing or keys differ: {index['options']['name']}")
        for key, value in index["options"].items():
            if key != "name" and actual_index.get(key) != value:
                errors.append(f"Index option mismatch: {index['options']['name']}.{key}")
    if not db.schema_migrations.find_one({"version": spec["version"]}):
        errors.append("Migration version is missing")
    if errors:
        raise RuntimeError("; ".join(errors))
    return {"schemaVersion": spec["version"], "collections": len(spec["collections"]),
            "applicationIndexes": len(spec["indexes"])}


def backup(db, destination):
    """Logical development backup; stop writers first. Not a live point-in-time snapshot."""
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    for info in db.list_collections():
        name = info["name"]
        payload = {"name": name, "options": info.get("options", {}),
                   "indexes": list(db[name].list_indexes()), "documents": list(db[name].find())}
        (destination / f"{name}.json").write_text(json_util.dumps(payload), encoding="utf-8")
    (destination / "backup.json").write_text(json.dumps({"database": db.name, "createdAt": utcnow().isoformat()}))


def restore_empty(db, source):
    if db.list_collection_names():
        raise RuntimeError("Restore requires a completely empty target database")
    source = Path(source)
    if not (source / "backup.json").is_file():
        raise RuntimeError("Not a GaitSense backup")
    for path in sorted(source.glob("*.json")):
        if path.name == "backup.json":
            continue
        data = json_util.loads(path.read_text(encoding="utf-8"))
        coll = db.create_collection(data["name"], **data["options"])
        if data["documents"]:
            coll.insert_many(data["documents"])
        for idx in data["indexes"]:
            if idx["name"] != "_id_":
                coll.create_index(list(idx["key"].items()), **{
                    k: v for k, v in idx.items() if k not in ("key", "v", "ns")})
