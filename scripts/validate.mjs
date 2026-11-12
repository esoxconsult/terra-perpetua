#!/usr/bin/env node
// Validates site/perpetua.json against schema/perpetua.schema.json plus content checks.
// No dependencies; implements the subset of JSON Schema used by our schema.
//
// Usage: node scripts/validate.mjs [path/to/perpetua.json]
// Exit code 1 on errors; warnings are printed but do not fail.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = process.argv[2] || join(root, 'site', 'perpetua.json');
const schema = JSON.parse(readFileSync(join(root, 'schema', 'perpetua.schema.json'), 'utf8'));
const bboxes = JSON.parse(readFileSync(join(root, 'scripts', 'country-bboxes.json'), 'utf8')).countries;

const errors = [];
const warnings = [];
const err = (path, msg) => errors.push(`${path}: ${msg}`);
const warn = (path, msg) => warnings.push(`${path}: ${msg}`);

// ---------- Minimal JSON Schema validator ----------

function resolveRef(ref) {
    if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref ${ref}`);
    return ref.slice(2).split('/').reduce((node, key) => node[key], schema);
}

function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (Number.isInteger(value)) return 'integer';
    return typeof value;
}

function typeMatches(value, type) {
    const actual = typeOf(value);
    if (type === 'number') return actual === 'number' || actual === 'integer';
    return actual === type;
}

function check(value, rule, path) {
    if (rule.$ref) return check(value, resolveRef(rule.$ref), path);

    if ('const' in rule && value !== rule.const) {
        err(path, `must be ${JSON.stringify(rule.const)}`);
        return;
    }
    if (rule.enum && !rule.enum.includes(value)) {
        err(path, `"${value}" is not one of: ${rule.enum.join(', ')}`);
        return;
    }
    if (rule.type) {
        const types = Array.isArray(rule.type) ? rule.type : [rule.type];
        if (!types.some(t => typeMatches(value, t))) {
            err(path, `expected ${types.join(' or ')}, got ${typeOf(value)}`);
            return;
        }
    }
    if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) err(path, `shorter than ${rule.minLength}`);
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) err(path, `"${value}" does not match ${rule.pattern}`);
        if (rule.format === 'date' && Number.isNaN(Date.parse(value))) err(path, `"${value}" is not a valid date`);
    }
    if (typeof value === 'number') {
        if ('minimum' in rule && value < rule.minimum) err(path, `below ${rule.minimum}`);
        if ('maximum' in rule && value > rule.maximum) err(path, `above ${rule.maximum}`);
    }
    if (Array.isArray(value)) {
        if (rule.minItems && value.length < rule.minItems) err(path, `needs at least ${rule.minItems} item(s)`);
        if (rule.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) err(path, 'items must be unique');
        if (rule.items) value.forEach((item, i) => check(item, rule.items, `${path}[${i}]`));
    }
    if (typeOf(value) === 'object') {
        (rule.required || []).forEach(key => {
            if (!(key in value)) err(path, `missing "${key}"`);
        });
        const props = rule.properties || {};
        Object.entries(value).forEach(([key, v]) => {
            if (props[key]) check(v, props[key], `${path}.${key}`);
            else if (rule.additionalProperties === false) err(path, `unexpected property "${key}"`);
        });
    }
}

// ---------- Content checks ----------

const BBOX_MARGIN = 0.5; // degrees
const today = new Date().toISOString().slice(0, 10);

function inCountry(cc, lat, lon) {
    const entry = bboxes[cc];
    if (!entry) return null; // unknown code, cannot check
    return entry.boxes.some(([minLon, minLat, maxLon, maxLat]) =>
        lon >= minLon - BBOX_MARGIN && lon <= maxLon + BBOX_MARGIN &&
        lat >= minLat - BBOX_MARGIN && lat <= maxLat + BBOX_MARGIN);
}

function distanceKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLon = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

let data;
try {
    data = JSON.parse(readFileSync(dataPath, 'utf8'));
} catch (e) {
    console.error(`Cannot read ${dataPath}: ${e.message}`);
    process.exit(1);
}

check(data, schema, '$');

const sites = Array.isArray(data.sites) ? data.sites : [];
const seen = new Map();

sites.forEach((site, i) => {
    const p = `sites[${i}] ${site.id || '?'}`;

    if (site.id) {
        if (seen.has(site.id)) err(p, `duplicate id (also at sites[${seen.get(site.id)}])`);
        seen.set(site.id, i);
        if (site.country_code && !site.id.startsWith(site.country_code + '-')) {
            warn(p, `id prefix differs from country_code ${site.country_code} (ok if the country changed; ids are never renamed)`);
        }
    }

    if (typeof site.latitude === 'number' && typeof site.longitude === 'number' && site.country_code !== 'XZ') {
        const ok = inCountry(site.country_code, site.latitude, site.longitude);
        if (ok === false) {
            const msg = `coordinates ${site.latitude}, ${site.longitude} outside ${site.country_code} bounding boxes`;
            // Maritime entries may lie in territorial waters or EEZ
            if (['sea_dumping', 'sunken_vessel'].includes(site.facility_type)) warn(p, msg);
            else err(p, msg);
        } else if (ok === null) {
            warn(p, `no bounding box for country_code ${site.country_code}`);
        }
    }

    if (Array.isArray(site.waste_types) && site.waste_types.length === 0 && site.facility_type !== 'research_lab') {
        err(p, 'waste_types may only be empty for research_lab entries');
    }

    ['status_as_of', 'last_updated'].forEach(k => {
        if (site[k] && site[k] > today) err(p, `${k} ${site[k]} is in the future`);
    });

    (site.sources || []).forEach((s, j) => {
        try {
            const u = new URL(s.url);
            if ((u.pathname === '/' || u.pathname === '') && !u.search) warn(`${p}.sources[${j}]`, `home page only (${s.url}); prefer a specific document`);
        } catch (e) {
            err(`${p}.sources[${j}]`, `invalid URL ${s.url}`);
        }
        if (s.accessed && s.accessed > today) err(`${p}.sources[${j}]`, 'accessed date is in the future');
    });
});

// Near-duplicate locations of the same facility type
for (let a = 0; a < sites.length; a++) {
    for (let b = a + 1; b < sites.length; b++) {
        const A = sites[a], B = sites[b];
        if (A.facility_type === B.facility_type && typeof A.latitude === 'number' && typeof B.latitude === 'number' &&
            distanceKm(A, B) < 0.2) {
            warn(`${A.id} / ${B.id}`, `same facility_type within 200 m: possible duplicate`);
        }
    }
}

warnings.forEach(w => console.warn(`warning  ${w}`));
errors.forEach(e => console.error(`ERROR    ${e}`));
console.log(`\n${sites.length} sites, ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
