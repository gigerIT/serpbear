#!/bin/sh
set -eu

mkdir -p /app/data

if [ ! -f /app/data/failed_queue.json ]; then
  printf '[]' > /app/data/failed_queue.json
fi

echo "Running database migrations..."
node /app/database/runMigrations.js

echo "Starting background cron worker..."
node /app/cron.js &

echo "Starting application: $*"
exec "$@"
