# Contributing to mcp-cloudflare

Thank you for your interest in contributing!

## Workflow

1. **Issue first** — Create a GitHub issue describing the change before starting work
2. **Fork & branch** — Fork the repo, create a feature branch: `feature/<issue-nr>-<description>`
3. **Develop** — Write code, add tests, update documentation
4. **Test** — Ensure all tests pass: `npm test`
5. **PR** — Create a pull request referencing the issue

## Branch Naming

- `feature/<issue-nr>-<description>` — New features
- `fix/<issue-nr>-<description>` — Bug fixes
- `chore/<description>` — Maintenance tasks

## Commit Messages

Use conventional commits with issue references:

```
feat: add DNS record management tools (#12)
fix: handle rate limit error gracefully (#5)
chore: update dependencies
```

## Code Standards

- TypeScript strict mode
- All tool parameters validated with Zod schemas
- No `any` types
- No SSH or shell execution
- Credentials only via environment variables
- Tests for all new tools
- Tool naming: `cloudflare_<domain>_<action>`

## Documentation

- All documentation MUST use generic placeholders only (see CLAUDE.md Security section)
- No real domains, zone IDs, account IDs, or API tokens in any file
- Use `your-domain.example.com`, `00000000000000000000000000000000`, `your-api-token-here`

## Review

- All PRs require code review before merging
- Tests must pass
- Documentation must be updated (especially README.md)
- CHANGELOG.md must be updated before tagging/releasing

## After Merge

Branch and worktree cleanup is mandatory after PR merge to prevent drift.
