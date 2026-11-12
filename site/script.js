'use strict';

(function () {

    // ---------- Configuration ----------

    // Raw status values in the data -> standardised status shown in the filter
    const STATUS_MAPPING = {
        'under construction / planned commissioning': 'under construction',
        'under construction': 'under construction',
        'planned / licensing process underway': 'planned',
        'planned': 'planned',
        'in operation (research)': 'in operation',
        'in operation (temporary storage)': 'in operation',
        'in operation': 'in operation',
        'currently dormant': 'currently dormant',
        'closed (decontamination)': 'closed',
        'closed (historis)': 'closed',
        'closed': 'closed',
        'decommissioning': 'decommissioning',
        'out of operation (decomissioning)': 'decommissioning'
    };

    // Display order of the status filter; unknown statuses are appended
    const STATUS_ORDER = [
        'in operation',
        'under construction',
        'planned',
        'currently dormant',
        'decommissioning',
        'closed'
    ];

    // Standardised status -> marker colour (icons/marker-<colour>.svg, CSS .dot-<colour>)
    const STATUS_COLORS = {
        'under construction': 'orange',
        'planned': 'gold',
        'in operation': 'blue',
        'currently dormant': 'red',
        'closed': 'grey',
        'decommissioning': 'black'
    };
    const DEFAULT_COLOR = 'blue';

    // Preferred display order of the waste filter. Waste types found in the data
    // but missing here are appended alphabetically, so no entry ever disappears.
    const WASTE_ORDER = [
        'low-level',
        'low- and intermediate-level',
        'high-level',
        'high-level (exploration)',
        'mixed waste',
        'research',
        'transuranic'
    ];
    const WASTE_SEPARATOR_AFTER = 'high-level (exploration)';

    const MAX_SUGGESTIONS = 8;
    const MOBILE_QUERY = window.matchMedia('(max-width: 767.98px)');

    // ---------- DOM ----------

    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const suggestionList = document.getElementById('autocomplete-results');
    const searchInfo = document.getElementById('search-info');
    const statusFilters = document.getElementById('status-filters');
    const wasteFilters = document.getElementById('waste-filters');
    const statusMessage = document.getElementById('status-message');
    const panelToggle = document.getElementById('panel-toggle');

    // ---------- Map ----------

    const map = L.map('map', { zoomControl: false }).setView([47, 10], 5);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const cluster = L.markerClusterGroup({
        maxClusterRadius: 40,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true
    });
    map.addLayer(cluster);

    const icons = {};
    Object.values(STATUS_COLORS).concat(DEFAULT_COLOR).forEach(color => {
        if (icons[color]) return;
        icons[color] = L.icon({
            iconUrl: `icons/marker-${color}.svg`,
            shadowUrl: 'vendor/leaflet-1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [16, -28],
            shadowSize: [41, 41]
        });
    });

    // ---------- State ----------

    let sites = [];          // [{ data, status, marker, searchText }]
    let textFilter = '';     // applied text filter (after Search / Enter)
    let suggestions = [];    // current suggestion entries
    let activeSuggestion = -1;

    // ---------- Helpers ----------

    function normaliseStatus(raw) {
        return STATUS_MAPPING[raw] || raw || 'unknown';
    }

    function colorFor(status) {
        return STATUS_COLORS[status] || DEFAULT_COLOR;
    }

    function safeId(prefix, value) {
        return `${prefix}-${String(value).replace(/[^a-zA-Z0-9]/g, '')}`;
    }

    function isHttpUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' || url.protocol === 'http:';
        } catch (e) {
            return false;
        }
    }

    function showMessage(text) {
        statusMessage.textContent = text;
        statusMessage.hidden = false;
    }

    // ---------- Popups (DOM nodes, never innerHTML from data) ----------

    function addRow(parent, label, value) {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        p.appendChild(strong);
        p.appendChild(document.createTextNode(value || 'n/a'));
        parent.appendChild(p);
    }

    function buildPopup(site) {
        const root = document.createElement('div');
        root.className = 'site-popup';

        const title = document.createElement('h3');
        title.textContent = site.repository_name || 'Unnamed site';
        root.appendChild(title);

        addRow(root, 'Country', site.country);
        addRow(root, 'Status', site.status);
        addRow(root, 'Waste Type', site.waste_type);

        if (isHttpUrl(site.source)) {
            const p = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = 'Source: ';
            const a = document.createElement('a');
            a.href = site.source;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = 'Source';
            p.appendChild(strong);
            p.appendChild(a);
            root.appendChild(p);
        }

        if (site.last_updated) {
            const p = document.createElement('p');
            p.className = 'popup-updated';
            p.textContent = `Last updated: ${site.last_updated}`;
            root.appendChild(p);
        }

        return root;
    }

    // ---------- Filters (generated from the data) ----------

    function countBy(key) {
        const counts = new Map();
        sites.forEach(s => counts.set(s[key], (counts.get(s[key]) || 0) + 1));
        return counts;
    }

    function ordered(values, preferred) {
        const known = preferred.filter(v => values.has(v));
        const rest = [...values.keys()].filter(v => !preferred.includes(v)).sort();
        return known.concat(rest);
    }

    function addCheckbox(container, prefix, value, count, color) {
        const label = document.createElement('label');
        label.className = 'filter-item';
        label.htmlFor = safeId(prefix, value);

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = safeId(prefix, value);
        input.value = value;
        input.checked = true;
        input.addEventListener('change', updateMap);
        label.appendChild(input);

        if (color) {
            const dot = document.createElement('span');
            dot.className = `color-dot dot-${color}`;
            dot.setAttribute('aria-hidden', 'true');
            label.appendChild(dot);
        }

        label.appendChild(document.createTextNode(value + ' '));
        const c = document.createElement('span');
        c.className = 'filter-count';
        c.textContent = `(${count})`;
        label.appendChild(c);

        container.appendChild(label);
    }

    function generateFilters() {
        const statusCounts = countBy('status');
        ordered(statusCounts, STATUS_ORDER).forEach(status => {
            addCheckbox(statusFilters, 'status', status, statusCounts.get(status), colorFor(status));
        });

        const wasteCounts = countBy('waste');
        ordered(wasteCounts, WASTE_ORDER).forEach(waste => {
            addCheckbox(wasteFilters, 'waste', waste, wasteCounts.get(waste), null);
            if (waste === WASTE_SEPARATOR_AFTER) {
                const sep = document.createElement('div');
                sep.className = 'horizontal-separator';
                sep.setAttribute('aria-hidden', 'true');
                wasteFilters.appendChild(sep);
            }
        });
    }

    function checkedValues(container) {
        return new Set(Array.from(container.querySelectorAll('input:checked')).map(el => el.value));
    }

    function setChecked(container, prefix, value) {
        const input = document.getElementById(safeId(prefix, value));
        if (input && container.contains(input)) input.checked = true;
    }

    // ---------- Map update ----------

    function matchesText(site, term) {
        return term === '' || site.searchText.includes(term);
    }

    function visibleSites() {
        const statuses = checkedValues(statusFilters);
        const wastes = checkedValues(wasteFilters);
        return sites.filter(s => statuses.has(s.status) && wastes.has(s.waste) && matchesText(s, textFilter));
    }

    function updateMap() {
        const visible = visibleSites();
        cluster.clearLayers();
        cluster.addLayers(visible.map(s => s.marker));

        if (textFilter) {
            searchInfo.textContent = visible.length === 1
                ? '1 site found'
                : `${visible.length} sites found`;
        } else {
            searchInfo.textContent = '';
        }
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

        suggestions = sites.filter(s => matchesText(s, term)).slice(0, MAX_SUGGESTIONS);
        if (!suggestions.length) return;

        suggestions.forEach((site, i) => {
            const li = document.createElement('li');
            li.id = `suggestion-${i}`;
            li.className = 'autocomplete-item';
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            li.textContent = site.data.repository_name + ' ';
            const country = document.createElement('small');
            country.textContent = `(${site.data.country})`;
            li.appendChild(country);
            // mousedown fires before the input loses focus
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
        cluster.zoomToShowLayer(site.marker, () => site.marker.openPopup());
    }

    function selectSite(site) {
        searchInput.value = site.data.repository_name;
        closeSuggestions();

        // Make sure the chosen site is not hidden by the checkbox filters
        setChecked(statusFilters, 'status', site.status);
        setChecked(wasteFilters, 'waste', site.waste);

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

    const infoBox = document.getElementById('info-box');
    const aboutButton = document.getElementById('about-link');
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
            // keep focus inside the dialog
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
        if (!Array.isArray(data)) throw new Error('perpetua.json is not a list');

        const result = [];
        data.forEach(site => {
            const lat = Number(site.latitude);
            const lng = Number(site.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                console.warn('Skipping entry without valid coordinates:', site.repository_id);
                return;
            }
            const status = normaliseStatus(site.status);
            const marker = L.marker([lat, lng], {
                icon: icons[colorFor(status)],
                title: site.repository_name || '',
                alt: site.repository_name || 'Site marker'
            });
            marker.bindPopup(buildPopup(site));
            result.push({
                data: site,
                status: status,
                waste: site.waste_type || 'unknown',
                marker: marker,
                searchText: `${site.repository_name || ''} ${site.country || ''}`.toLowerCase()
            });
        });
        return result;
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
        })
        .catch(error => {
            console.error('Error loading the data:', error);
            showMessage('The map data could not be loaded. Please reload the page or try again later.');
        });

})();
