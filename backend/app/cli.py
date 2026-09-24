"""Deployment commands; credentials are read from .env, never printed or passed as CLI arguments."""
import argparse
from pathlib import Path

from app.config import Settings
from app.db import connect, utcnow
from app.migrations import backup, migrate, restore_empty, verify


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["check", "migrate", "backup", "restore"])
    parser.add_argument("--path", type=Path, help="Backup destination or restore source")
    parser.add_argument("--confirm-database", help="Must exactly match the configured database for writes")
    args = parser.parse_args()
    settings = Settings()
    if args.command in ("migrate", "restore") and args.confirm_database != settings.mongo_database:
        parser.error("Pass --confirm-database with the exact configured database name")
    client = connect(settings)
    db = client[settings.mongo_database]
    try:
        if args.command == "check":
            print(verify(db))
        elif args.command == "migrate":
            if db.list_collection_names():
                target = args.path or Path(__file__).resolve().parents[2] / "database/backups" / utcnow().strftime("%Y%m%dT%H%M%S%f")
                backup(db, target)
                print(f"Pre-migration backup: {target}")
            print(migrate(db))
        elif args.command == "backup":
            if not args.path:
                parser.error("backup requires --path")
            backup(db, args.path)
            print("Backup completed. Store it securely; it contains private data.")
        else:
            if not args.path:
                parser.error("restore requires --path")
            restore_empty(db, args.path)
            print("Restore completed into the empty target database.")
    finally:
        client.close()


if __name__ == "__main__":
    main()
