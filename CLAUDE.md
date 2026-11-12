# Terra Perpetua

Offene, quellenbelegte Weltkarte von End- und Zwischenlagern für radioaktive (und ausgewählte hochgefährliche) Abfälle. Live unter https://terraperpetua.org. Non-Profit, Repo öffentlich.

**Dieses Repo ist öffentlich.** Keine Server-IPs, Zugangsdaten, Deploy-Keys, Analytics-IDs, Google-Sheet-Links oder privaten Notizen committen.

## Stack

- Statische Seite: `index.html`, `script.js`, `perpetua.json` (Daten), `logos/`
- Leaflet 1.9.4, OpenStreetMap-Kacheln, kein Build-Schritt, kein Backend
- Hosting: nginx auf dem Media-VPS, Webroot `/var/www/sites/terraperpetua.org/httpdocs`
- Ziel-Deploy: Webroot ist ein Git-Klon dieses Repos, Auslieferung per `git pull` (siehe Phase 0)

## Stand bei Übernahme (12.11.2026)

- Live ist der Stand vom 17.09.2025. Eine neuere Version (eigene `style.css`, Hamburger-Menü unter 768 px, Copyright-Badge mit automatischem Jahr) war geplant, wurde aber nie deployt. **Erst lokal auf Werners Mac danach suchen**, bevor neu gebaut wird.
- Daten: 54 Einträge, gepflegt in Google Sheets, manuell als JSON/CSV exportiert, letzter Stand 16./17.09.2025.
- Erledigt am 12.11.2026 auf dem Server: Logo-Rechte (Favicons lieferten 403), interne Dateien aus dem Webroot entfernt, Besitzer `www-data`.
- Analytics (Umami) wurde am 19.08.2026 entfernt; ob wieder rein, entscheidet Werner (wenn ja: selbst gehostet, cookielos, in Datenschutzerklärung).

## Phase 0: Repo und Deploy

1. Webroot vom Server holen: `scp -r media:/var/www/sites/terraperpetua.org/httpdocs/ ./` (Inhalt ins Repo-Root).
2. Lokal nach neuerer Version suchen (z. B. `mdfind -name style.css`, Ordner mit "perpetua" oder "terra" im Namen) und Unterschiede zu Werner zeigen, bevor etwas übernommen wird.
3. Repo anlegen: `gh repo create esoxconsult/terra-perpetua --public --source=. --push`.
4. Lizenzen: Code MIT, Daten (`perpetua.json`, `perpetua.csv`) CC BY 4.0. Rechteinhaber im Copyright-Vermerk mit Werner klären.
5. Server-Deploy einrichten (Werner führt Server-Befehle selbst aus, Claude Code liefert sie): eigener Deploy-Key `~/.ssh/terra_perpetua` mit SSH-Alias, Webroot durch Klon ersetzen, vorher Backup als tar. nginx muss `.git` sperren (`location ~ /\. { deny all; }`). Danach Deploy = `git pull`.

## Phase 1: Recht und Datenschutz (vor allem anderen live)

- Google Fonts, Leaflet (unpkg), Marker-Icons (raw.githubusercontent.com) und Marker-Schatten (cdnjs) **selbst hosten** unter `vendor/`. Danach lädt der Browser extern nur noch OSM-Kacheln.
- Marker-Icons als eigene SVGs oder `L.divIcon` statt Hotlink auf ein fremdes GitHub-Repo; Schatten passend zu Leaflet 1.9.4.
- Impressum (ECG § 5, MedienG § 25) und Datenschutzerklärung als eigene Seiten oder Modals; Angaben liefert Werner, nichts erfinden.
- OSM-Attribution auf https umstellen; Hinweis zu OSM-Kacheln in die Datenschutzerklärung.

## Phase 2: Technik

- nginx-Header (Snippet für Werner): HSTS, CSP ohne externe Skripte, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, Caching für `vendor/` und `logos/`.
- Mobile: Media Query unter 768 px, Panel per Button ein-/ausklappbar, Karte frei.
- Marker-Clustering (Leaflet.markercluster, selbst gehostet) oder Versatz für deckungsgleiche Punkte.
- Suche: Treffer per `flyTo` anfahren und Popup öffnen; Vorschläge stylen und auf 8 begrenzen; Enter-Taste.
- Waste-Filter dynamisch aus den Daten erzeugen (heute verschwinden Einträge, deren `waste_type` nicht in `wasteTypeOrder` steht).
- Popups ohne innerHTML aus Rohdaten (escapen bzw. DOM-Knoten), `rel="noopener"`, Linktext "Source" statt "Official Website", `last_updated` anzeigen.
- "about" als `<button>`, Modals per Esc schließbar, Fokus-Handling.
- meta description, Open-Graph-Tags, `robots.txt`, `sitemap.xml`.
- Fehleranzeige, wenn `perpetua.json` nicht lädt.

