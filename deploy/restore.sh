#!/bin/sh
# Restore the database from a backup made by the `backup` service. This REPLACES the current
# data with the backup's, so it asks first.
#   sh deploy/restore.sh backups/aitutor-20261111-030000.dump
set -eu
cd "$(dirname "$0")/.."
file="${1:?usage: sh deploy/restore.sh backups/aitutor-YYYYMMDD-HHMMSS.dump}"
[ -f "$file" ] || { echo "no such file: $file" >&2; exit 1; }
compose="docker compose -f docker-compose.prod.yml"

printf "Replace ALL current data with %s? Type 'restore' to continue: " "$file"
read -r answer
[ "$answer" = "restore" ] || { echo "Cancelled."; exit 1; }

$compose stop api video-worker
$compose exec -T postgres sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$file"
$compose start api video-worker
echo "Restored from $file."
