/* Runtime verification; execute with `npm run db:verify` after the container is healthy. */

const databaseName = process.env.MONGO_DATABASE || "gaitsense";
const appDb = db.getSiblingDB(databaseName);

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

const expectedIndexes = {
  users: ["uq_users_email_normalized", "ix_users_status_created"],
  participant_profiles: ["uq_profiles_user"],
  consents: ["uq_consents_user_type_version", "ix_consents_user_recorded"],
  walk_sessions: ["ix_walk_sessions_user_captured", "ix_walk_sessions_status_created"],
  media_assets: ["ix_media_session_kind", "ix_media_user_created", "ix_media_expiry_cleanup"],
  pose_chunks: ["uq_pose_session_run_chunk", "ix_pose_user_created"],
  gait_features: ["uq_features_session_extractor", "ix_features_user_created"],
  model_versions: ["uq_models_name_version", "uq_models_one_active"],
  assessments: ["uq_assessment_session_version", "ix_assessments_user_created", "ix_assessments_fall_risk"],
  recommendation_catalog: ["uq_recommendations_slug", "ix_recommendations_category_active"],
  assessment_recommendations: ["uq_assessment_recommendation", "ix_user_recommendation_status"],
  processing_jobs: ["ix_jobs_claim", "ix_jobs_session_type"],
  refresh_tokens: ["uq_refresh_token_hash", "ix_refresh_user_device", "ttl_refresh_expiry"],
  progress_snapshots: ["ix_progress_user_computed", "uq_progress_assessment_window"],
  audit_events: ["ix_audit_actor_time", "ix_audit_resource_time", "ttl_audit_expiry"],
  schema_migrations: ["uq_schema_migration_version"],
  auth_sessions: ["ix_auth_user", "ttl_auth_expiry"],
  consent_documents: ["uq_consent_document"],
  capture_protocols: ["uq_capture_protocol"],
  rate_limits: ["ttl_rate_limit_expiry"],
};

const failures = [];
const names = new Set(appDb.getCollectionNames());

for (const collectionName of expectedCollections) {
  if (!names.has(collectionName)) {
    failures.push(`Missing collection: ${collectionName}`);
    continue;
  }

  const validation = appDb.runCommand({ validate: collectionName });
  if (!validation.ok || validation.valid === false) {
    failures.push(`Collection validation failed: ${collectionName}`);
  }

  const actualIndexNames = new Set(
    appDb.getCollection(collectionName).getIndexes().map((index) => index.name),
  );
  for (const indexName of expectedIndexes[collectionName] || []) {
    if (!actualIndexNames.has(indexName)) {
      failures.push(`Missing index: ${collectionName}.${indexName}`);
    }
  }
}

const usersInfo = appDb.getCollectionInfos({ name: "users" })[0];
if (!usersInfo?.options?.validator?.$jsonSchema) {
  failures.push("users collection has no JSON Schema validator");
}

let invalidDocumentWasRejected = false;
try {
  appDb.users.insertOne({ email: "invalid-document" });
} catch (error) {
  invalidDocumentWasRejected = error.code === 121 || /validation/i.test(error.message);
}
if (!invalidDocumentWasRejected) {
  appDb.users.deleteMany({ email: "invalid-document" });
  failures.push("Schema validation did not reject an invalid users document");
}

// Exercise a complete synthetic record chain, then remove it. This validates that the
// documented minimal shapes really pass the server-side validators.
const testNow = new Date();
const ids = {
  user: new ObjectId(),
  profile: new ObjectId(),
  consent: new ObjectId(),
  session: new ObjectId(),
  media: new ObjectId(),
  pose: new ObjectId(),
  feature: new ObjectId(),
  assessment: new ObjectId(),
  assignedRecommendation: new ObjectId(),
  job: new ObjectId(),
  token: new ObjectId(),
  progress: new ObjectId(),
  audit: new ObjectId(),
};

