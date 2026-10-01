#!/bin/sh
# Build all frontend apps and portal server before running docker compose up --build.
# Run this once after any source change to regenerate dist/ and serve.js artifacts.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

for app in manutenzioni locker ticket-it utenti vending; do
  echo "Building apps/$app..."
  cd "$ROOT/apps/$app"
  npm install
  npm run build
done

echo "Compiling portal/serve.ts..."
cd "$ROOT/portal"
npm install
node node_modules/.bin/tsc

echo "Building shared/accounts.js (IIFE for browser)..."
cd "$ROOT"
npx esbuild shared/accounts.ts \
  --bundle \
  --format=iife \
  --global-name=_UHAccountsModule \
  --allow-overwrite \
  --footer:js="window.UHAccounts = _UHAccountsModule.default;" \
  --outfile=shared/accounts.js

echo ""
echo "All artifacts built. You can now run: docker compose up --build"
