# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial release: employee hour logging and one-tap clock in/out, admin approvals,
  weekly and monthly payroll with pay-rate rules (night shift +10% by default), goals, streaks,
  team coverage timeline, leaderboard, teams (channels in the API), bonuses and deductions, CSV export,
  Gregorian or Jalali months, and a PWA manifest.
- Company logo upload in Settings, shown in the header, on the login page and as the
  favicon. The logo is stored in the database so it survives redeploys and is included in backups.
- Docker image, production compose stack with PostgreSQL, and `deploy/deploy.sh` with
  backups, health checks and automatic rollback.
