#!/usr/bin/env bash
# Regenerate docs/DATA-CATALOG.md and docs/data-catalog.json from BigQuery.
# Run from repo root. Requires: gcloud auth, bq CLI, node, jq.
set -euo pipefail

PROJECT="${PROJECT:-reconciliation-dashboard}"
WORK="$(mktemp -d)"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Refreshing catalog from project=$PROJECT"
echo "Workdir: $WORK"

mkdir -p "$WORK/schemas"

# List datasets
DATASETS=$(bq ls --project_id="$PROJECT" --max_results=500 2>&1 | awk 'NR>2 && NF>0 {print $1}')
if [ -z "$DATASETS" ]; then
  echo "ERROR: no datasets found in $PROJECT" >&2; exit 1
fi
echo "Datasets: $(echo "$DATASETS" | tr '\n' ' ')"

# For each dataset, enumerate tables, then pull each schema as JSON
for DS in $DATASETS; do
  bq ls --project_id="$PROJECT" --max_results=1000 "$PROJECT:$DS" > "$WORK/tables_${DS}.txt" 2>&1 || true
  TABLES=$(awk 'NR>2 && NF>0 {print $1}' "$WORK/tables_${DS}.txt")
  for T in $TABLES; do
    bq show --format=prettyjson "$PROJECT:${DS}.${T}" > "$WORK/schemas/${DS}__${T}.json" 2>/dev/null \
      && echo "ok ${DS}.${T}" || echo "FAIL ${DS}.${T}"
  done
done

# Run the catalog builder, pointing it at this workdir
SCHEMAS_DIR="$WORK/schemas" OUT_DIR="$REPO_ROOT/docs" node "$REPO_ROOT/scripts/build-catalog.js"

echo "Done. Files updated:"
ls -la "$REPO_ROOT/docs/DATA-CATALOG.md" "$REPO_ROOT/docs/data-catalog.json"
