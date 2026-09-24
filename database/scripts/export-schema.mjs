// Run the canonical mongosh bootstrap against an inert recorder, never a database.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = { version: 2, collections: {}, indexes: [], seeds: [], removeIndexes: [
  ["media_assets", "ttl_media_expiry"], ["pose_chunks", "uq_pose_session_chunk"],
] };
const collection = (name) => ({
  createIndex: (keys, options) => manifest.indexes.push({ collection: name, keys, options }),
  getIndexes: () => [],
  updateOne: (filter, update) => manifest.seeds.push({ collection: name, filter, update }),
});
const db = new Proxy({
  getCollectionInfos: () => [],
  createCollection: (name, options) => { manifest.collections[name] = options; },
  getCollection: collection,
}, { get: (target, key) => target[key] ?? collection(key) });
class FixedDate extends Date {
  constructor() { super("2026-09-21T00:00:00Z"); }
  toJSON() { return { $date: this.toISOString() }; }
}
vm.runInNewContext(fs.readFileSync(root + "mongo/bootstrap.js", "utf8"), {
  db: { getSiblingDB: () => db }, process: { env: { SKIP_APP_USER_CREATION: "true" } },
  ObjectId: (value) => ({ $oid: value }), Date: FixedDate, print: () => {},
});
const output = JSON.stringify(manifest, null, 2) + "\n";
const target = root + "schema-v2.json";
if (process.argv.includes("--check")) {
  if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== output) {
    throw new Error("Schema manifest is stale; run node database/scripts/export-schema.mjs");
  }
} else fs.writeFileSync(target, output);
console.log(`Schema v2: ${Object.keys(manifest.collections).length} collections, ${manifest.indexes.length} indexes`);
