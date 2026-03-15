# Changelog

All notable changes to this project will be documented in this file.
This project uses [Calendar Versioning](https://calver.org/) (`YYYY.MM.DD.TS`).


## v2026.03.15.2

- Switch Glama badge from score to card format (#13)

## v2026.03.15.1

- Add Glama registry badge to README (#13)

## v2026.03.14.5

- Add skill documentation to README and `.claude/skills/README.md` per ADR-0022 (#17)

## v2026.03.14.4

- Add `docs/superpowers/` to `.gitignore` per ADR-0021 (#15)

## v2026.03.14.3

- Add acceptance criteria gate to CLAUDE.md PR Workflow (ADR-0017) (#11)

## v2026.03.14.2

- Clarify license: internal/commercial use requires commercial license (#9)

## v2026.03.14.1

- 42 tools across 7 domains: Zones (4), DNS (9), Diagnostics (4), Tunnels (6), WAF (5), Zero Trust (6), Security & DDoS (8) (#1)
- CloudflareClient with Bearer token auth, multi-zone resolveZoneId, GraphQL Analytics API support (#1)
- 7 skills: dns-management, health (/cf-health), security-audit, tunnel-management, waf-management, zero-trust, incident-response (#1)
- 141 unit tests with vitest, all passing (#1)
- Zod input validation on all tools, structured error handling with CloudflareApiError (#1)

## v2026.03.13.1

- Initial project scaffold: CloudflareClient, validation schemas, error handling
- Repository setup: package.json, tsconfig, CLAUDE.md, README, SECURITY.md
