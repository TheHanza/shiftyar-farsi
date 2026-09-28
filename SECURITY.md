# Security Policy

ShiftYar handles working hours and salary information, so we take security reports seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through
[GitHub Security Advisories](https://github.com/Bazi-Digital/shift-app/security/advisories/new).
Include steps to reproduce and the affected version (the `version` field from `/api/health`).

We aim to acknowledge reports within 3 working days and to fix confirmed issues promptly.

## Supported versions

Only the latest release on `main` receives security fixes.

## Hardening checklist for self-hosters

- Set a long random `JWT_SECRET`. `deploy/deploy.sh` generates one for you.
- Change the bootstrap admin password after the first login.
- Serve over HTTPS only (`deploy/deploy.sh setup`).
- Keep the app port bound to loopback behind a reverse proxy. The production compose file does this.
- Back up the database regularly. Each deploy makes a backup, and `deploy/deploy.sh backup` makes one on demand.
