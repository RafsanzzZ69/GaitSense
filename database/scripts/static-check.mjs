import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const databaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "docker-compose.yml",
  ".env.example",
  "mongo/bootstrap.js",
  "mongo/verify.js",
  "docs/collections.md",
  "docs/data-lifecycle.md",
];

const errors = [];
for (const relativePath of requiredFiles) {
  const absolutePath = path.join(databaseDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

for (const relativePath of ["mongo/bootstrap.js", "mongo/verify.js"]) {
  const absolutePath = path.join(databaseDir, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  try {
    new vm.Script(fs.readFileSync(absolutePath, "utf8"), { filename: relativePath });
  } catch (error) {
    errors.push(`${relativePath} is not valid JavaScript: ${error.message}`);
  }
}

const compose = fs.existsSync(path.join(databaseDir, "docker-compose.yml"))
  ? fs.readFileSync(path.join(databaseDir, "docker-compose.yml"), "utf8")
  : "";
for (const marker of ["mongo:8.0", "healthcheck:", "001-bootstrap.js", "127.0.0.1"] ) {
  if (!compose.includes(marker)) errors.push(`docker-compose.yml is missing '${marker}'`);
}

const bootstrapPath = path.join(databaseDir, "mongo/bootstrap.js");
const bootstrap = fs.existsSync(bootstrapPath)
  ? fs.readFileSync(bootstrapPath, "utf8")
  : "";
const expectedCollections = [
  "users",
  "participant_profiles",
  "consents",
  "walk_sessions",
  "media_assets",
  "pose_chunks",
  "gait_features",
  "model_versions",
  "assessments",
  "recommendation_catalog",
  "assessment_recommendations",
  "processing_jobs",
  "refresh_tokens",
  "progress_snapshots",
  "audit_events",
  "schema_migrations",
  "auth_sessions", "consent_documents", "capture_protocols", "rate_limits",
];
for (const collection of expectedCollections) {
  if (!bootstrap.includes(`  ${collection}: {`) && !bootstrap.includes(`schemas.${collection} = {`)) {
    errors.push(`bootstrap.js has no schema for '${collection}'`);
  }
}

const indexDeclarationCount = (bootstrap.match(/ensureIndex\("/g) || []).length;
if (indexDeclarationCount !== 42) {
  errors.push(`Expected 42 index declarations, found ${indexDeclarationCount}`);
}

for (const safetyMarker of [
  'validationLevel: "strict"',
  'validationAction: "error"',
  'expireAfterSeconds: 0',
  'role: "readWrite"',
  'status: "development"',
  "Schema validation did not reject",
]) {
  const source = safetyMarker.startsWith("Schema")
    ? fs.readFileSync(path.join(databaseDir, "mongo/verify.js"), "utf8")
    : bootstrap;
  if (!source.includes(safetyMarker)) errors.push(`Missing safety marker '${safetyMarker}'`);
}

if (errors.length) {
  console.error(errors.map((error) => `FAIL: ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Static checks passed (${expectedCollections.length} schemas, ${indexDeclarationCount} indexes, 2 scripts parsed).`,
);
