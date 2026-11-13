# Terra Perpetua

Offene, quellenbelegte Weltkarte von Standorten radioaktiver (und ausgewählter hochgefährlicher) Abfälle: Endlager, Zwischenlager, Brennelementlager an Kraftwerken, Wiederaufarbeitung, Forschung und Altlasten. Live unter https://terraperpetua.org. Non-Profit, Medieninhaber Esox Consult GmbH, Repo öffentlich.

**Dieses Repo ist öffentlich.** Keine Server-IPs, Zugangsdaten, Deploy-Keys, Analytics-IDs, Google-Sheet-Links oder privaten Notizen committen.

## Stack

- Statische Seite unter `site/`: `index.html`, `style.css`, `script.js`, `perpetua.json` (Daten), `perpetua.csv` (generiert), `legal-notice.html`, `privacy.html`, `legal.css`, `logos/`, `vendor/`, `robots.txt`, `sitemap.xml`
- `impressum.html` und `datenschutz.html` sind nur Weiterleitungen auf die englischen Seiten
- Leaflet 1.9.4 und Leaflet.markercluster 1.5.3, Montserrat; alles selbst gehostet unter `site/vendor/` (Versionen und Lizenzen in `site/vendor/README.md`). Extern lädt der Browser nur OSM-Kacheln.
- Kein Build-Schritt, kein Backend, keine Abhängigkeiten. Marker sind Inline-SVG (`L.DivIcon` mit Schatten), Farbe = Status, Symbol = Kategorie.
- Details: am Desktop ein Leaflet-Popup, auf Phones (unter 768 px) eine Detailkarte von unten (`#detail-sheet`), Pin rückt ins obere Drittel. Keine `maxBounds` setzen: sie blockieren das Auto-Pan von Popups.
- Bei Änderungen an `style.css` oder `script.js` die Versionsnummer `?v=` in `index.html` erhöhen (Cache).
- Logo: `site/logos/terra-perpetua-mark.svg` (Hauptmarke), `terra-perpetua-favicon.svg` (vereinfacht für 16-48 px), PNGs 16/32/180/192/512, Vorschaubild `terra-perpetua-og.png` (1200x630). Name und Logo sind von den Lizenzen ausgenommen.

## Hosting und Deploy

- nginx auf dem Media-VPS. `httpdocs` ist ein Symlink auf `repo/site` eines Klons dieses Repos; `.git` liegt damit außerhalb des Webroots. Details in `deploy/README.md`.
- Deploy nach Merge in `main`: `git -C /var/www/sites/terraperpetua.org/repo pull --ff-only`
- nginx-Snippet `deploy/nginx/terraperpetua.conf` (HSTS, CSP ohne externe Skripte und ohne `unsafe-inline`, nosniff, Referrer-Policy, Permissions-Policy, gzip, Caching). Es wird nach `/etc/nginx/snippets/` kopiert, nicht verlinkt; nach Änderungen neu kopieren. CSP erlaubt Bilder nur von `self`, `data:` und `tile.openstreetmap.org`: keine Inline-Styles im HTML, keine externen Ressourcen einbauen.
- **Server-Befehle nie selbst ausführen**, sondern Werner zum Kopieren geben.

## Daten (Schema v2)

`site/perpetua.json` ist die einzige Quelle der Wahrheit. Schema: `schema/perpetua.schema.json`. Nach jeder Änderung:

```bash
node scripts/validate.mjs && node scripts/to-csv.mjs
```

Die GitHub Action prüft Schema, IDs, Daten, Länder-Bounding-Boxes (Natural Earth, plus Atoll-Rahmen für MH und PF) und ob die CSV aktuell ist.

