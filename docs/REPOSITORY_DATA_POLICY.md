# Repository data and assets

Private repository visibility is not permission to upload identifiable research data. Excluded files remain on the original workstation; publication does not delete them.

- Environment credentials, keys and local VS Code connection settings are excluded; sanitized templates are included.
- Recordings, participant labels, derived tables/landmarks/reports and pickles are excluded. Access requires consent and study authorization.
- Dependencies, caches, generated native projects, APKs and the separate showcase checkout are excluded.
- Obtain the official model using frontend/scripts/prepare-pose-model.mjs --download. The script enforces its published SHA-256. No Git LFS is required for this source publication.
- Native instrumentation fixtures require separately authorized recordings at the paths specified by the scripts/tests. Never commit participant fixtures or bundle them into release assets.
- A private release may contain the verified development-signed APK, not input videos. Runtime acceptance is still pending.

GitHub collaborator access does not grant Atlas permissions. Review staged files before every commit; do not include sensitive information in issues or screenshots. A project license and data-sharing approvals remain pending.
