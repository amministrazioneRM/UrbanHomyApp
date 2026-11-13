#!/bin/sh
set -e

# Le migrazioni Prisma vengono eseguite nell'init container "migrate".
# Qui il DB è già pronto e le migrazioni già applicate.

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
