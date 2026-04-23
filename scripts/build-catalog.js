#!/usr/bin/env node
// Build docs/DATA-CATALOG.md and docs/data-catalog.json from bq show JSON files,
// merging in human-curated descriptions from docs/catalog-descriptions.json.
//
// Env vars:
//   SCHEMAS_DIR - directory of bq show prettyjson files (default /tmp/catalog/schemas)
//   OUT_DIR     - directory to write DATA-CATALOG.md + data-catalog.json (default ../docs)
//   DESC_FILE   - JSON descriptions overlay (default ../docs/catalog-descriptions.json)

const fs = require('fs');
const path = require('path');

const schemasDir = process.env.SCHEMAS_DIR || '/tmp/catalog/schemas';
const outDir = process.env.OUT_DIR || path.resolve(__dirname, '..', 'docs');
const descFile = process.env.DESC_FILE || path.join(outDir, 'catalog-descriptions.json');
const project = process.env.PROJECT || 'reconciliation-dashboard';

if (!fs.existsSync(schemasDir)) { console.error(`SCHEMAS_DIR missing: ${schemasDir}`); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

let overlay = { datasets: {} };
if (fs.existsSync(descFile)) {
  overlay = JSON.parse(fs.readFileSync(descFile, 'utf8'));
  console.log(`loaded overlay: ${descFile}`);
} else {
  console.warn(`WARN: overlay file not found at ${descFile}, descriptions will be empty`);
}

function flattenFields(fields, prefix = '') {
  const out = [];
  for (const f of (fields || [])) {
    const name = prefix ? `${prefix}.${f.name}` : f.name;
    out.push({ name, type: f.type, mode: f.mode || 'NULLABLE', description: f.description || null });
    if (f.type === 'RECORD' && f.fields) out.push(...flattenFields(f.fields, name));
  }
  return out;
}

const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json')).sort();
const catalog = { project, generatedAt: new Date().toISOString(), datasets: {} };

for (const file of files) {
  const j = JSON.parse(fs.readFileSync(path.join(schemasDir, file), 'utf8'));
  const ds = j.tableReference.datasetId;
  const tbl = j.tableReference.tableId;
  if (!catalog.datasets[ds]) {
    const dsOverlay = (overlay.datasets && overlay.datasets[ds]) || {};
    catalog.datasets[ds] = { description: dsOverlay.description || null, tables: {} };
  }
  const tblOverlay = (overlay.datasets && overlay.datasets[ds] && overlay.datasets[ds].tables && overlay.datasets[ds].tables[tbl]) || {};
  catalog.datasets[ds].tables[tbl] = {
    tableId: tbl,
    type: j.type || 'TABLE',
    description: tblOverlay.description || j.description || null,
    numRows: j.numRows ? Number(j.numRows) : null,
    numBytes: j.numBytes ? Number(j.numBytes) : null,
    lastModifiedTime: j.lastModifiedTime ? new Date(Number(j.lastModifiedTime)).toISOString() : null,
    location: j.location || null,
    columns: flattenFields(j.schema && j.schema.fields)
  };
}

// Flag missing descriptions so future schema additions are easy to spot.
const missing = [];
for (const [ds, dsv] of Object.entries(catalog.datasets)) {
  if (!dsv.description) missing.push(`dataset ${ds}`);
  for (const [tn, tv] of Object.entries(dsv.tables)) {
    if (!tv.description) missing.push(`${ds}.${tn}`);
  }
}
if (missing.length) {
  console.warn(`WARN: ${missing.length} item(s) without descriptions:`);
  for (const m of missing.slice(0, 25)) console.warn(`  - ${m}`);
  if (missing.length > 25) console.warn(`  ... and ${missing.length - 25} more`);
}

fs.writeFileSync(path.join(outDir, 'data-catalog.json'), JSON.stringify(catalog, null, 2));

const dsNames = Object.keys(catalog.datasets).sort();
let totalTables = 0, totalCols = 0;
for (const ds of dsNames) {
  totalTables += Object.keys(catalog.datasets[ds].tables).length;
  for (const t of Object.values(catalog.datasets[ds].tables)) totalCols += t.columns.length;
}

function trim(s) { return (s || '').trim(); }

const lines = [];
lines.push('# IDSO Data Catalog');
lines.push('');
lines.push('Machine-generated inventory of all BigQuery datasets and tables in the `reconciliation-dashboard` project, merged with human-curated descriptions from `docs/catalog-descriptions.yaml`. The IDSO app generator reads this catalog at plan time so it can ground generated apps in real tables and columns.');
lines.push('');
lines.push('**DO NOT EDIT MANUALLY.** Regenerate with `scripts/refresh-catalog.sh` (pulls fresh schemas) or `node scripts/build-catalog.js` (rebuild from existing schemas + descriptions).');
lines.push('');
lines.push(`- Project: \`${catalog.project}\``);
lines.push(`- Generated: ${catalog.generatedAt}`);
lines.push(`- Datasets: ${dsNames.length}`);
lines.push(`- Tables: ${totalTables}`);
lines.push(`- Columns (flattened): ${totalCols}`);
lines.push('');
lines.push('## Datasets');
lines.push('');
for (const ds of dsNames) {
  const dsv = catalog.datasets[ds];
  const tblNames = Object.keys(dsv.tables).sort();
  lines.push(`### \`${ds}\` (${tblNames.length} tables)`);
  lines.push('');
  if (dsv.description) { lines.push(trim(dsv.description)); lines.push(''); }
  for (const tn of tblNames) {
    const t = dsv.tables[tn];
    const rows = t.numRows != null ? t.numRows.toLocaleString() : 'n/a';
    const typeTag = t.type === 'EXTERNAL' ? ' _(EXTERNAL)_' : '';
    lines.push(`#### \`${ds}.${tn}\`${typeTag}`);
    lines.push('');
    if (t.description) { lines.push(trim(t.description)); lines.push(''); }
    lines.push(`_${rows} rows, ${t.columns.length} columns_`);
    lines.push('');
    lines.push('| Column | Type | Mode | Description |');
    lines.push('|---|---|---|---|');
    for (const c of t.columns) {
      const desc = (c.description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| \`${c.name}\` | ${c.type} | ${c.mode} | ${desc} |`);
    }
    lines.push('');
  }
}
fs.writeFileSync(path.join(outDir, 'DATA-CATALOG.md'), lines.join('\n'));

console.log(`datasets=${dsNames.length} tables=${totalTables} cols=${totalCols}`);
console.log(`md=${fs.statSync(path.join(outDir, 'DATA-CATALOG.md')).size} bytes`);
console.log(`json=${fs.statSync(path.join(outDir, 'data-catalog.json')).size} bytes`);
