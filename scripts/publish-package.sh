#!/bin/sh

set -eu

PACKAGE_DIR=${1:?package directory is required}
EXPECTED_TAG=${2:-}

PACKAGE_NAME=$(node -p "require('./${PACKAGE_DIR}/package.json').name")
PACKAGE_VERSION=$(node -p "require('./${PACKAGE_DIR}/package.json').version")
PUBLISH_FLAGS="--access public --provenance"

if [ -n "${EXPECTED_TAG}" ] && [ "${CI_COMMIT_TAG:-}" != "${EXPECTED_TAG}" ]; then
  echo "Tag mismatch for ${PACKAGE_NAME}: expected ${EXPECTED_TAG}, got ${CI_COMMIT_TAG:-<unset>}." >&2
  exit 1
fi

if npm view "${PACKAGE_NAME}@${PACKAGE_VERSION}" version >/dev/null 2>&1; then
  echo "${PACKAGE_NAME}@${PACKAGE_VERSION} is already published on npm. Skipping publish." >&2
  exit 0
fi

if [ -n "${NPM_TOKEN:-}" ]; then
  if [ -f "${NPM_TOKEN}" ]; then
    NODE_AUTH_TOKEN=$(tr -d '\r\n' < "${NPM_TOKEN}")
  else
    NODE_AUTH_TOKEN=${NPM_TOKEN}
  fi

  export NODE_AUTH_TOKEN
  printf '//registry.npmjs.org/:_authToken=%s\nregistry=https://registry.npmjs.org/\nalways-auth=true\n' "${NODE_AUTH_TOKEN}" > "${HOME}/.npmrc"
  echo "Auth: using NPM_TOKEN for ${PACKAGE_NAME}." >&2
  npm whoami >/dev/null
else
  echo "NPM_TOKEN is not set. Falling back to npm trusted publishing via GitLab OIDC." >&2

  if [ "${CI_COMMIT_REF_PROTECTED:-false}" != "true" ]; then
    echo "Ref ${CI_COMMIT_TAG:-<unset>} is not protected. Protected GitLab CI/CD variables are not exposed to unprotected tag pipelines." >&2
  fi

  if [ -z "${NPM_ID_TOKEN:-}" ]; then
    echo "NPM_ID_TOKEN is missing, so npm trusted publishing cannot authenticate this job." >&2
    echo "Make NPM_TOKEN available to this tag pipeline or configure npm trusted publishing for ${PACKAGE_NAME}." >&2
    exit 1
  fi

  echo "Auth: using npm trusted publishing for ${PACKAGE_NAME}." >&2
  echo "Required npm trusted publisher settings: Namespace=${CI_PROJECT_NAMESPACE:-<unset>}, Project=${CI_PROJECT_NAME:-<unset>}, CI config=.gitlab-ci.yml." >&2
fi

if [ -z "${SIGSTORE_ID_TOKEN:-}" ]; then
  echo "SIGSTORE_ID_TOKEN is missing. Provenance-enabled publish requires the GitLab sigstore OIDC token." >&2
  exit 1
fi

cd "${PACKAGE_DIR}"
npm pack --dry-run
npm publish ${PUBLISH_FLAGS}
