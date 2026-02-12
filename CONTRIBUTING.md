# Contributing

Thanks for your interest in contributing.

## Ground rules

- Keep changes focused and incremental.
- Prefer small PRs that are easy to review.
- Add/adjust tests when behavior changes.
- Follow existing style and patterns (TypeScript + Express + Mongoose).
- Do not commit secrets (see `.env.example` for configuration).

## Development workflow

1. Fork the repo (or create a branch if you have write access).
2. Create a feature branch:

   ```bash
   git checkout -b feat/my-change
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Run locally:

   ```bash
   pnpm dev
   ```

5. Before opening a PR:
   - Run typecheck/lint/tests (if present)
   - Ensure new endpoints are documented
   - Ensure error responses use the shared error shape

## Commit message style

Use clear, conventional messages:

- `feat: add invoice listing endpoint`
- `fix: handle missing stripe signature header`
- `refactor: centralize env loading`
- `docs: update schema docs`

## Reporting issues

Please include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Logs (sanitized—no secrets)
- Node/pnpm versions
