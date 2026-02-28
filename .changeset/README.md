# Changesets

This project uses [changesets](https://github.com/changesets/changesets) for versioning.

## Adding a changeset

After making changes, run:

```bash
pnpm changeset
```

This creates a changeset file describing the change and its semver bump type.

## Releasing

Maintainers merge changeset PRs, then the publish workflow handles npm release.
