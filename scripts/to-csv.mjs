#!/usr/bin/env node
// Generates site/perpetua.csv from site/perpetua.json (the JSON is the single source of truth).
//
// Usage: node scripts/to-csv.mjs          write the CSV
//        node scripts/to-csv.mjs --check  exit 1 if the CSV is out of date (used in CI)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = join(root, 'site', 'perpetua.json');
const csvPath = join(root, 'site', 'perpetua.csv');

const COLUMNS = [
    'id', 'name', 'country', 'country_code', 'latitude', 'longitude', 'coord_precision',
    'facility_type', 'status', 'status_note', 'status_as_of', 'waste_types', 'operator',
    'source_urls', 'notes', 'last_updated'
];

function cell(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const rows = data.sites.map(site => ({
    ...site,
    waste_types: (site.waste_types || []).join('; '),
    source_urls: (site.sources || []).map(s => s.url).join(' | ')
}));

const csv = [COLUMNS.join(',')]
    .concat(rows.map(r => COLUMNS.map(c => cell(r[c])).join(',')))
    .join('\n') + '\n';

if (process.argv.includes('--check')) {
    const current = existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : '';
    if (current !== csv) {
        console.error('site/perpetua.csv is out of date: run "node scripts/to-csv.mjs" and commit the result.');
        process.exit(1);
    }
    console.log('site/perpetua.csv is up to date.');
} else {
    writeFileSync(csvPath, csv);
    console.log(`Wrote ${rows.length} rows to site/perpetua.csv`);
}
