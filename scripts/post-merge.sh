#!/bin/bash
set -e

# Install npm dependencies (idempotent — npm ci falls back to install if no lockfile).
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# Database migrations run automatically on server boot via db/migrate.js,
# so no explicit migration step is needed here.
echo "[post-merge] dependencies installed"
