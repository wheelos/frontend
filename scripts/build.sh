#!/usr/bin/env bash
set -euo pipefail

# Build and package the frontend artifacts, including proto_bundle.
# Usage: ./scripts/build.sh

echo "Installing dependencies..."
if [ -f yarn.lock ]; then
  if command -v yarn >/dev/null 2>&1; then
    yarn install --frozen-lockfile
  else
    npm ci
  fi
else
  npm ci
fi

echo "Building production bundle..."
npm run build

echo "Packing dist, proto_bundle and BUILD into dreamview-frontend.tar.gz..."
rm -f dreamview-frontend.tar.gz dreamview-frontend.tar.gz.sha256
tar -czvf dreamview-frontend.tar.gz dist proto_bundle BUILD

echo "Calculating SHA256..."
sha256sum dreamview-frontend.tar.gz > dreamview-frontend.tar.gz.sha256

echo "Build and packaging complete:"
ls -lh dreamview-frontend.tar.gz dreamview-frontend.tar.gz.sha256 || true

exit 0
