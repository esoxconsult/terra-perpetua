'use strict';

(function () {

    // ---------- Configuration ----------

    // Status: label and marker colour (order = filter order)
    const STATUSES = {
        operating:          { label: 'operating',          color: '#2a81cb' },
        commissioning:      { label: 'commissioning',      color: '#1b9e9e' },
        under_construction: { label: 'under construction', color: '#cb8427' },
        planned:            { label: 'planned',            color: '#e0b400' },
        dormant:            { label: 'dormant',            color: '#cb2b3e' },
        decommissioning:    { label: 'decommissioning',    color: '#3d3d3d' },
        closed:             { label: 'closed',             color: '#7b7b7b' },
        cancelled:          { label: 'cancelled',          color: '#b9b9b9' },
        remediation:        { label: 'remediation',        color: '#8e44ad' },
        abandoned:          { label: 'abandoned',          color: '#7a1f1f' }
    };
    const FALLBACK_STATUS = { label: 'unknown', color: '#2a81cb' };

    // Facility types: label and category (order = popup wording)
    const FACILITY_TYPES = {
        deep_geological:      { label: 'Deep geological repository',              category: 'repository' },
        near_surface:         { label: 'Near-surface disposal facility',          category: 'repository' },
        chemical_underground: { label: 'Underground disposal of chemical waste',  category: 'repository' },
        interim_storage:      { label: 'Central interim storage',                 category: 'interim' },
        at_reactor_storage:   { label: 'Spent fuel storage at a power plant',     category: 'reactor' },
        reprocessing_storage: { label: 'Reprocessing plant and waste stores',     category: 'production' },
        military_production:  { label: 'Military production complex',            category: 'production' },
        research_lab:         { label: 'Research laboratory or centre',           category: 'research' },
        accident_site:        { label: 'Accident site',                           category: 'accident' },
        test_site:            { label: 'Nuclear weapons test site',               category: 'accident' },
        legacy_site:          { label: 'Legacy site',                             category: 'accident' },
        sea_dumping:          { label: 'Sea dumping area',                        category: 'sea' },
        sunken_vessel:        { label: 'Sunken nuclear vessel',                   category: 'sea' },
        uranium_legacy:       { label: 'Uranium mining and milling legacy',       category: 'uranium' }
    };

    // Filter categories with the glyph drawn inside the pin (order = filter order)
    const CATEGORIES = {
        repository: { label: 'Repositories (disposal)',            glyph: 'triangleDown' },
        interim:    { label: 'Central interim storage',            glyph: 'square' },
        reactor:    { label: 'Spent fuel at power plants',         glyph: 'dot' },
        production: { label: 'Reprocessing & military production', glyph: 'diamond' },
        research:   { label: 'Research labs & centres',            glyph: 'ring' },
        accident:   { label: 'Accidents, tests & other legacy',    glyph: 'cross' },
        sea:        { label: 'Sea dumping & sunken vessels',       glyph: 'wave' },
        uranium:    { label: 'Uranium mining legacy',              glyph: 'triangleUp' }
    };

    const WASTE_TYPES = {
        'very-low-level':     'very low-level',
        'low-level':          'low-level',
        'intermediate-level': 'intermediate-level',
        'high-level':         'high-level',
        'spent-fuel':         'spent fuel',
        'transuranic':        'transuranic',
        'norm':               'NORM (mining residues)',
        'chemical':           'chemical'
    };

    const PRECISION_NOTE = {
        facility: null,
        locality: 'Location approximate (town or area level).',
        region: 'Location only approximate (region level).'
    };

    const MAX_SUGGESTIONS = 8;
    const MOBILE_QUERY = window.matchMedia('(max-width: 767.98px)');

    // ---------- DOM ----------

    const $ = id => document.getElementById(id);
    const searchInput = $('search-input');
    const searchButton = $('search-button');
    const suggestionList = $('autocomplete-results');
    const searchInfo = $('search-info');
    const categoryFilters = $('category-filters');
    const statusFilters = $('status-filters');
    const wasteFilters = $('waste-filters');
    const statusMessage = $('status-message');
    const panelToggle = $('panel-toggle');
    const siteCount = $('site-count');

    // ---------- Marker graphics (constant SVG, no data inside) ----------

    const GLYPHS = {
        dot:          '<circle cx="12.5" cy="12.5" r="4.6" fill="#fff"/>',
        ring:         '<circle cx="12.5" cy="12.5" r="4.2" fill="none" stroke="#fff" stroke-width="2.2"/>',
        square:       '<rect x="8.4" y="8.4" width="8.2" height="8.2" fill="#fff"/>',
        diamond:      '<path d="M12.5 6.7 18.3 12.5 12.5 18.3 6.7 12.5Z" fill="#fff"/>',
        triangleDown: '<path d="M7 9h11l-5.5 9z" fill="#fff"/>',
        triangleUp:   '<path d="M7 16.5h11l-5.5-9z" fill="#fff"/>',
        cross:        '<path d="M8.6 8.6l7.8 7.8M16.4 8.6l-7.8 7.8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>',
        wave:         '<path d="M7 11.2c1.4-1.6 2.7-1.6 4.1 0s2.7 1.6 4.1 0 2.1-1.2 2.8-.6M7 15.2c1.4-1.6 2.7-1.6 4.1 0s2.7 1.6 4.1 0 2.1-1.2 2.8-.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>'
    };

    function shade(hex, factor) {
        const n = parseInt(hex.slice(1), 16);
        const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * factor));
        return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    }

    function pinSvg(color, glyph, size) {
        const w = size || 25;
        const h = Math.round(w * 41 / 25);
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 25 41" aria-hidden="true" focusable="false">` +
            `<path d="M12.5.75C6 .75.75 6 .75 12.5c0 2.4.7 4.6 1.9 6.5L12.5 40.2l9.85-21.2c1.2-1.9 1.9-4.1 1.9-6.5C24.25 6 19 .75 12.5.75z" fill="${color}" stroke="${shade(color, 0.72)}" stroke-width="1.5"/>` +
            GLYPHS[glyph] + '</svg>';
    }

    // DivIcon with the regular Leaflet shadow (L.DivIcon.createShadow returns null)
    const PinIcon = L.DivIcon.extend({ createShadow: L.Icon.prototype.createShadow });

    const iconCache = new Map();
    function iconFor(statusKey, categoryKey) {
        const key = statusKey + '|' + categoryKey;
        if (!iconCache.has(key)) {
            const status = STATUSES[statusKey] || FALLBACK_STATUS;
            const glyph = (CATEGORIES[categoryKey] || CATEGORIES.repository).glyph;
            iconCache.set(key, new PinIcon({
                className: 'tp-marker',
                html: pinSvg(status.color, glyph),
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                tooltipAnchor: [16, -28],
                shadowUrl: 'vendor/leaflet-1.9.4/images/marker-shadow.png',
                shadowSize: [41, 41],
                shadowAnchor: [12, 41]
            }));
        }
        return iconCache.get(key);
    }

    // ---------- Map ----------

    const map = L.map('map', { zoomControl: false, worldCopyJump: true }).setView([35, 10], 3);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const cluster = L.markerClusterGroup({
        maxClusterRadius: 45,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true
    });
    map.addLayer(cluster);

    // ---------- State ----------

    let sites = [];          // [{ data, status, category, marker, searchText }]
    let textFilter = '';
    let suggestions = [];
    let activeSuggestion = -1;

    // ---------- Helpers ----------

    function isHttpUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' || url.protocol === 'http:';
        } catch (e) {
            return false;
        }
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function showMessage(text) {
        statusMessage.textContent = text;
        statusMessage.hidden = false;
    }

    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso + 'T00:00:00Z');
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }

    // ---------- Popups (DOM nodes only, never innerHTML from data) ----------

    function addRow(parent, label, value) {
        if (!value) return;
        const p = el('p');
        p.appendChild(el('strong', null, `${label}: `));
        p.appendChild(document.createTextNode(value));
        parent.appendChild(p);
    }

    function buildPopup(site) {
        const root = el('div', 'site-popup');
        const type = FACILITY_TYPES[site.facility_type];
        const status = STATUSES[site.status] || FALLBACK_STATUS;

        root.appendChild(el('p', 'popup-type', type ? type.label : site.facility_type));
        root.appendChild(el('h3', null, site.name || 'Unnamed site'));

        const badge = el('p', 'popup-status');
        const dot = el('span', 'status-dot');
        dot.style.backgroundColor = status.color; // CSSOM, allowed under CSP
        badge.appendChild(dot);
        badge.appendChild(document.createTextNode(status.label));
        if (site.status_as_of) badge.appendChild(el('span', 'popup-asof', ` (as of ${formatDate(site.status_as_of)})`));
        root.appendChild(badge);

        if (site.status_note) root.appendChild(el('p', 'popup-note', site.status_note));

        addRow(root, 'Country', site.country);
        addRow(root, 'Operator', site.operator);
        const waste = (site.waste_types || []).map(w => WASTE_TYPES[w] || w).join(', ');
        const noWaste = site.facility_type === 'research_lab' ? 'none stored on site'
            : site.status === 'planned' ? 'none yet'
            : 'none known to remain on site';
        addRow(root, 'Waste', waste || noWaste);

        const precision = PRECISION_NOTE[site.coord_precision];
        if (precision) root.appendChild(el('p', 'popup-precision', precision));
        if (site.notes) root.appendChild(el('p', 'popup-precision', site.notes));

        const sources = (site.sources || []).filter(s => isHttpUrl(s.url));
        if (sources.length) {
            root.appendChild(el('p', 'popup-sources-title', sources.length === 1 ? 'Source' : 'Sources'));
            const list = el('ul', 'popup-sources');
            sources.forEach(s => {
                const li = el('li');
                const a = el('a', null, s.title || new URL(s.url).hostname);
                a.href = s.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                li.appendChild(a);
                list.appendChild(li);
            });
            root.appendChild(list);
        }

        const coords = el('p', 'popup-coords');
        const lat = Number(site.latitude), lon = Number(site.longitude);
        coords.appendChild(document.createTextNode(`${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'} · `));
        const osm = el('a', null, 'OpenStreetMap');
        osm.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`;
        osm.target = '_blank';
        osm.rel = 'noopener noreferrer';
        coords.appendChild(osm);
        root.appendChild(coords);

        const footer = el('p', 'popup-updated');
        footer.appendChild(document.createTextNode(`ID ${site.id}` + (site.last_updated ? ` · last updated ${formatDate(site.last_updated)}` : '') + ' · '));
        const link = el('a', null, 'link to this site');
        link.href = `#${encodeURIComponent(site.id)}`;
        link.title = 'Direct link to this site (copy the address)';
        footer.appendChild(link);
        root.appendChild(footer);

        return root;
    }

    // ---------- Filters ----------

    function addCheckbox(container, prefix, value, label, count, swatchHtml) {
        const wrapper = el('label', 'filter-item');
        const input = el('input');
        input.type = 'checkbox';
        input.id = `${prefix}-${value}`;
        input.value = value;
        input.checked = true;
        input.addEventListener('change', updateMap);
        wrapper.htmlFor = input.id;
        wrapper.appendChild(input);

        if (swatchHtml) {
            const swatch = el('span', 'filter-swatch');
            swatch.setAttribute('aria-hidden', 'true');
            swatch.innerHTML = swatchHtml; // constant markup from this file, not from data
            wrapper.appendChild(swatch);
        }
        wrapper.appendChild(document.createTextNode(label + ' '));
        wrapper.appendChild(el('span', 'filter-count', `(${count})`));
        container.appendChild(wrapper);
    }

    function addGroupToggle(container) {
        const btn = el('button', 'filter-all', 'select none');
        btn.type = 'button';
        btn.addEventListener('click', () => {
            const boxes = Array.from(container.querySelectorAll('input[type=checkbox]'));
            const allOn = boxes.every(b => b.checked);
            boxes.forEach(b => { b.checked = !allOn; });
            btn.textContent = allOn ? 'select all' : 'select none';
            updateMap();
        });
        container.appendChild(btn);
    }

    function generateFilters() {
        const count = (fn) => {
            const m = new Map();
            sites.forEach(s => [].concat(fn(s)).forEach(v => m.set(v, (m.get(v) || 0) + 1)));
            return m;
        };

        const byCategory = count(s => s.category);
        Object.entries(CATEGORIES).forEach(([key, c]) => {
            if (byCategory.has(key)) addCheckbox(categoryFilters, 'cat', key, c.label, byCategory.get(key), pinSvg('#3c4f58', c.glyph, 14));
        });

        const byStatus = count(s => s.status);
        Object.entries(STATUSES).forEach(([key, s]) => {
            if (byStatus.has(key)) addCheckbox(statusFilters, 'status', key, s.label, byStatus.get(key), `<span class="color-dot" data-color="${key}"></span>`);
        });
        // colour the status dots via CSSOM (no inline style attributes)
        statusFilters.querySelectorAll('.color-dot').forEach(d => { d.style.backgroundColor = STATUSES[d.dataset.color].color; });

        const byWaste = count(s => s.data.waste_types || []);
        Object.entries(WASTE_TYPES).forEach(([key, label]) => {
            if (byWaste.has(key)) addCheckbox(wasteFilters, 'waste', key, label, byWaste.get(key), null);
        });

        [categoryFilters, statusFilters, wasteFilters].forEach(addGroupToggle);
    }

    function checkedValues(container) {
        return new Set(Array.from(container.querySelectorAll('input:checked')).map(i => i.value));
    }

    function ensureVisible(site) {
        [[categoryFilters, 'cat', [site.category]], [statusFilters, 'status', [site.status]], [wasteFilters, 'waste', site.data.waste_types || []]]
            .forEach(([container, prefix, values]) => {
                const any = values.some(v => { const i = $(`${prefix}-${v}`); return i && i.checked; });
                if (!any && values.length) { const i = $(`${prefix}-${values[0]}`); if (i) i.checked = true; }
            });
    }

    // ---------- Map update ----------

    function matchesText(site, term) {
        return term === '' || site.searchText.includes(term);
    }

    function visibleSites() {
        const cats = checkedValues(categoryFilters);
        const statuses = checkedValues(statusFilters);
        const wastes = checkedValues(wasteFilters);
        return sites.filter(s =>
            cats.has(s.category) &&
            statuses.has(s.status) &&
            // sites without waste (research labs) are not affected by the waste filter
            (!(s.data.waste_types || []).length || s.data.waste_types.some(w => wastes.has(w))) &&
            matchesText(s, textFilter));
    }

    function updateMap() {
        const visible = visibleSites();
        cluster.clearLayers();
        cluster.addLayers(visible.map(s => s.marker));
        siteCount.textContent = `${visible.length} of ${sites.length} sites shown`;
        searchInfo.textContent = textFilter
            ? (visible.length === 1 ? '1 site found' : `${visible.length} sites found`)
            : '';
        return visible;
    }

    // ---------- Search ----------

    function closeSuggestions() {
        suggestionList.replaceChildren();
        suggestionList.hidden = true;
        searchInput.setAttribute('aria-expanded', 'false');
        searchInput.removeAttribute('aria-activedescendant');
        suggestions = [];
        activeSuggestion = -1;
    }

    function setActiveSuggestion(index) {
        const items = suggestionList.children;
        if (!items.length) return;
        activeSuggestion = (index + items.length) % items.length;
        Array.from(items).forEach((item, i) => {
            const active = i === activeSuggestion;
            item.classList.toggle('active', active);
            item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        searchInput.setAttribute('aria-activedescendant', items[activeSuggestion].id);
        items[activeSuggestion].scrollIntoView({ block: 'nearest' });
    }

    function showSuggestions() {
        const term = searchInput.value.trim().toLowerCase();
        closeSuggestions();

        if (term === '') {
            if (textFilter) {
                textFilter = '';
                updateMap();
            }
            return;
        }

        // Name matches first, then country/operator matches
        const matches = sites.filter(s => matchesText(s, term));
        matches.sort((a, b) => {
            const an = a.data.name.toLowerCase().includes(term) ? 0 : 1;
            const bn = b.data.name.toLowerCase().includes(term) ? 0 : 1;
            return an - bn || a.data.name.localeCompare(b.data.name);
        });
        suggestions = matches.slice(0, MAX_SUGGESTIONS);
        if (!suggestions.length) return;

        suggestions.forEach((site, i) => {
            const li = el('li', 'autocomplete-item', site.data.name + ' ');
            li.id = `suggestion-${i}`;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.appendChild(el('small', null, `(${site.data.country})`));
            li.addEventListener('mousedown', event => {
                event.preventDefault();
                selectSite(site);
            });
            suggestionList.appendChild(li);
        });

        suggestionList.hidden = false;
        searchInput.setAttribute('aria-expanded', 'true');
    }

    function closePanelOnMobile() {
        if (MOBILE_QUERY.matches) setPanelOpen(false);
    }

    function flyToSite(site) {
        const target = Math.max(map.getZoom(), 9);
        const open = () => cluster.zoomToShowLayer(site.marker, () => site.marker.openPopup());
        if (map.getZoom() >= target && map.getBounds().contains(site.marker.getLatLng())) {
            open();
        } else {
            map.once('moveend', open);
            map.flyTo(site.marker.getLatLng(), target, { duration: 1.2 });
        }
    }

    function selectSite(site) {
        searchInput.value = site.data.name;
        closeSuggestions();
        ensureVisible(site);
        textFilter = '';
        updateMap();
        closePanelOnMobile();
        flyToSite(site);
    }

    function runSearch() {
        if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
            selectSite(suggestions[activeSuggestion]);
            return;
        }

        closeSuggestions();
        textFilter = searchInput.value.trim().toLowerCase();
        const visible = updateMap();
        if (!textFilter || !visible.length) return;

        closePanelOnMobile();
        if (visible.length === 1) {
            flyToSite(visible[0]);
        } else {
            map.flyToBounds(L.latLngBounds(visible.map(s => s.marker.getLatLng())), {
                padding: [40, 40],
                maxZoom: 9
            });
        }
    }

    searchInput.addEventListener('input', showSuggestions);
    searchInput.addEventListener('keydown', event => {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                if (suggestionList.hidden) showSuggestions();
                setActiveSuggestion(activeSuggestion + 1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                setActiveSuggestion(activeSuggestion - 1);
                break;
            case 'Enter':
                event.preventDefault();
                runSearch();
                break;
            case 'Escape':
                if (!suggestionList.hidden) {
                    event.preventDefault();
                    event.stopPropagation();
                    closeSuggestions();
                }
                break;
        }
    });
    searchInput.addEventListener('blur', () => setTimeout(closeSuggestions, 100));
    searchButton.addEventListener('click', runSearch);

    // ---------- Mobile panel ----------

    function setPanelOpen(open) {
        document.body.classList.toggle('panel-open', open);
        panelToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    panelToggle.addEventListener('click', () => {
        setPanelOpen(!document.body.classList.contains('panel-open'));
    });

    // ---------- About modal ----------

    const infoBox = $('info-box');
    const aboutButton = $('about-link');
    const closeButton = infoBox.querySelector('.close-btn');
    let lastFocused = null;

    function focusableIn(element) {
        return Array.from(element.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'));
    }

    function openModal() {
        lastFocused = document.activeElement;
        infoBox.hidden = false;
        closeButton.focus();
    }

    function closeModal() {
        infoBox.hidden = true;
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    aboutButton.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    infoBox.addEventListener('click', event => {
        if (event.target === infoBox) closeModal();
    });

    document.addEventListener('keydown', event => {
        if (infoBox.hidden) {
            if (event.key === 'Escape' && MOBILE_QUERY.matches && document.body.classList.contains('panel-open')) {
                setPanelOpen(false);
                panelToggle.focus();
            }
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
        } else if (event.key === 'Tab') {
            const items = focusableIn(infoBox);
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    // ---------- Data ----------

    function prepareSites(data) {
        const list = Array.isArray(data) ? data : data && data.sites;
        if (!Array.isArray(list)) throw new Error('perpetua.json has no site list');

        const result = [];
        list.forEach(site => {
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                console.warn('Skipping entry without valid coordinates:', site.id);
                return;
            }
            const type = FACILITY_TYPES[site.facility_type];
            const category = type ? type.category : 'accident';
            const status = STATUSES[site.status] ? site.status : 'operating';
            const marker = L.marker([lat, lng], {
                icon: iconFor(status, category),
                title: site.name || '',
                alt: site.name || 'Site marker',
                keyboard: true
            });
            marker.bindPopup(() => buildPopup(site), { maxWidth: 340, autoPanPaddingTopLeft: [20, 70] });
            marker.on('popupopen', () => {
                if (location.hash !== '#' + site.id) history.replaceState(null, '', '#' + encodeURIComponent(site.id));
            });
            marker.on('popupclose', () => {
                if (location.hash === '#' + site.id) history.replaceState(null, '', location.pathname + location.search);
            });
            result.push({
                data: site,
                status: status,
                category: category,
                marker: marker,
                searchText: `${site.name || ''} ${site.country || ''} ${site.operator || ''}`.toLowerCase()
            });
        });
        return result;
    }

    // Deep links: terraperpetua.org/#DE-002 opens that site
    function openFromHash() {
        const id = decodeURIComponent(location.hash.slice(1));
        if (!id) return false;
        const site = sites.find(s => s.data.id === id);
        if (!site) return false;
        ensureVisible(site);
        updateMap();
        map.setView(site.marker.getLatLng(), 9, { animate: false });
        cluster.zoomToShowLayer(site.marker, () => site.marker.openPopup());
        return true;
    }

    // Initial view: all sites, leaving room for the panel on wide screens
    function fitToSites() {
        if (!sites.length) return;
        const bounds = L.latLngBounds(sites.map(s => s.marker.getLatLng()));
        const wide = !MOBILE_QUERY.matches;
        map.fitBounds(bounds, {
            paddingTopLeft: wide ? [360, 20] : [10, 70],
            paddingBottomRight: [20, 20],
            maxZoom: 5
        });
    }

    fetch('perpetua.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            sites = prepareSites(data);
            generateFilters();
            updateMap();
            if (!openFromHash()) fitToSites();
            window.addEventListener('hashchange', openFromHash);
        })
        .catch(error => {
            console.error('Error loading the data:', error);
            showMessage('The map data could not be loaded. Please reload the page or try again later.');
        });

})();
