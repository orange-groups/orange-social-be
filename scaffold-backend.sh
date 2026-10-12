#!/usr/bin/env bash
set -euo pipefail

# Run from the root of an existing NestJS project (package.json + src/app.module.ts).
if [[ ! -f package.json || ! -f src/app.module.ts ]]; then
  echo 'ERROR: Run this script from the NestJS project root.' >&2
  exit 1
fi
if ! grep -q '"@nestjs/core"' package.json; then
  echo 'ERROR: This does not look like a NestJS project.' >&2
  exit 1
fi
if [[ ! -x node_modules/.bin/nest ]]; then
  echo 'ERROR: Nest CLI not found. Run npm install first.' >&2
  exit 1
fi

NEST='./node_modules/.bin/nest'
FEATURES=(auth users profile feed posts comments reactions friends chat notifications media)

mkdir -p \
  src/config \
  src/common/{decorators,dto,filters,guards,interceptors,pipes,types,utils} \
  src/modules \
  docs

if [[ ! -f .env.example ]]; then
  cat > .env.example <<'ENV'
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_ACCESS_SECRET=replace_with_strong_secret
JWT_REFRESH_SECRET=replace_with_another_strong_secret
ENV
fi

# Generate real NestJS classes and wire each module to app.module.ts.
# The script intentionally avoids overwriting pre-existing classes.
for feature in "${FEATURES[@]}"; do
  module_file="src/modules/${feature}/${feature}.module.ts"
  controller_file="src/modules/${feature}/${feature}.controller.ts"
  service_file="src/modules/${feature}/${feature}.service.ts"

  if [[ ! -f "$module_file" ]]; then
    "$NEST" generate module "modules/${feature}"
  else
    echo "SKIP $module_file (already exists)"
  fi
  if [[ ! -f "$controller_file" ]]; then
    "$NEST" generate controller "modules/${feature}"
  else
    echo "SKIP $controller_file (already exists)"
  fi
  if [[ ! -f "$service_file" ]]; then
    "$NEST" generate service "modules/${feature}"
  else
    echo "SKIP $service_file (already exists)"
  fi

  mkdir -p "src/modules/${feature}/dto"
done

# Folders used by specialized features.
mkdir -p \
  src/modules/auth/{guards,strategies} \
  src/modules/posts/repositories \
  src/modules/chat/events \
  src/modules/notifications/events

# Generate database module and an injectable PrismaService placeholder.
if [[ ! -f src/database/database.module.ts ]]; then
  "$NEST" generate module database
fi
if [[ ! -f src/database/prisma.service.ts ]]; then
  "$NEST" generate service database/prisma --flat
fi

# Gateway classes require @nestjs/websockets and a compatible adapter at runtime.
for feature in chat notifications; do
  if [[ ! -f "src/modules/${feature}/${feature}.gateway.ts" ]]; then
    "$NEST" generate gateway "modules/${feature}"
  fi
done

# Git does not track empty folders; keep their placeholders for team sharing.
find src/config src/common src/modules docs -type d -empty -exec touch '{}/.gitkeep' \;

echo
printf '%s\n' 'Scaffold created successfully.' \
  'Next steps:' \
  '  1. Configure app.module.ts (ConfigModule, database providers).' \
  '  2. Define DTOs, validation, authentication, domain logic, and database schema.' \
  '  3. Integrate Prisma (optional), Swagger and Socket.IO.' \
  '  4. Run: npm run build && npm test'
