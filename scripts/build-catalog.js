#!/usr/bin/env node
// Build docs/DATA-CATALOG.md and docs/data-catalog.json from bq show JSON files.
// Env vars: SCHEMAS_DIR (input) and OUT_DIR (output). Defaults match scripts/refresh-catalog.sh.
const fs = require('fs');
const path = require('path');

const schemasDir = process.env.SCHEMAS_DIR || '/tmp/catalog/schemas';
const outDir = process.env.OUT_DIR || path.resolve(__dirname, '..', 'docs');
const project = process.env.PROJECT || 'reconciliation-dashboard';

if (!fs.existsSync(schemasDir)) {
  console.error(`SCHEMAS_DIR does not exist: ${schemasDir}`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json')).sort();
const catalog = { project, generatedAt: new Date().toISOString(), datasets: {} };

function flattenFields(fields, prefix = '') {
  const out = [];
  for (const f of (fields || [])) {
    const name = prefix ? `${prefix}.${f.name}` : f.name;
    out.push({ name, type: f.type, mode: f.mode || 'NULLABLE', description: f.description || null });
    if (f.type === 'RECORD' && f.fields) out.push(...flattenFields(f.fields, name));
  }
  return out;
}

for (const file of files) {
  const j = JSON.parse(fs.readFileSync(path.join(schemasDir, file), 'utf8'));
  const ds = j.tableReference.datasetId;
  const tbl = j.tableReference.tableId;
  if (!catalog.datasets[ds]) catalog.datasets[ds] = { tables: {} };
  catalog.datasets[ds].tables[tbl] = {
    tableId: tbl,
    type: j.type || 'TABLE',
    description: j.description || null,
    numRows: j.numRows ? Number(j.numRows) : null,
    numBytes: j.numBytes ? Number(j.numBytes) : null,
    lastModifiedTime: j.lastModifiedTime ? new Date(Number(j.lastModifiedTime)).toISOString() : null,
    location: j.location || null,
    columns: flattenFields(j.schema && j.schema.fields)
  };
}

fs.writeFileSync(path.join(outDir, 'data-catalog.json'), JSON.stringify(catalog, null, 2));

const dsNames = Object.keys(catalog.datasets).sort();
let totalTables = 0, totalCols = 0;
for (const ds of dsNames) {
  totalTables += Object.keys(catalog.datasets[ds].tables).length;
  for (const t of Object.values(catalog.datasets[ds].tables)) totalCols += t.columns.length;
}

const lines = [];
lines.push('# IDSO Data Catalog');
lines.push('');
lines.push('Machine-generated inventory of all BigQuery datasets and tables in the `reconciliation-dashboard` project. The IDSO app generator reads this catalog at plan time so it can ground generated apps in real tables and columns instead of hallucinating them.');
lines.push('');
lines.push('**DO NOT EDIT MANUALLY.** Regenerate with `scripts/refresh-catalog.sh`.');
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
  const tables = catalog.datasets[ds].tables;
  const tblNames = Object.keys(tables).sort();
  lines.push(`### \`${ds}\` (${tblNames.length} tables)`);
  lines.push('');
  for (const tn of tblNames) {
    const t = tables[tn];
    const rows = t.numRows != null ? t.numRows.toLocaleString() : 'n/a';
    const typeTag = t.type === 'EXTERNAL' ? ' _(EXTERNAL)_' : '';
    lines.push(`#### \`${ds}.${tn}\`${typeTag}`);
    lines.push('');
    if (t.description) lines.push(`> ${t.description}`);
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
