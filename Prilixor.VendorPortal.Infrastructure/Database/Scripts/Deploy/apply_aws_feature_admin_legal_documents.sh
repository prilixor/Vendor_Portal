#!/usr/bin/env bash
# Apply feature/admin-legal-documents SQL on the Linux app server (SSM).
# Usage (from this folder, or pass the .sql path):
#   export PGPASSWORD='<same password as appsettings.Production.json>'
#   bash apply_aws_feature_admin_legal_documents.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${1:-$SCRIPT_DIR/aws_feature_admin_legal_documents.sql}"
HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
USER="${PGUSER:-blinksmed}"
PART_A_DB="${COMMON_DB:-common_portal_db}"
PART_B_DB="${CUSTOMER_DB:-customer_portal_db}"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. On Amazon Linux: sudo dnf install -y postgresql15" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Query Editor / app-user friendly: do not use \\c. Split on PART B header.
awk '/PART B — customer_portal_db/{found=1} !found' "$SQL_FILE" \
  | grep -v -E '^\\c ' > "$WORK/part_a.sql"
awk '/PART B — customer_portal_db/{found=1} found' "$SQL_FILE" \
  | grep -v -E '^\\c ' > "$WORK/part_b.sql"

echo "==> PART A  $USER@$HOST:$PORT/$PART_A_DB"
psql -h "$HOST" -p "$PORT" -U "$USER" -d "$PART_A_DB" -v ON_ERROR_STOP=1 -f "$WORK/part_a.sql"

echo "==> PART B  $USER@$HOST:$PORT/$PART_B_DB"
psql -h "$HOST" -p "$PORT" -U "$USER" -d "$PART_B_DB" -v ON_ERROR_STOP=1 -f "$WORK/part_b.sql"

echo "==> Done. Restart the API so legal markdown seeds, then spot-check Admin → Legal Documents."
