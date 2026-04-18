# Release Rules

These rules are mandatory for every release/tag.

## Versioning Rules

1. Always check existing git tags before picking a version:
   - `git tag --sort=version:refname`
2. Never create a version lower than the highest existing tag.
3. If a higher tag already exists, bump to the next valid version (for example: if `v1.3.0` exists, use `v1.3.1` or above).
4. Keep `package.json` version, `CHANGELOG.md` version header, commit message, and git tag aligned.

## Pre-Tag Checklist

1. `git status --short` must be clean except intended release files.
2. `npm.cmd test` must pass.
3. `npm.cmd run check:secrets` must pass.
4. Ensure `config.json` has an empty `apiKey` before commit/push.

## Tagging and Push Rules

1. Create annotated tags only:
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
2. Push commit first, then tag:
   - `git push origin main`
   - `git push origin vX.Y.Z`
3. If an incorrect tag was pushed, immediately create a corrected higher version tag and update docs/files to match.

## Documentation Rules

1. Add a release block at top of `CHANGELOG.md`.
2. Update `README.md` if behavior or operational workflow changed.
3. Keep changes concise and factual.
