# Releasing a new version

## Prerequisites

- npm account with publish access to `dragon-touch-mcp`
- `npm login` completed in the local shell

## Steps

```bash
# 1. Make sure main is clean and up to date
git checkout main
git pull

# 2. Bump version — updates package.json, creates a commit and git tag automatically
npm version patch   # 0.2.0 → 0.2.1  (bug fixes)
npm version minor   # 0.2.0 → 0.3.0  (new tools)
npm version major   # 0.2.0 → 1.0.0  (breaking changes)

# 3. Push commit and tag to GitHub
git push origin main --tags

# 4. Publish to npm (runs build automatically via "prepare" script)
npm publish
```

Done. The `prepare` script builds `dist/` before every publish, so no manual build step needed.