- Datei: `{schema_version: 2, license, attribution, generated, sites: [...]}`
- Felder: `id` (Ländercode plus drei Ziffern, `XZ` = internationale Gewässer; **nie umbenennen oder wiederverwenden**), `name`, `country`, `country_code`, `latitude`, `longitude`, `coord_precision` (`facility` | `locality` | `region`), `facility_type`, `status`, `status_note`, `status_as_of`, `waste_types`, `operator`, `sources` (`{url, title, accessed}`), `last_updated`, optional `notes`
- `facility_type`: `deep_geological` | `near_surface` | `interim_storage` (zentral) | `at_reactor_storage` | `reprocessing_storage` | `military_production` | `research_lab` | `chemical_underground` | `accident_site` | `test_site` | `sea_dumping` | `sunken_vessel` | `uranium_legacy` | `legacy_site`
- `status`: `operating` | `commissioning` | `under_construction` | `planned` | `dormant` | `closed` | `decommissioning` | `cancelled` | `remediation` | `abandoned`
- `waste_types`: `very-low-level` | `low-level` | `intermediate-level` | `high-level` | `spent-fuel` | `transuranic` | `norm` | `chemical`; leer nur bei Forschungsstandorten ohne Abfall und bei `closed`, `cancelled`, `planned` oder `dormant`, wenn kein Abfall (mehr) vorhanden ist
- `notes` ist öffentlich (im Popup sichtbar): nur Hinweise zur Datenqualität für Leser, max. ca. 220 Zeichen, keine internen Arbeitsnotizen
- Datentexte in britischem Englisch

Stand 12.11.2026: 547 Standorte in 65 Ländern und Gebieten.

### Regeln für Datenänderungen

- Jede Änderung mit konkreter, tatsächlich geöffneter Quelle (keine Startseiten). Keine Koordinate oder Statusangabe aus dem Gedächtnis; Unsicherheit über `coord_precision` und `notes` kennzeichnen.
- Kraftwerksstandorte mit Brennelementlagern werden vollständig erfasst, ein Eintrag pro Standort (Brennstoff muss einmal geladen worden sein). Benachbarte Blöcke desselben Betreibers in einem Eintrag.
- Kraftwerkskoordinaten aus Wikidata (CC0). Keine Übernahme aus ODbL- oder CC-BY-SA-Datenbanken (z. B. GeoNuclearData, Wikipedia-Tabellen), weil die Daten unter CC BY 4.0 stehen. Einzelne Koordinaten aus Wikipedia oder einem OSM-Objekt sind erlaubt, wenn die Seite als Quelle zitiert wird.

### Bekannte offene Punkte

- Belgien: Inbetriebnahme der SF2-Trockenlager in Doel und Tihange nicht bestätigt (Electrabel- und FANC-Seiten waren nicht erreichbar).
- Rund ein Drittel der Einträge hat nur Orts- oder Regionsgenauigkeit; bei Altlasten ist oft Wikipedia die Hauptquelle.
- Nicht aufgenommen mangels belastbarer Quelle, u. a.: Dimona, Pantex, Angarsk, Petten, Capenhurst, Springfields, Zhovti Vody, Armenien.
- Schnell veränderlich (vor Ankündigungen prüfen): Onkalo, Rokkasho, Fugen, US-Wiederinbetriebnahmen (Palisades, Duane Arnold, Crane), Dungeness B, Holtec HI-STORE, russische NO-RAO-Anlagen.

## Pflege

- Eine vierteljährliche Datenprüfung läuft als geplante Aufgabe (3. Februar, Mai, August, November): sie prüft schnell veränderliche und lange nicht bestätigte Einträge und legt einen PR an, ohne zu mergen.
- Analytics: keine. Falls gewünscht, nur selbst gehostet und cookielos, mit Eintrag in `privacy.html`; Entscheidung bei Werner.

## Arbeitsweise

- Sprache mit Werner: Deutsch. Nur einfacher Bindestrich, keine Gedankenstriche.
- Arbeit auf einem Branch, PR nach `main`, Merge nur nach Werners Zustimmung; danach Deploy-Befehl für Werner nennen.
- Kleine Commits; vor dem PR `validate.mjs` und einen Browsertest mit den CSP-Headern aus dem Snippet (Desktop und Phone).