## Phase 3: Daten (Schema v2)

Ziel: `perpetua.json` ist die einzige Quelle der Wahrheit im Repo; Google Sheets entfällt. CSV wird per Skript aus JSON erzeugt.

Felder pro Eintrag:

- `id` (stabil, z. B. `DE-001`), `name`, `country`, `country_code` (ISO 3166-1 alpha-2)
- `latitude`, `longitude`, `coord_precision` (`facility` | `locality` | `region`)
- `facility_type`: `deep_geological` | `near_surface` | `interim_storage` | `reprocessing_storage` | `research_lab` | `legacy_site` | `chemical_underground`
- `status`: `operating` | `commissioning` | `under_construction` | `planned` | `dormant` | `closed` | `decommissioning` | `cancelled`
- `status_note`, `status_as_of` (ISO-Datum)
- `waste_types` (Liste): `very-low-level` | `low-level` | `intermediate-level` | `high-level` | `spent-fuel` | `transuranic` | `norm` | `chemical`
- `operator`
- `sources` (Liste von `{url, title, accessed}`), konkrete Dokumente statt Startseiten
- `last_updated`

Validierung: JSON-Schema-Datei plus Skript (`scripts/validate.mjs`), das Schema, Koordinatenbereiche, doppelte IDs und Länder-Bounding-Boxes prüft. Als GitHub Action bei jedem Push.

### Bekannte Datenfehler (Stand 12.11.2026, vor Korrektur jeweils gegen Quelle prüfen)

Status veraltet (geprüft):
- Onkalo (FI): Betriebsbewilligung der Regierung am 22.10.2026, Start noch offen → `commissioning`
- Forsmark Endlager für Brennelemente (SE): Bau seit 15.01.2025 → `under_construction`
- Dessel (BE): Bau seit 2025, erste Einheiten bis 2030 → `under_construction`
- Fehlt: Radiana bei Kozloduy (BG), nationales LILW-Endlager, in Betrieb seit April 2026
- Fehlt: Vrbina bei Krško (SI), LILW-Endlager, im Bau seit 2024, Probebetrieb geplant 2027

Koordinaten:
- Schacht Asse II: richtig 52.1286, 10.6708 (Datensatz rund 11 km daneben, geprüft)
- Vermutlich falsch, prüfen: "Aldeia" (BR) liegt in Recife, gemeint ist wohl Abadia de Goiás (Goiânia-Abfall); Domain `cnem.gov.br` → `cnen.gov.br`. El Cabril liegt bei Hornachuelos (rund 80 km falsch). Centre de la Manche liegt neben La Hague. Richard II bei Litoměřice. Schacht Konrad (Konrad 1 in Salzgitter-Bleckenstedt). "temporary storage am AKW" (DE) ist ein Platzhalter im Ruhrgebiet. Novaya Zemlya ist eine Pauschalkoordinate.

Inhaltlich, prüfen:
- "Forsmark Interim Storage, high-level": gibt es so nicht; in Forsmark liegt SFR (LILW-Endlager). Zentrales Zwischenlager ist Clab (Oskarshamn), fehlt.
- Australien "National Radioactive Facility" (Kimba): 2023 aufgegeben → `cancelled`
- Wellenberg (CH): 2002 endgültig erledigt → `cancelled`
- Indian Point: Eigentümer Holtec, nicht Exelon
- Alte Quell-Domains (z. B. rawra.cz, magnoxsites.com, llwrsite.com) auf aktuelle umstellen

Fehlende Kernstandorte: Cigéo (FR), Nördlich Lägern (CH), Revell/NWMO (CA), La Hague (FR), Clab (SE), Zwilag (CH), HABOG/COVRA (NL), TBL Gorleben und Ahaus (DE), Hanford, Savannah River, Idaho (US), Vaalputs (ZA), Runit Dome (MH), Olkiluoto und Loviisa VLJ (FI), Rokkasho LLW (JP), Novouralsk (RU), Chalk River NSDF (CA).

Umfang klären mit Werner: Kraftwerksstandorte mit Brennelementlagern entweder vollständig oder gar nicht; Vorschlag drei Ebenen (Endlager, zentrale Zwischenlager, Lager am Kraftwerk) über `facility_type`.

## Arbeitsweise

- Sprache mit Werner: Deutsch. Nur einfacher Bindestrich, keine Gedankenstriche.
- Jede Datenänderung mit Quelle; keine Koordinate oder Statusangabe aus dem Gedächtnis ohne Kennzeichnung (`coord_precision`, `status_note`).
- Kleine Commits pro Phase; Server-Befehle nie selbst ausführen, sondern Werner zum Kopieren geben.
