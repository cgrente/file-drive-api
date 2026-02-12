# Security Policy

## Supported Versions

This project is under active development. Only the `main` branch is considered supported.

## Reporting a Vulnerability

If you discover a security issue:

1. **Do not** open a public GitHub issue with exploit details.
2. Send a private report to the repository maintainers.

Include:
- A clear description of the vulnerability
- Steps to reproduce
- Impact assessment (what can an attacker do?)
- Any proof-of-concept (sanitized)

## Notes for deploys

- Use HTTPS everywhere (TLS termination at LB/NGINX is fine)
- Restrict CORS origins to your frontend(s)
- Keep Stripe webhook secrets safe
- Never commit credentials or `.env` files
