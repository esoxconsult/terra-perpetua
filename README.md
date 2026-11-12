# Terra Perpetua

Open, source-backed world map of repositories and interim storage facilities for radioactive (and selected other high-hazard) waste.

Live: https://terraperpetua.org

## Structure

- `site/` is the web root: `index.html`, `style.css`, `script.js`, `perpetua.json` (data), `perpetua.csv` (generated), `logos/`, `vendor/`
- `schema/perpetua.schema.json`: data schema (v2)
- `scripts/validate.mjs`: validation (schema, coordinates, duplicate ids, country bounding boxes); `scripts/to-csv.mjs`: generates the CSV
- `deploy/`: server notes and the nginx snippet

## Editing data

`site/perpetua.json` is the single source of truth. After every change:

```bash
node scripts/validate.mjs && node scripts/to-csv.mjs
```

Every fact needs a specific source (`sources`), every entry a `status_as_of` date. Ids are never renamed or reused.
- Static site, no build step, no backend. Leaflet 1.9.4 and all fonts are self-hosted under `site/vendor/`; the only external requests from the browser go to the OpenStreetMap tile servers.

## Licences

| Part | Licence |
|---|---|
| Code (HTML, CSS, JavaScript, scripts) | [MIT](LICENSE), Copyright (c) 2025-2026 Terra Perpetua contributors |
| Data (`site/perpetua.json`, `site/perpetua.csv`) | [CC BY 4.0](LICENSE-DATA) |
| Name "Terra Perpetua" and logos (`site/logos/`) | All rights reserved, see below |
| Third-party components (`site/vendor/`) | Their own licences, see `site/vendor/README.md` |

### Attribution for the data

When reusing the data, please credit:

> Terra Perpetua contributors, terraperpetua.org, CC BY 4.0

Individual entries cite their original sources (field `sources`); facts from those sources are not ours to license. Coordinates of nuclear power plants are based on [Wikidata](https://www.wikidata.org/) (CC0).

### Name and logo

The name "Terra Perpetua" and the logo files in `site/logos/` are excluded from the MIT and CC BY licences. They may not be used to imply endorsement or for derived projects without permission. Forks should use their own name and logo.

## Contact

terra@terraperpetua.org
