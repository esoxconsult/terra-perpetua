// Global variables for data and markers
let allSites = [];
const markersGroup = L.featureGroup();

// Object to map status to a clean, standardized name
const statusMapping = {
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

// Object to map the standardized status name to an icon color
// (key = file name in icons/marker-<key>.svg)
const statusColors = {
    'under construction': 'orange',
    'planned': 'gold',
    'in operation': 'blue',
    'currently dormant': 'red',
    'closed': 'grey',
    'decommissioning': 'black'
};

// Fill colors of the self-hosted SVG markers, also used for the legend dots
const markerHex = {
    orange: '#cb8427',
    gold: '#ffd326',
    blue: '#2a81cb',
    red: '#cb2b3e',
    grey: '#7b7b7b',
    black: '#3d3d3d'
};

// One icon per color, self-hosted (icons/ and vendor/), no external requests
const markerIcons = {};
Object.keys(markerHex).forEach(color => {
    markerIcons[color] = L.icon({
        iconUrl: `icons/marker-${color}.svg`,
        shadowUrl: 'vendor/leaflet-1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
    });
});

const wasteTypeOrder = [
    'low-level',
    'low- and intermediate-level',
    'high-level',
    'high-level (exploration)',
    'mixed waste',
    'research',
    'transuranic'
];

// 1. Initialize the map
const map = L.map('map').setView([47, 10], 5);

// 2. Add the base map tiles (OpenStreetMap)
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// 3. Load the data and place the markers
fetch('perpetua.json')
    .then(response => response.json())
    .then(data => {
        allSites = data;
        generateFilters(allSites);
        updateMap();
    })
    .catch(error => console.error('Error loading the data:', error));

// 4. Generate the filter checkboxes
function generateFilters(sites) {
    const statusFiltersDiv = document.getElementById('status-filters');
    const wasteFiltersDiv = document.getElementById('waste-filters');
    
    const allStatuses = [...new Set(sites.map(site => statusMapping[site.status] || site.status))];
    
    allStatuses.forEach(status => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `status-${status.replace(/[^a-zA-Z0-9]/g, '')}`;
        checkbox.value = status;
        checkbox.checked = true;
        checkbox.addEventListener('change', updateMap);
        
        const standardizedStatus = statusMapping[status] || status;
        const markerColor = statusColors[standardizedStatus] || 'blue';
        const colorDot = document.createElement('span');
        colorDot.className = 'color-dot';
        colorDot.style.backgroundColor = markerHex[markerColor];

        const label = document.createElement('label');
        label.htmlFor = `status-${status.replace(/[^a-zA-Z0-9]/g, '')}`;
        label.textContent = ` ${status}`;

        statusFiltersDiv.appendChild(colorDot);
        statusFiltersDiv.appendChild(checkbox);
        statusFiltersDiv.appendChild(label);
        statusFiltersDiv.appendChild(document.createElement('br'));
    });

    const allWasteTypesInSite = [...new Set(sites.map(site => site.waste_type))];
    wasteTypeOrder.forEach(waste => {
        if (allWasteTypesInSite.includes(waste)) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `waste-${waste.replace(/[^a-zA-Z0-9]/g, '')}`;
            checkbox.value = waste;
            checkbox.checked = true;
            checkbox.addEventListener('change', updateMap);
            const label = document.createElement('label');
            label.htmlFor = `waste-${waste.replace(/[^a-zA-Z0-9]/g, '')}`;
            label.textContent = ` ${waste}`;
            wasteFiltersDiv.appendChild(checkbox);
            wasteFiltersDiv.appendChild(label);
            wasteFiltersDiv.appendChild(document.createElement('br'));
        }
        
        if (waste === 'high-level (exploration)') {
            const separator = document.createElement('div');
            separator.className = 'horizontal-separator';
            wasteFiltersDiv.appendChild(separator);
        }
    });
}

// 5. Update the map based on filters and search
function updateMap() {
    markersGroup.clearLayers();
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    
    const activeStatuses = Array.from(document.querySelectorAll('#status-filters input:checked')).map(el => el.value);
    const activeWasteTypes = Array.from(document.querySelectorAll('#waste-filters input:checked')).map(el => el.value);

    const filteredSites = allSites.filter(site => {
        const standardizedStatus = statusMapping[site.status] || site.status;
        const statusMatch = activeStatuses.includes(standardizedStatus);
        const wasteMatch = activeWasteTypes.includes(site.waste_type);
        const searchMatch = site.repository_name.toLowerCase().includes(searchInput) || site.country.toLowerCase().includes(searchInput);
        
        return statusMatch && wasteMatch && searchMatch;
    });

    filteredSites.forEach(site => {
        const standardizedStatus = statusMapping[site.status] || site.status;
        const markerColor = statusColors[standardizedStatus] || 'blue';
        
        const marker = L.marker([site.latitude, site.longitude], {icon: markerIcons[markerColor]});

        const popupContent = `
            <h3>${site.repository_name}</h3>
            <p><strong>Country:</strong> ${site.country}</p>
            <p><strong>Status:</strong> ${site.status}</p>
            <p><strong>Waste Type:</strong> ${site.waste_type}</p>
            <p><strong>Source:</strong> <a href="${site.source}" target="_blank">Official Website</a></p>
        `;
        marker.bindPopup(popupContent);
        markersGroup.addLayer(marker);
    });

    map.addLayer(markersGroup);
}

const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const autocompleteResults = document.getElementById('autocomplete-results');

function showSuggestions() {
    const searchTerm = searchInput.value.toLowerCase();
    autocompleteResults.innerHTML = '';

    if (searchTerm.length === 0) {
        return;
    }

    const suggestions = allSites.filter(site => 
        site.repository_name.toLowerCase().includes(searchTerm) || 
        site.country.toLowerCase().includes(searchTerm)
    );

    suggestions.forEach(site => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = `${site.repository_name} (${site.country})`;
        item.addEventListener('click', () => {
            searchInput.value = site.repository_name;
            autocompleteResults.innerHTML = '';
            updateMap();
        });
        autocompleteResults.appendChild(item);
    });
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-container')) {
        autocompleteResults.innerHTML = '';
    }
});

searchInput.addEventListener('input', showSuggestions);
searchButton.addEventListener('click', updateMap);

document.addEventListener('DOMContentLoaded', () => {
    const aboutLink = document.getElementById('about-link');
    const infoBox = document.getElementById('info-box');
    const closeBtn = document.querySelector('.close-btn');

    aboutLink.addEventListener('click', () => {
        infoBox.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => {
        infoBox.style.display = 'none';
    });

    infoBox.addEventListener('click', (event) => {
        if (event.target === infoBox) {
            infoBox.style.display = 'none';
        }
    });
});