#!/bin/bash
set -e

# Install JS dependencies in case package.json or the lockfile changed.
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
