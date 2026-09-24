/*
 * GaitSense MongoDB bootstrap / schema version 2.
 *
 * This file is intentionally idempotent:
 * - Docker runs it automatically for a new volume.
 * - `npm run db:migrate` safely reapplies validators, indexes, and seed data.
 */

const databaseName = process.env.MONGO_DATABASE || "gaitsense";
const appUsername = process.env.MONGO_APP_USERNAME || "gaitsense_app";
const appPassword = process.env.MONGO_APP_PASSWORD || "local_app_password_change_me";
const skipAppUserCreation =
  (process.env.SKIP_APP_USER_CREATION || "false").toLowerCase() === "true";
const appDb = db.getSiblingDB(databaseName);
const now = new Date();

const numericBsonTypes = ["double", "int", "long", "decimal"];
const objectIdField = { bsonType: "objectId" };
const dateField = { bsonType: "date" };
const scoreField = { bsonType: numericBsonTypes, minimum: 0, maximum: 100 };
const nonNegativeNumber = { bsonType: numericBsonTypes, minimum: 0 };
const positiveNumber = { bsonType: numericBsonTypes, minimum: 0, exclusiveMinimum: true };

function ensureCollection(name, jsonSchema) {
  const validator = { $jsonSchema: jsonSchema };
  const exists = appDb.getCollectionInfos({ name }).length > 0;

  if (!exists) {
    appDb.createCollection(name, {
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
    print(`Created collection: ${name}`);
    return;
  }

  const result = appDb.runCommand({
    collMod: name,
    validator,
    validationLevel: "strict",
    validationAction: "error",
  });
  if (!result.ok) throw new Error(`Cannot update validator for ${name}`);
  print(`Updated validator: ${name}`);
}

function ensureIndex(collection, keys, options) {
  appDb.getCollection(collection).createIndex(keys, options);
}

const schemas = {
  users: {
    bsonType: "object",
    title: "Application user account",
    required: ["email", "emailNormalized", "role", "status", "createdAt", "updatedAt"],
    properties: {
      _id: objectIdField,
      email: { bsonType: "string", minLength: 3, maxLength: 254 },
      emailNormalized: { bsonType: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", maxLength: 254 },
      passwordHash: { bsonType: "string", minLength: 20, maxLength: 512 },
      authProviders: {
        bsonType: "array",
        uniqueItems: true,
        items: { bsonType: "string", enum: ["password", "google", "apple"] },
      },
      role: { enum: ["user", "clinician", "researcher", "admin"] },
      status: { enum: ["pending_verification", "active", "suspended", "deleted"] },
      emailVerifiedAt: { bsonType: ["date", "null"] },
      lastLoginAt: { bsonType: ["date", "null"] },
      locale: { bsonType: "string", minLength: 2, maxLength: 10 },
      timezone: { bsonType: "string", minLength: 1, maxLength: 64 },
      createdAt: dateField,
      updatedAt: dateField,
      deletedAt: { bsonType: ["date", "null"] },
    },
  },

  participant_profiles: {
    bsonType: "object",
    title: "Health and anthropometric profile kept separate from account identity",
    required: ["userId", "displayName", "createdAt", "updatedAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      displayName: { bsonType: "string", minLength: 1, maxLength: 100 },
      yearOfBirth: { bsonType: "int", minimum: 1900, maximum: 2200 },
      sexAtBirth: { enum: ["female", "male", "intersex", "prefer_not_to_say", "unknown"] },
      heightCm: { ...positiveNumber, maximum: 260 },
      weightKg: { ...positiveNumber, maximum: 500 },
      dominantSide: { enum: ["left", "right", "ambidextrous", "unknown"] },
      countryCode: { bsonType: "string", pattern: "^[A-Z]{2}$" },
      assistiveDevice: { enum: ["none", "cane", "walker", "crutches", "prosthesis", "other"] },
      selfReportedConditions: {
        bsonType: "array",
        maxItems: 30,
        items: { bsonType: "string", minLength: 1, maxLength: 100 },
      },
      fallHistoryLast12Months: { bsonType: "int", minimum: 0, maximum: 100 },
      notes: { bsonType: "string", maxLength: 2000 },
      createdAt: dateField,
      updatedAt: dateField,
    },
  },

  consents: {
    bsonType: "object",
    required: ["userId", "type", "documentVersion", "status", "recordedAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      type: { enum: ["terms", "privacy", "health_disclaimer", "data_processing", "research_data"] },
      documentVersion: { bsonType: "string", minLength: 1, maxLength: 40 },
      status: { enum: ["accepted", "declined", "withdrawn"] },
      recordedAt: dateField,
      withdrawnAt: { bsonType: ["date", "null"] },
      source: { enum: ["mobile", "web", "admin_import"] },
      ipHash: { bsonType: "string", minLength: 32, maxLength: 128 },
      userAgent: { bsonType: "string", maxLength: 500 },
    },
  },

  walk_sessions: {
    bsonType: "object",
    required: ["userId", "capturedAt", "status", "capture", "quality", "createdAt", "updatedAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      capturedAt: dateField,
      status: { enum: ["created", "uploaded", "quality_rejected", "queued", "processing", "completed", "failed", "cancelled"] },
      capture: {
        bsonType: "object",
        required: ["angle", "durationSeconds", "fps", "resolution", "device"],
        properties: {
          angle: { enum: ["front", "side_left", "side_right"] },
          durationSeconds: { ...positiveNumber, maximum: 120 },
          fps: { ...positiveNumber, maximum: 240 },
          resolution: {
            bsonType: "object",
            required: ["width", "height"],
            properties: {
              width: { bsonType: "int", minimum: 1, maximum: 16384 },
              height: { bsonType: "int", minimum: 1, maximum: 16384 },
            },
          },
          device: {
            bsonType: "object",
            properties: {
              platform: { enum: ["android", "ios", "web", "import"] },
              osVersion: { bsonType: "string", maxLength: 50 },
              model: { bsonType: "string", maxLength: 100 },
              appVersion: { bsonType: "string", maxLength: 40 },
            },
          },
        },
      },
      quality: {
        bsonType: "object",
        required: ["status", "checks"],
        properties: {
          status: { enum: ["pending", "passed", "warning", "failed"] },
          overallScore: scoreField,
          checks: {
            bsonType: "object",
            properties: {
              blur: scoreField,
              lighting: scoreField,
              bodyVisibility: scoreField,
              distance: scoreField,
              cameraStability: scoreField,
            },
          },
          messages: {
            bsonType: "array",
            items: { bsonType: "string", maxLength: 300 },
          },
        },
      },
      processingError: {
        bsonType: "object",
        properties: {
          code: { bsonType: "string", maxLength: 80 },
          message: { bsonType: "string", maxLength: 1000 },
          retryable: { bsonType: "bool" },
        },
      },
      tags: { bsonType: "array", uniqueItems: true, items: { bsonType: "string", maxLength: 50 } },
      createdAt: dateField,
      updatedAt: dateField,
      completedAt: { bsonType: ["date", "null"] },
    },
  },

  media_assets: {
    bsonType: "object",
    required: ["userId", "sessionId", "kind", "storage", "contentType", "sizeBytes", "createdAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      sessionId: objectIdField,
      kind: { enum: ["source_video", "thumbnail", "pose_overlay", "stick_figure_replay"] },
      storage: {
        bsonType: "object",
        required: ["provider", "key"],
        properties: {
          provider: { enum: ["local", "s3", "gcs", "firebase", "azure"] },
          bucket: { bsonType: "string", maxLength: 255 },
          key: { bsonType: "string", minLength: 1, maxLength: 1024 },
          region: { bsonType: "string", maxLength: 50 },
        },
      },
      contentType: { bsonType: "string", maxLength: 100 },
      sizeBytes: { bsonType: ["int", "long"], minimum: 0 },
      sha256: { bsonType: "string", pattern: "^[a-fA-F0-9]{64}$" },
      encryption: {
        bsonType: "object",
        properties: {
          enabled: { bsonType: "bool" },
          keyReference: { bsonType: "string", maxLength: 255 },
        },
      },
      createdAt: dateField,
      expiresAt: { bsonType: ["date", "null"] },
      deletedAt: { bsonType: ["date", "null"] },
    },
  },

  pose_chunks: {
    bsonType: "object",
    required: ["userId", "sessionId", "poseModel", "chunkIndex", "frameStart", "frameEnd", "frames", "createdAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      sessionId: objectIdField,
      poseModel: {
        bsonType: "object",
        required: ["name", "version", "landmarkCount"],
        properties: {
          name: { bsonType: "string", minLength: 1, maxLength: 80 },
          version: { bsonType: "string", minLength: 1, maxLength: 40 },
          landmarkCount: { bsonType: "int", minimum: 1, maximum: 200 },
        },
      },
      chunkIndex: { bsonType: "int", minimum: 0 },
      frameStart: { bsonType: "int", minimum: 0 },
      frameEnd: { bsonType: "int", minimum: 0 },
      frames: {
        bsonType: "array",
        minItems: 1,
        maxItems: 120,
        items: {
          bsonType: "object",
          required: ["frameNumber", "timestampMs", "landmarks"],
          properties: {
            frameNumber: { bsonType: "int", minimum: 0 },
            timestampMs: nonNegativeNumber,
            landmarks: {
              bsonType: "array",
              minItems: 1,
              maxItems: 200,
              items: {
                bsonType: "object",
                required: ["index", "x", "y", "z", "visibility"],
                properties: {
                  index: { bsonType: "int", minimum: 0, maximum: 199 },
                  x: { bsonType: numericBsonTypes },
                  y: { bsonType: numericBsonTypes },
                  z: { bsonType: numericBsonTypes },
                  visibility: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
                },
              },
            },
          },
        },
      },
      createdAt: dateField,
    },
  },

  gait_features: {
    bsonType: "object",
    required: ["userId", "sessionId", "extractorVersion", "metrics", "quality", "createdAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      sessionId: objectIdField,
      extractorVersion: { bsonType: "string", minLength: 1, maxLength: 50 },
      coordinateSystem: { enum: ["normalized_2d", "world_3d", "calibrated_metric"] },
      metrics: {
        bsonType: "object",
        required: ["cadenceSpm", "stepSymmetryIndex", "trunkSwayLateral", "trunkLeanForwardDeg", "headBob"],
        properties: {
          strideLengthCm: positiveNumber,
          cadenceSpm: { ...positiveNumber, maximum: 300 },
          walkingSpeedMps: { ...nonNegativeNumber, maximum: 15 },
          stepSymmetryIndex: { bsonType: numericBsonTypes, minimum: 0, maximum: 2 },
          strideVariabilityPct: { ...nonNegativeNumber, maximum: 500 },
          kneeFlexionDeg: {
            bsonType: "object",
            properties: { left: nonNegativeNumber, right: nonNegativeNumber },
          },
          hipExtensionRangeDeg: {
            bsonType: "object",
            properties: { left: nonNegativeNumber, right: nonNegativeNumber },
          },
          ankleDorsiflexionDeg: {
            bsonType: "object",
            properties: { left: nonNegativeNumber, right: nonNegativeNumber },
          },
          trunkSwayLateral: nonNegativeNumber,
          trunkLeanForwardDeg: { bsonType: numericBsonTypes, minimum: -90, maximum: 90 },
          headBob: nonNegativeNumber,
          armSwingDeg: {
            bsonType: "object",
            properties: { left: nonNegativeNumber, right: nonNegativeNumber },
          },
          armSwingSymmetryIndex: { bsonType: numericBsonTypes, minimum: 0, maximum: 2 },
          shoulderLevelDifference: nonNegativeNumber,
          hipLevelDifference: nonNegativeNumber,
          footClearance: {
            bsonType: "object",
            properties: { left: nonNegativeNumber, right: nonNegativeNumber },
          },
          contactTimeRatio: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
          swingPhaseRatio: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
          doubleSupportRatio: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
          detectedStepCount: { bsonType: "int", minimum: 0, maximum: 1000 },
        },
      },
      quality: {
        bsonType: "object",
        required: ["usableFrameRatio", "meanLandmarkVisibility"],
        properties: {
          usableFrameRatio: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
          meanLandmarkVisibility: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
          confidence: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
          warnings: { bsonType: "array", items: { bsonType: "string", maxLength: 300 } },
        },
      },
      createdAt: dateField,
    },
  },

  model_versions: {
    bsonType: "object",
    required: ["modelName", "version", "task", "algorithm", "status", "isActive", "createdAt"],
    properties: {
      _id: objectIdField,
      modelName: { bsonType: "string", minLength: 1, maxLength: 100 },
      version: { bsonType: "string", minLength: 1, maxLength: 50 },
      task: { enum: ["gait_health", "anomaly_detection", "fall_risk"] },
      algorithm: { bsonType: "string", minLength: 1, maxLength: 150 },
      featureSchemaVersion: { bsonType: "string", maxLength: 50 },
      artifactUri: { bsonType: "string", maxLength: 1024 },
      artifactSha256: { bsonType: "string", pattern: "^[a-fA-F0-9]{64}$" },
      trainingDatasetRefs: { bsonType: "array", items: { bsonType: "string", maxLength: 300 } },
      metrics: { bsonType: "object" },
      status: { enum: ["development", "validation", "approved", "retired"] },
      isActive: { bsonType: "bool" },
      createdAt: dateField,
      activatedAt: { bsonType: ["date", "null"] },
      retiredAt: { bsonType: ["date", "null"] },
    },
  },

  assessments: {
    bsonType: "object",
    required: ["userId", "sessionId", "assessmentVersion", "featureId", "modelRefs", "overallScore", "dimensions", "flags", "disclaimerVersion", "createdAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      sessionId: objectIdField,
      featureId: objectIdField,
      assessmentVersion: { bsonType: "string", minLength: 1, maxLength: 50 },
      modelRefs: {
        bsonType: "array",
        minItems: 1,
        items: {
          bsonType: "object",
          required: ["modelVersionId", "modelName", "version"],
          properties: {
            modelVersionId: objectIdField,
            modelName: { bsonType: "string" },
            version: { bsonType: "string" },
          },
        },
      },
      overallScore: scoreField,
      dimensions: {
        bsonType: "object",
        required: ["posture", "gaitSymmetry", "kneeHealth", "walkingSpeed", "balanceStability"],
        properties: {
          posture: scoreField,
          gaitSymmetry: scoreField,
          kneeHealth: scoreField,
          hipHealth: scoreField,
          ankleHealth: scoreField,
          walkingSpeed: scoreField,
          balanceStability: scoreField,
          overallFitness: scoreField,
        },
      },
      classifications: {
        bsonType: "object",
        properties: {
          fitness: { enum: ["low", "moderate", "high", "insufficient_data"] },
          posture: { enum: ["poor", "fair", "good", "insufficient_data"] },
          symmetry: { enum: ["asymmetric", "symmetric", "insufficient_data"] },
          fallRisk: { enum: ["low", "medium", "high", "not_applicable", "insufficient_data"] },
        },
      },
      flags: {
        bsonType: "array",
        items: {
          bsonType: "object",
          required: ["code", "area", "severity", "message", "confidence"],
          properties: {
            code: { bsonType: "string", maxLength: 80 },
            area: { enum: ["posture", "symmetry", "knee", "hip", "ankle", "balance", "neurological", "quality"] },
            severity: { enum: ["info", "mild", "moderate", "high"] },
            message: { bsonType: "string", maxLength: 500 },
            confidence: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
            evidenceFeatures: { bsonType: "array", items: { bsonType: "string", maxLength: 100 } },
          },
        },
      },
      fallRiskProbability: { bsonType: numericBsonTypes, minimum: 0, maximum: 1 },
      anomalyScore: { bsonType: numericBsonTypes },
      disclaimerVersion: { bsonType: "string", minLength: 1, maxLength: 40 },
      createdAt: dateField,
    },
  },

  recommendation_catalog: {
    bsonType: "object",
    required: ["slug", "title", "category", "description", "safety", "isActive", "version", "createdAt", "updatedAt"],
    properties: {
      _id: objectIdField,
      slug: { bsonType: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: 100 },
      title: { bsonType: "string", minLength: 1, maxLength: 150 },
      category: { enum: ["mobility", "strength", "balance", "posture", "clinical_followup", "retest"] },
      description: { bsonType: "string", minLength: 1, maxLength: 1500 },
      instructions: { bsonType: "array", items: { bsonType: "string", maxLength: 500 } },
      triggerCodes: { bsonType: "array", items: { bsonType: "string", maxLength: 80 } },
      safety: {
        bsonType: "object",
        required: ["requiresClinicalReview"],
        properties: {
          requiresClinicalReview: { bsonType: "bool" },
          warnings: { bsonType: "array", items: { bsonType: "string", maxLength: 500 } },
          contraindications: { bsonType: "array", items: { bsonType: "string", maxLength: 200 } },
        },
      },
      version: { bsonType: "string", maxLength: 40 },
      isActive: { bsonType: "bool" },
      createdAt: dateField,
      updatedAt: dateField,
    },
  },

  assessment_recommendations: {
    bsonType: "object",
    required: ["userId", "assessmentId", "recommendationId", "snapshot", "priority", "status", "createdAt", "updatedAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      assessmentId: objectIdField,
      recommendationId: objectIdField,
      snapshot: {
        bsonType: "object",
        required: ["title", "description", "version"],
        properties: {
          title: { bsonType: "string", maxLength: 150 },
          description: { bsonType: "string", maxLength: 1500 },
          instructions: { bsonType: "array", items: { bsonType: "string", maxLength: 500 } },
          version: { bsonType: "string", maxLength: 40 },
        },
      },
      reasonCodes: { bsonType: "array", items: { bsonType: "string", maxLength: 80 } },
      priority: { bsonType: "int", minimum: 1, maximum: 10 },
      status: { enum: ["suggested", "started", "completed", "dismissed"] },
      createdAt: dateField,
      updatedAt: dateField,
    },
  },

  processing_jobs: {
    bsonType: "object",
    required: ["sessionId", "userId", "jobType", "status", "attempt", "maxAttempts", "availableAt", "createdAt", "updatedAt"],
    properties: {
      _id: objectIdField,
      sessionId: objectIdField,
      userId: objectIdField,
      jobType: { enum: ["quality_check", "pose_estimation", "feature_extraction", "assessment", "report_generation", "cleanup"] },
      status: { enum: ["queued", "running", "succeeded", "failed", "dead_letter", "cancelled"] },
      attempt: { bsonType: "int", minimum: 0, maximum: 100 },
      maxAttempts: { bsonType: "int", minimum: 1, maximum: 100 },
      availableAt: dateField,
      lockedAt: { bsonType: ["date", "null"] },
      lockedBy: { bsonType: "string", maxLength: 200 },
      startedAt: { bsonType: ["date", "null"] },
      completedAt: { bsonType: ["date", "null"] },
      error: {
        bsonType: "object",
        properties: {
          code: { bsonType: "string", maxLength: 80 },
          message: { bsonType: "string", maxLength: 2000 },
          stack: { bsonType: "string", maxLength: 10000 },
        },
      },
      createdAt: dateField,
      updatedAt: dateField,
    },
  },

  refresh_tokens: {
    bsonType: "object",
    required: ["userId", "tokenHash", "deviceId", "createdAt", "expiresAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      tokenHash: { bsonType: "string", minLength: 32, maxLength: 256 },
      deviceId: { bsonType: "string", minLength: 1, maxLength: 200 },
      createdAt: dateField,
      expiresAt: dateField,
      revokedAt: { bsonType: ["date", "null"] },
      replacedByTokenId: { bsonType: ["objectId", "null"] },
    },
  },

  progress_snapshots: {
    bsonType: "object",
    required: ["userId", "currentAssessmentId", "baselineAssessmentId", "window", "changes", "computedAt"],
    properties: {
      _id: objectIdField,
      userId: objectIdField,
      currentAssessmentId: objectIdField,
      baselineAssessmentId: objectIdField,
      window: { enum: ["previous_walk", "14_days", "30_days", "90_days", "all_time"] },
      changes: {
        bsonType: "object",
        properties: {
          overallScoreDelta: { bsonType: numericBsonTypes },
          postureDelta: { bsonType: numericBsonTypes },
          symmetryDelta: { bsonType: numericBsonTypes },
          walkingSpeedDelta: { bsonType: numericBsonTypes },
          balanceDelta: { bsonType: numericBsonTypes },
          zScores: { bsonType: "object" },
        },
      },
      trend: { enum: ["improving", "stable", "declining", "insufficient_data"] },
      computedAt: dateField,
    },
  },

  audit_events: {
    bsonType: "object",
    required: ["eventType", "actor", "resource", "occurredAt"],
    properties: {
      _id: objectIdField,
      eventType: { bsonType: "string", minLength: 1, maxLength: 120 },
      actor: {
        bsonType: "object",
        required: ["type"],
        properties: {
          type: { enum: ["user", "service", "admin", "system"] },
          id: { bsonType: ["objectId", "string", "null"] },
        },
      },
      resource: {
        bsonType: "object",
        required: ["type", "id"],
        properties: {
          type: { bsonType: "string", maxLength: 100 },
          id: { bsonType: ["objectId", "string"] },
        },
      },
      metadata: { bsonType: "object" },
      occurredAt: dateField,
      expiresAt: { bsonType: ["date", "null"] },
    },
  },

  schema_migrations: {
    bsonType: "object",
    required: ["version", "name", "appliedAt"],
    properties: {
      _id: objectIdField,
      version: { bsonType: "int", minimum: 1 },
      name: { bsonType: "string", minLength: 1, maxLength: 200 },
      checksum: { bsonType: "string", maxLength: 128 },
      appliedAt: dateField,
    },
  },
};

// Version 2: measurement-first backend. Missing measurements are not zero scores.
schemas.walk_sessions.required = ["userId", "status", "capture", "quality", "createdAt", "updatedAt"];
schemas.walk_sessions.properties.capture.required = ["angle", "device"];
schemas.walk_sessions.properties.status.enum.push("uploading", "deleting");
Object.assign(schemas.walk_sessions.properties, {
  protocolVersion: { bsonType: "string" },
  idempotencyKey: { bsonType: "string", minLength: 1, maxLength: 100 },
  activeRunId: objectIdField, assessmentId: objectIdField, uploadExpiresAt: dateField,
});
delete schemas.gait_features.properties.metrics.required;
schemas.gait_features.properties.coordinateSystem.enum.push("pixel_2d");
Object.assign(schemas.gait_features.properties, {
  runId: objectIdField, pipelineVersion: { bsonType: "string" },
  unavailable: { bsonType: "object" }, definitions: { bsonType: "object" },
});
schemas.assessments.required = schemas.assessments.required.filter(
  (key) => !["overallScore", "dimensions"].includes(key),
);
schemas.assessments.properties.modelRefs.minItems = 0;
delete schemas.assessments.properties.dimensions.required;
Object.assign(schemas.assessments.properties, {
  kind: { enum: ["measurement_report", "validated_assessment"] },
  runId: objectIdField, pipelineVersion: { bsonType: "string" },
  protocolVersion: { bsonType: "string" },
  angle: { enum: ["front", "side_left", "side_right"] },
  limitations: { bsonType: "array", items: { bsonType: "string" } },
});
schemas.pose_chunks.properties.runId = objectIdField;
schemas.processing_jobs.properties.jobType.enum.push("pipeline");
Object.assign(schemas.processing_jobs.properties, {
  pipelineVersion: { bsonType: "string" }, runId: objectIdField, leaseUntil: dateField,
});
schemas.refresh_tokens.properties.authSessionId = objectIdField;
schemas.auth_sessions = {
  bsonType: "object", required: ["userId", "deviceId", "createdAt", "expiresAt"],
  properties: { _id: objectIdField, userId: objectIdField, deviceId: { bsonType: "string" },
    createdAt: dateField, expiresAt: dateField, revokedAt: dateField },
};
schemas.consent_documents = {
  bsonType: "object", required: ["type", "version", "text", "isActive", "createdAt"],
  properties: { _id: objectIdField, type: schemas.consents.properties.type,
    version: { bsonType: "string" }, text: { bsonType: "string" },
    isActive: { bsonType: "bool" }, createdAt: dateField },
};
schemas.capture_protocols = {
  bsonType: "object", required: ["version", "name", "instructions", "createdAt"],
  properties: { _id: objectIdField, version: { bsonType: "string" }, name: { bsonType: "string" },
    instructions: { bsonType: "array", items: { bsonType: "string" } }, createdAt: dateField },
};
schemas.rate_limits = {
  bsonType: "object", required: ["_id", "count", "expiresAt"],
  properties: { _id: { bsonType: "string" }, count: { bsonType: "int", minimum: 1 }, expiresAt: dateField },
};

for (const [name, schema] of Object.entries(schemas)) {
  ensureCollection(name, schema);
}

// Account, ownership, and consent access paths.
ensureIndex("users", { emailNormalized: 1 }, { name: "uq_users_email_normalized", unique: true });
ensureIndex("users", { status: 1, createdAt: -1 }, { name: "ix_users_status_created" });
ensureIndex("participant_profiles", { userId: 1 }, { name: "uq_profiles_user", unique: true });
ensureIndex("consents", { userId: 1, type: 1, documentVersion: 1 }, { name: "uq_consents_user_type_version", unique: true });
ensureIndex("consents", { userId: 1, recordedAt: -1 }, { name: "ix_consents_user_recorded" });

// Main gait processing and history access paths.
ensureIndex("walk_sessions", { userId: 1, capturedAt: -1 }, { name: "ix_walk_sessions_user_captured" });
ensureIndex("walk_sessions", { status: 1, createdAt: 1 }, { name: "ix_walk_sessions_status_created" });
ensureIndex("media_assets", { sessionId: 1, kind: 1 }, { name: "ix_media_session_kind" });
ensureIndex("media_assets", { userId: 1, createdAt: -1 }, { name: "ix_media_user_created" });
// Superseded indexes only; never remove collections or documents.
for (const [collection, index] of [["media_assets", "ttl_media_expiry"], ["pose_chunks", "uq_pose_session_chunk"]]) {
  if (appDb.getCollection(collection).getIndexes().some((item) => item.name === index)) {
    appDb.getCollection(collection).dropIndex(index);
  }
}
ensureIndex("media_assets", { expiresAt: 1 }, { name: "ix_media_expiry_cleanup" });
ensureIndex("pose_chunks", { sessionId: 1, runId: 1, chunkIndex: 1 }, { name: "uq_pose_session_run_chunk", unique: true });
ensureIndex("pose_chunks", { userId: 1, createdAt: -1 }, { name: "ix_pose_user_created" });
ensureIndex("gait_features", { sessionId: 1, extractorVersion: 1 }, { name: "uq_features_session_extractor", unique: true });
ensureIndex("gait_features", { userId: 1, createdAt: -1 }, { name: "ix_features_user_created" });

// Model reproducibility, report history, and recommendations.
ensureIndex("model_versions", { modelName: 1, version: 1 }, { name: "uq_models_name_version", unique: true });
ensureIndex("model_versions", { modelName: 1, isActive: 1 }, {
  name: "uq_models_one_active",
  unique: true,
  partialFilterExpression: { isActive: true },
});
ensureIndex("assessments", { sessionId: 1, assessmentVersion: 1 }, { name: "uq_assessment_session_version", unique: true });
ensureIndex("assessments", { userId: 1, createdAt: -1 }, { name: "ix_assessments_user_created" });
ensureIndex("assessments", { "classifications.fallRisk": 1, createdAt: -1 }, { name: "ix_assessments_fall_risk" });
ensureIndex("recommendation_catalog", { slug: 1 }, { name: "uq_recommendations_slug", unique: true });
ensureIndex("recommendation_catalog", { category: 1, isActive: 1 }, { name: "ix_recommendations_category_active" });
ensureIndex("assessment_recommendations", { assessmentId: 1, recommendationId: 1 }, { name: "uq_assessment_recommendation", unique: true });
ensureIndex("assessment_recommendations", { userId: 1, status: 1, createdAt: -1 }, { name: "ix_user_recommendation_status" });
ensureIndex("progress_snapshots", { userId: 1, computedAt: -1 }, { name: "ix_progress_user_computed" });
ensureIndex("progress_snapshots", { currentAssessmentId: 1, window: 1 }, { name: "uq_progress_assessment_window", unique: true });

// Worker queue, auth expiry, and audit retention.
ensureIndex("processing_jobs", { status: 1, availableAt: 1, createdAt: 1 }, { name: "ix_jobs_claim" });
ensureIndex("processing_jobs", { sessionId: 1, jobType: 1, createdAt: -1 }, { name: "ix_jobs_session_type" });
ensureIndex("refresh_tokens", { tokenHash: 1 }, { name: "uq_refresh_token_hash", unique: true });
ensureIndex("refresh_tokens", { userId: 1, deviceId: 1 }, { name: "ix_refresh_user_device" });
ensureIndex("refresh_tokens", { expiresAt: 1 }, { name: "ttl_refresh_expiry", expireAfterSeconds: 0 });
ensureIndex("audit_events", { "actor.id": 1, occurredAt: -1 }, { name: "ix_audit_actor_time" });
ensureIndex("audit_events", { "resource.type": 1, "resource.id": 1, occurredAt: -1 }, { name: "ix_audit_resource_time" });
ensureIndex("audit_events", { expiresAt: 1 }, { name: "ttl_audit_expiry", expireAfterSeconds: 0 });
ensureIndex("schema_migrations", { version: 1 }, { name: "uq_schema_migration_version", unique: true });
ensureIndex("walk_sessions", { userId: 1, idempotencyKey: 1 }, { name: "uq_session_request", unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
ensureIndex("processing_jobs", { sessionId: 1, pipelineVersion: 1 }, { name: "uq_pipeline_job", unique: true, partialFilterExpression: { jobType: "pipeline" } });
ensureIndex("processing_jobs", { status: 1, leaseUntil: 1 }, { name: "ix_jobs_lease" });
ensureIndex("auth_sessions", { userId: 1 }, { name: "ix_auth_user" });
ensureIndex("auth_sessions", { expiresAt: 1 }, { name: "ttl_auth_expiry", expireAfterSeconds: 0 });
ensureIndex("consent_documents", { type: 1, version: 1 }, { name: "uq_consent_document", unique: true });
ensureIndex("capture_protocols", { version: 1 }, { name: "uq_capture_protocol", unique: true });
ensureIndex("rate_limits", { expiresAt: 1 }, { name: "ttl_rate_limit_expiry", expireAfterSeconds: 0 });

// Self-managed MongoDB can create the application user here. Atlas manages database
// users through Atlas UI/API, so cloud deployments set SKIP_APP_USER_CREATION=true.
if (!skipAppUserCreation && !appDb.getUser(appUsername)) {
  appDb.createUser({
    user: appUsername,
    pwd: appPassword,
    roles: [{ role: "readWrite", db: databaseName }],
  });
  print(`Created application database user: ${appUsername}`);
} else if (skipAppUserCreation) {
  print("Skipped application-user creation (Atlas-managed users enabled).");
}

const modelSeeds = [
  {
    _id: ObjectId("66a000000000000000000001"),
    modelName: "gait-health-ensemble",
    version: "0.1.0-dev",
    task: "gait_health",
    algorithm: "Random Forest + XGBoost ensemble",
    featureSchemaVersion: "1.0.0",
    trainingDatasetRefs: ["PhysioNet Gait in Parkinson's Disease", "CASIA Gait Database"],
    metrics: {},
    status: "development",
    isActive: false,
    createdAt: now,
    activatedAt: null,
    retiredAt: null,
  },
  {
    _id: ObjectId("66a000000000000000000002"),
    modelName: "gait-anomaly-detector",
    version: "0.1.0-dev",
    task: "anomaly_detection",
    algorithm: "Isolation Forest",
    featureSchemaVersion: "1.0.0",
    trainingDatasetRefs: ["Healthy baseline - pending validation"],
    metrics: {},
    status: "development",
    isActive: false,
    createdAt: now,
    activatedAt: null,
    retiredAt: null,
  },
  {
    _id: ObjectId("66a000000000000000000003"),
    modelName: "fall-risk-scorer",
    version: "0.1.0-dev",
    task: "fall_risk",
    algorithm: "Logistic Regression",
    featureSchemaVersion: "1.0.0",
    trainingDatasetRefs: ["PhysioNet - final fall-risk cohort to be selected"],
    metrics: {},
    status: "development",
    isActive: false,
    createdAt: now,
    activatedAt: null,
    retiredAt: null,
  },
];

for (const model of modelSeeds) {
  appDb.model_versions.updateOne(
    { modelName: model.modelName, version: model.version },
    { $setOnInsert: model },
    { upsert: true },
  );
}

const recommendationSeeds = [
  {
    _id: ObjectId("66b000000000000000000001"),
    slug: "gentle-hip-flexor-stretch",
    title: "Gentle hip flexor stretch",
    category: "mobility",
    description: "A gentle mobility exercise that may support comfortable hip extension and stride mechanics.",
    instructions: ["Use a stable support.", "Move into a mild stretch without pain.", "Stop if symptoms worsen."],
    triggerCodes: ["REDUCED_HIP_EXTENSION", "STRIDE_ASYMMETRY_MILD"],
    safety: {
      requiresClinicalReview: false,
      warnings: ["Do not continue through pain, dizziness, or loss of balance."],
      contraindications: ["Recent hip surgery unless cleared by a clinician"],
    },
    version: "1.0.0",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ObjectId("66b000000000000000000002"),
    slug: "supported-core-stability",
    title: "Supported core stability practice",
    category: "posture",
    description: "Low-intensity trunk control practice intended to support steadier posture during walking.",
    instructions: ["Practice beside a stable surface.", "Keep breathing normally.", "Use small controlled movements."],
    triggerCodes: ["TRUNK_SWAY_ELEVATED", "FORWARD_LEAN_MILD"],
    safety: {
      requiresClinicalReview: false,
      warnings: ["Stop if you feel pain, numbness, weakness, or dizziness."],
      contraindications: [],
    },
    version: "1.0.0",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ObjectId("66b000000000000000000003"),
    slug: "professional-gait-review",
    title: "Arrange a professional gait review",
    category: "clinical_followup",
    description: "Discuss this screening result with a qualified clinician or physiotherapist, especially if the change is new or worsening.",
    instructions: ["Save the report.", "Note when symptoms began.", "Seek urgent care for sudden severe neurological symptoms."],
    triggerCodes: ["FALL_RISK_HIGH", "NEUROLOGICAL_PATTERN", "ASYMMETRY_HIGH"],
    safety: {
      requiresClinicalReview: true,
      warnings: ["This application cannot diagnose a disease or replace an examination."],
      contraindications: [],
    },
    version: "1.0.0",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: ObjectId("66b000000000000000000004"),
    slug: "retest-in-two-weeks",
    title: "Repeat the gait check in two weeks",
    category: "retest",
    description: "Record another walk under similar camera, footwear, and surface conditions so results are comparable.",
    instructions: ["Use the same camera angle.", "Use similar lighting and walking surface.", "Do not retest when unusually fatigued or unwell."],
    triggerCodes: ["MONITOR_CHANGE"],
    safety: { requiresClinicalReview: false, warnings: [], contraindications: [] },
    version: "1.0.0",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];

for (const recommendation of recommendationSeeds) {
  const { _id, createdAt, ...recommendationFields } = recommendation;
  appDb.recommendation_catalog.updateOne(
    { slug: recommendation.slug },
    { $setOnInsert: { ...recommendationFields, _id, createdAt } },
    { upsert: true },
  );
}

appDb.schema_migrations.updateOne(
  { version: 1 },
  {
    $setOnInsert: {
      version: 1,
      name: "initial_gaitsense_schema",
      checksum: "gaitsense-schema-v1",
      appliedAt: now,
    },
  },
  { upsert: true },
);

print(`GaitSense database '${databaseName}' is ready.`);

for (const [type, text] of Object.entries({
  terms: "Development prototype for adult research participants. Use is voluntary; not for emergencies.",
  privacy: "Videos and measurements are private to your account and project operators. Source videos expire after the configured retention period. You can request deletion and export. Do not upload another person's video without their permission.",
  health_disclaimer: "Experimental video measurements only. No diagnosis, health score, fall-risk prediction or treatment advice. Results can be inaccurate.",
  data_processing: "I agree to storage and automated processing of my walking video and derived landmarks for my requested report. Withdrawal blocks new processing; deletion is a separate action.",
  research_data: "Optional research sharing is not implemented. Do not treat this consent as permission to share identifiable videos.",
})) {
  appDb.consent_documents.updateOne({ type, version: "0.2.0" }, {
    $setOnInsert: { type, version: "0.2.0", text, isActive: true, createdAt: now },
  }, { upsert: true });
}
appDb.capture_protocols.updateOne({ version: "0.2.0" }, { $setOnInsert: {
  version: "0.2.0", name: "Experimental single-person walking video", createdAt: now,
  instructions: ["Use a stationary camera in good light.", "Include the entire body and only one person.", "Walk naturally on a clear level path; do not take risks for a recording.", "Select the actual front or side view. Aim for 10-15 seconds; research imports may be 2-60 seconds.", "No metric distance or speed without independent calibration. Use the same protocol for comparisons."],
}}, { upsert: true });
appDb.schema_migrations.updateOne({ version: 2 }, { $setOnInsert: {
  version: 2, name: "measurement_backend", appliedAt: now,
}}, { upsert: true });
