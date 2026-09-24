# Enabling real accounts on the public site

Status: preparation only. No Render service or private cloud-media bucket has
been provisioned. The current public URL is an explicit synthetic-data showcase.

## Required user action

Create/sign in to a Render account and approve a service budget. Create a private
S3-compatible bucket (or choose an existing one) and make its credentials available
privately. Never send passwords in chat or commit them. The operator can then do
the remaining configuration and checks.

## Prepared application wiring

Use the existing `backend/Dockerfile` with repository-root build context for two
services. The exact code, schema-v2 export and pose model must be included in the
deployment checkout; exclude `.env`, participant recordings, backups and storage.
The Docker build has not yet been validated on Render.

1. Web service command: `python -m uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000`.
   Health path: `/health/ready`. Set `PORT=8000` for explicit configuration.
2. Background worker command: `python -m app.worker`.
3. Both need the same `MONGODB_URI`, `MONGO_DATABASE`, a strong `JWT_SECRET`,
   `ENVIRONMENT=production`, `STORAGE_PROVIDER=s3`, `S3_BUCKET`, storage endpoint
   when applicable, and private AWS-compatible access credentials/region.
4. Set `CORS_ORIGINS` on the API to the exact public frontend origin as a JSON
   list: `["https://gaitsense-research-workspace.cse400projecthfn.chatgpt.site"]`.
5. Add each service's documented outbound addresses to Atlas network access;
   preserve existing access and avoid opening the database to the whole internet.
6. Verify schema v2 before starting. Do not point the cloud worker at the current
   local-media jobs: use a separate cloud database or perform an explicit,
   backed-up media migration first. Changing storage providers does not move files.
7. Test signup, save/readback, private upload, worker completion, export, account
   isolation and deletion through the hosted HTTPS API.
8. Only after those checks, export the frontend with `EXPO_PUBLIC_SHOWCASE=false`
   and `EXPO_PUBLIC_API_URL=https://THE_VERIFIED_API_HOST/api/v1`, then publish it
   to the existing Site. Never ship MongoDB or storage credentials to the frontend.

Render disks cannot be shared between an API service and a separate worker;
ordinary service files are ephemeral. Therefore the existing shared S3 storage
implementation is required for this two-service deployment. Compute plans,
memory needs and costs must be reviewed before provisioning.

Sources: [Render Docker/Blueprint configuration](https://render.com/docs/blueprint-spec),
[persistent disk limits](https://render.com/docs/disks),
[web services](https://render.com/docs/web-services).