const testDocuments = [
  ["users", {
    _id: ids.user,
    email: `verify-${ids.user}@example.invalid`,
    emailNormalized: `verify-${ids.user}@example.invalid`,
    authProviders: ["password"],
    role: "user",
    status: "active",
    createdAt: testNow,
    updatedAt: testNow,
  }],
  ["participant_profiles", {
    _id: ids.profile,
    userId: ids.user,
    displayName: "Database verifier",
    createdAt: testNow,
    updatedAt: testNow,
  }],
  ["consents", {
    _id: ids.consent,
    userId: ids.user,
    type: "data_processing",
    documentVersion: `verify-${ids.user}`,
    status: "accepted",
    recordedAt: testNow,
    source: "admin_import",
  }],
  ["walk_sessions", {
    _id: ids.session,
    userId: ids.user,
    capturedAt: testNow,
    status: "processing",
    capture: {
      angle: "side_left",
      durationSeconds: 12,
      fps: 30,
      resolution: { width: 1280, height: 720 },
      device: { platform: "import", appVersion: "verify" },
    },
    quality: { status: "passed", overallScore: 90, checks: { blur: 90 } },
    createdAt: testNow,
    updatedAt: testNow,
  }],
  ["media_assets", {
    _id: ids.media,
    userId: ids.user,
    sessionId: ids.session,
    kind: "source_video",
    storage: { provider: "local", key: `verify/${ids.session}.mp4` },
    contentType: "video/mp4",
    sizeBytes: NumberLong("1024"),
    createdAt: testNow,
  }],
  ["pose_chunks", {
    _id: ids.pose,
    userId: ids.user,
    sessionId: ids.session,
    poseModel: { name: "MediaPipe Pose", version: "verify", landmarkCount: 33 },
    chunkIndex: 0,
    frameStart: 0,
    frameEnd: 0,
    frames: [{
      frameNumber: 0,
      timestampMs: 0,
      landmarks: [{ index: 0, x: 0.5, y: 0.5, z: 0, visibility: 1 }],
    }],
    createdAt: testNow,
  }],
  ["gait_features", {
    _id: ids.feature,
    userId: ids.user,
    sessionId: ids.session,
    extractorVersion: "verify",
    coordinateSystem: "normalized_2d",
    metrics: {
      cadenceSpm: 100,
      stepSymmetryIndex: 1,
      trunkSwayLateral: 0.02,
      trunkLeanForwardDeg: 2,
      headBob: 0.01,
    },
    quality: { usableFrameRatio: 1, meanLandmarkVisibility: 1, confidence: 1 },
    createdAt: testNow,
  }],
  ["assessments", {
    _id: ids.assessment,
    userId: ids.user,
    sessionId: ids.session,
    featureId: ids.feature,
    assessmentVersion: "verify",
    modelRefs: [{
      modelVersionId: ObjectId("66a000000000000000000001"),
      modelName: "gait-health-ensemble",
      version: "0.1.0-dev",
    }],
    overallScore: 75,
    dimensions: {
      posture: 75,
      gaitSymmetry: 75,
      kneeHealth: 75,
      walkingSpeed: 75,
      balanceStability: 75,
    },
    classifications: {
      fitness: "moderate",
      posture: "fair",
      symmetry: "symmetric",
      fallRisk: "not_applicable",
    },
    flags: [],
    disclaimerVersion: "verify",
    createdAt: testNow,
  }],
  ["assessment_recommendations", {
    _id: ids.assignedRecommendation,
    userId: ids.user,
    assessmentId: ids.assessment,
    recommendationId: ObjectId("66b000000000000000000004"),
    snapshot: {
      title: "Repeat the gait check in two weeks",
      description: "Verification snapshot",
      version: "1.0.0",
    },
    reasonCodes: ["MONITOR_CHANGE"],
    priority: 5,
    status: "suggested",
    createdAt: testNow,
    updatedAt: testNow,
  }],
  ["processing_jobs", {
    _id: ids.job,
    sessionId: ids.session,
    userId: ids.user,
    jobType: "feature_extraction",
    status: "queued",
    attempt: 0,
    maxAttempts: 3,
    availableAt: testNow,
    createdAt: testNow,
    updatedAt: testNow,
  }],
  ["refresh_tokens", {
    _id: ids.token,
    userId: ids.user,
    tokenHash: `verification-token-hash-${ids.token}`,
    deviceId: "database-verifier",
    createdAt: testNow,
    expiresAt: new Date(testNow.getTime() + 3600000),
  }],
  ["progress_snapshots", {
    _id: ids.progress,
    userId: ids.user,
    currentAssessmentId: ids.assessment,
    baselineAssessmentId: ids.assessment,
    window: "previous_walk",
    changes: { overallScoreDelta: 0 },
    trend: "stable",
    computedAt: testNow,
  }],
  ["audit_events", {
    _id: ids.audit,
    eventType: "database.verification",
    actor: { type: "system", id: "database-verifier" },
    resource: { type: "walk_session", id: ids.session },
    metadata: { synthetic: true },
    occurredAt: testNow,
  }],
];

for (const [collectionName, document] of testDocuments) {
  try {
    appDb.getCollection(collectionName).insertOne(document);
  } catch (error) {
    failures.push(`Valid-document check failed for ${collectionName}: ${error.message}`);
  }
}
for (const [collectionName, document] of [...testDocuments].reverse()) {
  appDb.getCollection(collectionName).deleteOne({ _id: document._id });
}

if (appDb.model_versions.countDocuments({ status: "development" }) < 3) {
  failures.push("Expected three development model records");
}
if (appDb.recommendation_catalog.countDocuments({ isActive: true }) < 4) {
  failures.push("Expected four active recommendation seeds");
}
if (!appDb.schema_migrations.findOne({ version: 2 })) {
  failures.push("Schema migration 002 was not recorded");
}

if (failures.length > 0) {
  print("GaitSense database verification FAILED:");
  failures.forEach((failure) => print(` - ${failure}`));
  quit(1);
}

print(
  `GaitSense database verification passed: ${expectedCollections.length} collections, validators, indexes, seeds, and ${testDocuments.length} valid insert paths are ready.`,
);
