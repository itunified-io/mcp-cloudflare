# mcp-cloudflare — CLAUDE.md

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Code Conventions](#code-conventions)
- [Security](#security)
- [Design/Plan Documents — MANDATORY](#designplan-documents--mandatory)
- [CHANGELOG.md — MANDATORY](#changelogmd--mandatory)
- [Versioning & Releases (CalVer)](#versioning--releases-calver)
- [Git Workflow](#git-workflow)
- [Claude Code Skills](#claude-code-skills)
- [Language](#language)
- [Development Setup](#development-setup)
- [Testing](#testing)

## Project Overview

Slim Cloudflare MCP Server for managing DNS, zones, tunnels, WAF, Zero Trust, and security via Cloudflare API v4. Supports multiple zones.

**No SSH. No shell execution. API-only. 3 runtime dependencies.**

## Architecture

```
src/
  index.ts                   # MCP Server entry point (stdio transport only)
  client/
    cloudflare-client.ts     # Axios HTTP client (Bearer token auth, error handling)
    types.ts                 # Cloudflare API v4 response types
  tools/
    dns.ts                   # DNS record management tools
    zones.ts                 # Zone listing and settings tools
    tunnels.ts               # Cloudflare Tunnel management tools
    waf.ts                   # WAF ruleset and custom rule tools
    zerotrust.ts             # Zero Trust Access and Gateway tools
    security.ts              # Security events, IP access rules, DDoS tools
  utils/
    validation.ts            # Shared Zod schemas (zone IDs, record types, etc.)
    errors.ts                # Cloudflare error extraction and CloudflareApiError
tests/                       # Vitest unit tests
docs/
  api-reference.md           # Cloudflare API v4 endpoint mapping
```

## Code Conventions

### TypeScript
- Strict mode enabled (`"strict": true` in tsconfig.json)
- All tool parameters validated with Zod schemas
- Generically typed API client (`get<T>()`, `post<T>()`, `put<T>()`, `patch<T>()`, `delete<T>()`)
- No `any` types — use `unknown` and narrow

### Tool Design
- **Granular tools**: one MCP tool per operation (e.g., `cloudflare_dns_add_record`)
- Tool naming: `cloudflare_<domain>_<action>`
- Each tool has its own Zod input schema and clear description
- Destructive operations require confirmation parameters
- Zone-scoped tools require `zone_id` parameter (32-char hex or zone name — resolved automatically)

### Dependencies
- **3 runtime dependencies only**: `@modelcontextprotocol/sdk`, `axios`, `zod`
- No SSH libraries, no Redis, no PostgreSQL
- Dev: `typescript`, `vitest`, `@types/node`

## Security

- **Transport**: stdio only (no SSE, no HTTP endpoint)
- **Authentication**: API Token exclusively via environment variables. Never hardcoded, logged, or committed.
- **No SSH**: Exclusively Cloudflare REST API v4
- **Input validation**: Zod schemas for all tool parameters
- **Error handling**: No credential leaks in error messages (Bearer token never appears in logs or errors)
- **Credentials**: Never hardcoded, never logged, never in git
- **Secret Redaction — MANDATORY**: When using `grep`, `cat`, `sed`, `awk`, shell scripts, or any tool that reads/displays file contents containing secrets (`.env`, credentials, API keys, tokens, passwords), **ALWAYS redact the secret values** in output. Use patterns like `sed 's/=.*/=<redacted>/'` or equivalent. Never display raw secret values in terminal output, logs, conversation context, or commit messages.
- **MCP Registry Tokens**: `.mcpregistry_*` files are gitignored (ADR-0024). Never commit registry auth tokens.
- **Public Repo Documentation Policy — MANDATORY**: This is a **public repository**. All documentation, code examples, test data, and commit messages MUST use only generic placeholders:
  - Domains: `your-domain.example.com`, `example.com`
  - IPs: `192.168.1.1`, `10.0.0.1` (common private ranges only)
  - Emails: `admin@example.com`, `user@example.com`
  - API tokens/keys: `your-api-token-here`, `test-token`
  - Account/zone IDs: `00000000000000000000000000000000` (32 zeros)
  - **NEVER** include real domains, zone IDs, account IDs, API tokens, or internal topology
  - Infrastructure-specific documentation belongs in the private `itunified-io/infrastructure` repo

## Design/Plan Documents — MANDATORY

- **Every significant change MUST have a design/plan document** in `docs/plans/`
- Naming: `docs/plans/<NNN>-<short-description>.md`
- The design doc MUST be referenced in the corresponding GitHub issue (bidirectional link)
- Design docs contain: problem, solution, prerequisites, execution steps, rollback, verification
- Trivial changes (typos, minor doc updates) are exempt

## CHANGELOG.md — MANDATORY

- **`CHANGELOG.md` MUST exist and MUST be kept up to date**
- **Every PR merge MUST add a new entry** before tagging/releasing
- Format: CalVer date header (`## v2026.03.13.1`) followed by a list of changes with issue references
- Never skip CHANGELOG updates — they are the source of truth for what changed and when

## Versioning & Releases (CalVer)

- Schema: `YYYY.MM.DD.TS` (e.g., `2026.03.13.1`)
- `package.json`: npm-compatible without leading zeros (`2026.3.13`)
- Git tags: `v2026.03.13.1` (leading zeros for sorting)

### Release Workflow — MANDATORY after every PR merge
1. **Update CHANGELOG.md** with new version entry
2. Update `package.json` version if date changed
3. Create annotated git tag: `git tag -a v2026.03.13.1 -m "v2026.03.13.1: <summary>"`
4. Push tag: `git push origin --tags`
5. Create GitHub release: `gh release create v2026.03.13.1 --title "v2026.03.13.1 — <title>" --notes "<release notes>"`
6. Release notes must list what changed and reference closed issues

## Git Workflow

- **NEVER work on main** — all changes via feature branches + PR
- **Branching**: `feature/<issue-nr>-<description>`, `fix/<issue-nr>-<description>`, `chore/<description>`
- **Worktree naming**: `.claude/worktrees/<branch-name>`
- **GitHub Issues mandatory**: every change must have an associated GH issue
- **Commit messages**: must reference GH issue — `feat: add DNS record tool (#12)` or `fix: handle rate limit (#5)`
- **No commit without issue reference** (exceptions: initial setup, typo fixes)
- **PR workflow**: feature branch -> `gh pr create` -> review -> merge into main
- **Acceptance Criteria Gate — MANDATORY** (see [ADR-0017](https://github.com/itunified-io/infrastructure/blob/main/docs/adr/0017-acceptance-criteria-before-merge.md)):
  - All acceptance criteria in the associated GH issue MUST be checked and verified as successful before merge to `main`
  - Verification is active: criteria must be actually tested, not assumed to pass
  - Includes: tests pass (`npm test`), build succeeds (`npm run build`), live tests pass (`/cf-test`), CHANGELOG updated, docs updated
  - If any criterion cannot be satisfied, the PR must NOT be merged
- **After PR merge: branch/worktree cleanup is mandatory** — `git branch -d <branch>`, `git remote prune origin`, remove worktree. Prevents drift.

### Bug Fixes — MANDATORY Workflow
- **Every bug fix MUST have a GitHub issue** with appropriate labels (`bug`, scope labels)
- Issue-first: create issue → branch (`fix/<issue-nr>-<description>`) → fix → PR → merge
- Bug fix commits must reference the issue: `fix: <description> (#<nr>)`
- CHANGELOG entry required for every bug fix

## Claude Code Skills

Skills are higher-level workflow orchestrations that compose multiple MCP tools into structured task flows. They live in `.claude/skills/<name>/SKILL.md`.

### Location Policy
- **Skills MUST live in the MCP server repo** (this repo), NOT in private infrastructure repos
- Skills are public and reusable by any user of the MCP server
- See ADR-0005 in the infrastructure repo for the architectural decision

### Skill Structure
```
.claude/skills/
  <skill-name>/
    SKILL.md          # Skill definition with YAML frontmatter
```

### YAML Frontmatter
```yaml
---
name: skill-name
description: One-line description of what the skill does
disable-model-invocation: true   # Optional: makes it user-only (slash command)
---
```

### Skill Types
- **Auto (Claude-invocable)**: Omit `disable-model-invocation` — Claude triggers automatically when relevant
- **User-invocable (slash command)**: Set `disable-model-invocation: true` — user runs via `/command`

### Naming Convention
- Skill directory: `cloudflare-<purpose>` (e.g., `cloudflare-dns-audit`, `cloudflare-zone-health`)
- Slash commands: short, memorable (e.g., `/cf-health`, `/cf-dns-audit`)

### Skill Design Guidelines
- Each skill MUST specify which MCP tools it uses
- Workflow steps should maximize parallel tool calls for speed
- Read-only skills (audits, health checks) MUST NOT modify configuration
- Destructive actions MUST ask for user confirmation
- Output should be structured (tables, sections) for quick scanning

## Language

- All documentation, code comments, commit messages: **English only**

## Development Setup

```bash
# Prerequisites: Node.js >= 20, npm

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your Cloudflare API token

# Build
npm run build

# Test
npm test

# Run (stdio transport)
node dist/index.js
```

## Testing

- Unit tests with vitest (mocked API responses)
- Zod schema validation for invalid inputs
- Error handling for API errors (401, 403, 404, 429, 500)
- Run: `npm test`
