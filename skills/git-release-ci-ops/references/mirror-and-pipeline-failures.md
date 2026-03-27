# Mirror And Pipeline Failures

Use this reference when a GitLab job fails during push, mirror, release prep, or tag handling.

## First classify the failure

- Script/runtime failure
  - Example: helper code crashes before `git push`
- Auth or secret failure
  - Missing `GITHUB_MIRROR_TOKEN`, `GITLAB_RELEASE_TOKEN`, or npm auth
- Non-fast-forward / branch drift
  - GitHub `main` contains work not present in GitLab
- Branch protection rejection
  - Mirror actor is not allowed to force-push with a lease
- Process confusion
  - Release MR pipeline passed, but `main` branch pipeline still failed

## Commands to inspect drift

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/main
git ls-remote https://github.com/samilozturk/agentlint.git refs/heads/main
git fetch https://github.com/samilozturk/agentlint.git main:refs/remotes/tmp/github-main
git merge-base --is-ancestor refs/remotes/tmp/github-main HEAD
git merge-base --is-ancestor HEAD refs/remotes/tmp/github-main
git log --oneline --left-right HEAD...refs/remotes/tmp/github-main -n 20
```

## Decision rules

- If refs are equal, skip the mirror push.
- If GitHub is behind GitLab, a normal push or lease-safe overwrite can advance it.
- If GitHub is ahead or diverged and GitLab is authoritative, prefer `--force-with-lease`, not `--force`.
- If the mirror push is rejected after the lease-safe change, inspect GitHub branch protection for the mirror actor.

## Repo-specific lessons

- GitLab `main` is the source of truth; GitHub is public-facing, not an alternate merge path.
- A direct GitHub `main` merge can create divergence that later mirror jobs must reconcile.
- `mirror-main-branch` failing on `main` does not mean the release MR pipeline is unhealthy.
- `execFileSync` helper wrappers must tolerate non-string return values when stdout is ignored.
