# Changesets

This project uses [changesets](https://github.com/changesets/changesets) for versioning.

## Adding a changeset

After making changes, run:

```bash
pnpm changeset
```

This creates a changeset file describing the change and its semver bump type.

## Releasing

Maintainers do not edit package versions by hand.

1. Contributors merge feature or fix PRs with changesets.
2. GitLab opens or updates a single `release/next` merge request from those pending changesets.
3. Maintainers merge the release MR.
4. GitLab tags the changed packages, publishes them to npm from the protected `production` environment, and mirrors the release tags to GitHub.
