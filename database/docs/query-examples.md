# Query examples

These examples use `mongosh` and assume `db` is the `gaitsense` database.

## Recent completed reports for one user

```javascript
db.assessments.find(
  { userId: ObjectId("USER_ID") },
  { overallScore: 1, dimensions: 1, classifications: 1, flags: 1, createdAt: 1 },
).sort({ createdAt: -1 }).limit(10);
```

## Session processing timeline

```javascript
db.processing_jobs.find(
  { sessionId: ObjectId("SESSION_ID") },
  { jobType: 1, status: 1, attempt: 1, error: 1, createdAt: 1, completedAt: 1 },
).sort({ createdAt: 1 });
```

## Pose chunks in playback order

```javascript
db.pose_chunks.find(
  { sessionId: ObjectId("SESSION_ID") },
).sort({ chunkIndex: 1 });
```

## Progress input (latest assessments)

```javascript
db.assessments.find(
  { userId: ObjectId("USER_ID") },
  { overallScore: 1, dimensions: 1, createdAt: 1 },
).sort({ createdAt: -1 }).limit(20);
```

## Claim one queued worker job

```javascript
db.processing_jobs.findOneAndUpdate(
  { status: "queued", availableAt: { $lte: new Date() } },
  {
    $set: {
      status: "running",
      lockedAt: new Date(),
      lockedBy: "worker-01",
      startedAt: new Date(),
      updatedAt: new Date(),
    },
    $inc: { attempt: 1 },
  },
  { sort: { availableAt: 1, createdAt: 1 }, returnDocument: "after" },
);
```

