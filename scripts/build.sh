#!/usr/bin/env bash
set -euo pipefail

# Build and package the frontend artifacts, including proto_bundle.
# Usage: ./scripts/build.sh

echo "Installing dependencies..."
if [ -f yarn.lock ]; then
  if command -v yarn >/dev/null 2>&1; then
    yarn install --frozen-lockfile
    BUILD_CMD="yarn build"
  else
    echo "ERROR: yarn.lock exists but 'yarn' command not found. Please enable Corepack or install Yarn and retry." >&2
    exit 1
  fi
else
  npm ci
  BUILD_CMD="npm run build"
fi

echo "Building production bundle..."
${BUILD_CMD}

echo "Packing dist, proto_bundle and BUILD into dreamview-frontend.tar.gz..."

# determine version strictly from package.json; fail if missing
version=""
if command -v node >/dev/null 2>&1 && [ -f package.json ]; then
  version=$(node -e "try{const p=require('./package.json'); console.log(p && p.version ? p.version : '')}catch(e){console.log('')}" ) || version=""
fi
if [ -z "$version" ]; then
  echo "ERROR: package.json missing or has no 'version' field. Set version in package.json and retry." >&2
  exit 1
fi

tarname="dreamview-frontend-${version}.tar.gz"
rm -f "$tarname" "${tarname}.sha256" dreamview-frontend.tar.gz dreamview-frontend.tar.gz.sha256
tar -czvf "$tarname" dist proto_bundle BUILD

echo "Calculating SHA256..."
sha256sum "$tarname" > "${tarname}.sha256"

# keep backward-compatible copies with fixed names expected by CI
cp -f "$tarname" dreamview-frontend.tar.gz 2>/dev/null || true
cp -f "${tarname}.sha256" dreamview-frontend.tar.gz.sha256 2>/dev/null || true

echo "Build and packaging complete:"
ls -lh "$tarname" "${tarname}.sha256" dreamview-frontend.tar.gz dreamview-frontend.tar.gz.sha256 || true

exit 0
