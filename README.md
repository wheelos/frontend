# frontend
This repository provides the Dreamview frontend — a web-based visualization for the Apollo simulator.

**Prerequisites**
- Node.js >= 20
- npm (or yarn). The repository supports both npm and Yarn via Corepack.

**Quick Start (local)**
- Install dependencies:

```bash
# Using npm
npm ci
# Or using yarn (if you prefer)
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
```

- Build production bundle and package (creates tarball and sha256):

```bash
# frontend

Dreamview frontend — web UI for the Apollo simulator.

Prerequisites
- Node.js >= 20

Quick start
- Install dependencies:

```bash
npm ci
```

- Build for production:

```bash
npm run build
```

- Local smoke test:

```bash
npm run verify-local
# open http://localhost:8081
```

Triggering releases (CI)
- Push an annotated tag matching `v*` to trigger `.github/workflows/release.yml`:

```bash
git tag -a v5.5.0 -m "Release v5.5.0"
git push origin v5.5.0
```

Notes
- The release workflow uploads a versioned tarball; ensure `package.json` has the correct `version`.
- If you prefer to test CI without creating a Release, run the workflow from Actions UI or test on a fork.

Integration
- The frontend connects to backend websocket endpoints (map, pointcloud, camera, sim) on the same host/port. In development it defaults to the port in `config/parameters.js` (8888).

Useful files
- [.github/workflows/release.yml](.github/workflows/release.yml)
- [package.json](package.json)
- [config/parameters.js](config/parameters.js)

Troubleshooting
- Check browser console for websocket URLs and errors; verify backend is reachable on the expected port.
