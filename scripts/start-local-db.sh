#!/usr/bin/env bash
# Development database only: requires an ignored root .env, preserves the volume.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  echo 'Create .env from .env.example and set local PostgreSQL values first.' >&2
  exit 1
fi
if docker inspect geobusiness-postgis >/dev/null 2>&1; then
  docker start geobusiness-postgis >/dev/null
else
  docker run -d --name geobusiness-postgis --env-file .env \
    -p 127.0.0.1:5432:5432 -v geobusiness_postgres_data:/var/lib/postgresql/data \
    postgis/postgis:17-3.5 >/dev/null
fi
ready=false
for attempt in {1..60}; do
  if docker exec geobusiness-postgis sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [ "$ready" != true ]; then
  docker logs --tail 30 geobusiness-postgis >&2
  exit 1
fi
# Idempotent bootstrap, not a migration system. Fail on any SQL error.
docker exec -i geobusiness-postgis sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/init/001_schema.sql
