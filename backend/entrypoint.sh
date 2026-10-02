#!/bin/sh
set -e

echo "Waiting for SQL Server to be ready..."
until nc -z db 1433 2>/dev/null; do
  echo "SQL Server is unavailable - sleeping 2s"
  sleep 2
done
echo "SQL Server port is open - waiting 1s for full readiness..."
sleep 1

echo "Running Prisma migrations..."
npx prisma migrate deploy

if [ "$SEED_SAMPLE_DATA" = "true" ]; then
  echo "SEED_SAMPLE_DATA=true — seeding sample data..."
  node dist/prisma/seed.js
  node dist/scripts/seed-other-apps.js || true
  echo "Hashing passwords..."
  node dist/scripts/hash-passwords.js
else
  echo "SEED_SAMPLE_DATA is not true — skipping sample data seed."
fi

echo "Starting server..."
exec node dist/src/index.js
