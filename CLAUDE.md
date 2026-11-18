# Project rules

- Never commit secrets (API keys, passwords, tokens). Use `.env` locally (git-ignored) and list variable names in `.env.example`.
- Cloudflare Workers: store secrets with `wrangler secret put`, never in code or `wrangler.toml`.
- Work on a branch and open a pull request; do not push straight to `main`.
- Run the tests before committing, and show the test output.
- Do not touch production servers or databases unless asked.
