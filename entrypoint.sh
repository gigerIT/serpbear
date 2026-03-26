#!/bin/sh
set -eu

mkdir -p /app/data

echo "Running database migrations..."
node /app/database/runMigrations.js

echo "Starting application: $*"
exec "$@"
