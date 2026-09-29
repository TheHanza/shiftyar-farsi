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
- Shift planning: admins set recurring shifts per person (e.g. 21:00–03:00 every day). Anyone
  who can't make a planned day can ask a specific teammate or the whole team to cover it, and
  admins can reassign a day directly. Planned times show up as a one-tap preset when logging.
- Shifts on the same team that run at the same time (overlap over 15 minutes) go to the
  approval queue, both of them, with the overlap shown on each card. Toggle in Settings.

### Changed
- Employees can edit approved shifts within the edit window, and every employee edit goes back
  to the approval queue, even when approval is turned off. Shifts an admin approved can't be
  deleted by the employee.
- Shift cards show whether they can be edited, and recent shifts on the home screen open for editing.

### Fixed
- The "another day" date picker didn't open in some browsers, so only the last 7 days could be logged.
  The form now also says how far back the edit window allows.
