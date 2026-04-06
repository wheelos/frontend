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

- Run with Docker (development)

You can run the frontend inside Docker for a repeatable development environment. The repository includes a Dockerfile and a Docker Compose configuration at `docker/docker-compose.yml`.

1) Build and start with Docker Compose (recommended):

```bash
# from repository root
docker compose -f docker/docker-compose.yml up --build -d
```

The service maps container port `8080` to host port `8081` (see `docker/docker-compose.yml`).

2) Check status and follow logs:

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f frontend
```

3) Quick HTTP verification from the host:

```bash
curl -I http://localhost:8081
curl -s http://localhost:8081 | head -n 20
```

4) Alternative: build and run the image manually:

```bash
docker build -t dreamview-frontend:dev -f docker/Dockerfile .
docker run -d --name dreamview-frontend -p 8081:8080 dreamview-frontend:dev
docker logs -f dreamview-frontend
```

5) Build inside a running container (optional)

If you prefer to run the build inside the container (for example when using a dev container with source mounted), follow these steps:

```bash
# enter the running container
docker run -it --rm \
  -v "$(pwd)":/app \
  -v node_modules:/app/node_modules \
  --workdir /app \
  dreamview-frontend:dev \
  bash

# or when using compose
docker compose -f docker/docker-compose.yml exec frontend bash

# check Node / npm versions
node -v
npm -v

# install dependencies if needed (container may already have them)
# use the project's package manager; Dockerfile prepares Yarn, but npm also works
npm ci
# or
yarn install --frozen-lockfile

# run the production build
npm run build
# or
yarn build
```

Notes and troubleshooting
- If the repository is mounted into the container via a volume, the host's files may replace the image filesystem; ensure `node_modules` is present in the container (compose mounts a `node_modules` volume by default).
- The Dockerfile installs system build tools (build-essential, python3, libvips, etc.) so native module compilation should succeed inside the container. If you use a different runtime image without build tools, builds may fail.
- Prefer using `yarn` in the container to match the repository's lockfile, unless you have a reason to use `npm`.
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
