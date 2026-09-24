import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const databaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const action = process.argv[2];

const commands = {
  up: ["up", "-d", "--wait"],
  down: ["down"],
  status: ["ps"],
  logs: ["logs", "--tail", "100", "-f", "mongodb"],
};

function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: databaseDir,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error?.code === "ENOENT") {
    console.error(
      `Could not find '${program}'. Install Docker Desktop and enable Docker Compose v2.`,
    );
    process.exit(127);
  }

  process.exitCode = result.status ?? 1;
}

function runMongoScript(scriptName) {
  const command = [
    "mongosh --quiet --host localhost",
    '--username "$MONGO_INITDB_ROOT_USERNAME"',
    '--password "$MONGO_INITDB_ROOT_PASSWORD"',
    "--authenticationDatabase admin",
    `/workspace/mongo/${scriptName}`,
  ].join(" ");

  run("docker", ["compose", "exec", "-T", "mongodb", "sh", "-lc", command]);
}

switch (action) {
  case "up":
  case "down":
  case "status":
  case "logs":
    run("docker", ["compose", ...commands[action]]);
    break;
  case "migrate":
    runMongoScript("bootstrap.js");
    break;
  case "verify":
    runMongoScript("verify.js");
    break;
  case "reset":
    if (process.env.CONFIRM_DATABASE_RESET !== "yes") {
      console.error(
        "Reset deletes the local MongoDB volume. Re-run with CONFIRM_DATABASE_RESET=yes.",
      );
      process.exitCode = 2;
      break;
    }
    run("docker", ["compose", "down", "--volumes"]);
    break;
  default:
    console.error(
      "Usage: node scripts/db-cli.mjs <up|down|status|logs|migrate|verify|reset>",
    );
    process.exitCode = 2;
}

