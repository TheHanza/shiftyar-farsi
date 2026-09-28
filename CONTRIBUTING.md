# Contributing to ShiftYar

Thanks for helping! Bug reports, ideas, translations and code are all welcome.

## Getting started

```bash
cp .env.example .env
make setup
make demo          # API with sample data on :8080
make dev-frontend  # UI on :5173
```

## Before opening a pull request

- `make test` passes: Go vet, Go tests and the TypeScript check.
- Go code is `gofmt`-ed. `make lint` checks this.
- Pay and period logic lives in `backend/internal/calc`. Changes there need unit tests,
  because payroll mistakes are expensive.
- UI changes are checked at phone width (~390px) and in RTL. Please attach screenshots.
- Keep user-facing text in Persian with a friendly, informal tone, matching the rest of the app.

## Design notes

- The visual language follows the bazi.digital website: dark neutral surfaces, `#a855f7` purple
  as the primary color, mint (`#2ee6b6`, from the logo) for success and "on shift", and the
  IRANSansX font. Tokens live at the top of `frontend/src/index.css`.
- Channel and avatar colors in `SWATCHES` (`frontend/src/lib/format.ts`) were checked for
  color-blind separation and contrast on the dark surface. Re-check them before adding more.
- Pending work uses the same hue as approved work with a striped texture, so the two states
  are never distinguished by color alone.

## Commit messages

Use short imperative subjects, e.g. `Add Friday bonus rule presets`. Reference issues when relevant.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
