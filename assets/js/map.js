// --- 1. CONFIGURATION & MAPPING ---
const isMobile = window.innerWidth < 768;
const initialZoom = isMobile ? 4 : 5;
const minZoom = isMobile ? 3 : 4;
const initialCenter = [-28.0, 133.0];

const nameToId = {
    'New South Wales': 'nsw',
    'Victoria': 'vic',
    'Queensland': 'qld',
    'Western Australia': 'wa',
    'South Australia': 'sa',
    'Tasmania': 'tas',
    'Australian Capital Territory': 'act',
    'Northern Territory': 'nt'
};

const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '0000-00-00' || dateStr === 'N/A') return 'Unknown';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
};

function getStateStyle(stateName) {
    if (!stateName) return { color: '#666', short: '??' };
    const id = nameToId[stateName];
    const refEl = document.querySelector(`#state-ref .${id}`);

    if (!refEl) return { color: '#666', short: stateName.toUpperCase().substring(0, 3) };

    const style = getComputedStyle(refEl);
    const color = style.getPropertyValue('--contrast').trim() ||
                  style.getPropertyValue('--trad').trim() ||
                  '#666';

    return { color, short: id.toUpperCase() };
}

function disableMapTabOrder() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    mapEl.querySelectorAll('a, button').forEach(el => el.setAttribute('tabindex', '-1'));
}

// --- 2. MAP INITIALIZATION ---
var map = L.map('map', {
    zoomControl: true,
    minZoom: minZoom,
}).setView(initialCenter, initialZoom);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a> | Data <a href="/copyright">&copy; AEC & ABS</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

let divisionsData = {};   // divisions_output.json -- static profile + full holder history, keyed by 4-letter ID
let partyColours = {};    // party_colours.json -- 3-letter code -> hex colour
let boundaryIndex = {};   // boundary_index.json -- { year: { state: filename } }
let electionDates = {};   // election_dates.json -- { year: ISO polling date }
let geoJsonLayer = null;
let currentOpenPopup = null;

// --- KEYBOARD ACCESSIBILITY: Close popup with Escape ---
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && currentOpenPopup) {
        map.closePopup();
        currentOpenPopup = null;
    }
});

// --- 3. DATA LOADING ---
Promise.all([
    fetch('/assets/data/divisions_output.json').then(r => r.json()),
    fetch('/assets/data/party_colours.json').then(r => r.json()),
    fetch('/assets/data/boundary_index.json').then(r => r.json()),
    fetch('/assets/data/election_dates.json').then(r => r.json()),
]).then(([divisions, colours, boundaries, dates]) => {
    divisionsData = divisions;
    partyColours = colours;
    boundaryIndex = boundaries;
    electionDates = dates;
    sortedElectionYears = Object.entries(electionDates).sort((a, b) => a[1].localeCompare(b[1]));

    const yearSelector = document.getElementById('year-select');
    loadYear(yearSelector.value);

    yearSelector.addEventListener('change', (e) => {
        loadYear(e.target.value);
    });
});

// Build a chronologically sorted list of [year, isoDate] once the data loads,
// so we can find "the next general election after this one" for windowing.
let sortedElectionYears = [];

// For a selected election year, the relevant window runs from that election's
// date up to (but not including) the *next* general election's date. Everything
// that happened to this division within that window belongs to this selection --
// e.g. selecting the year a member was elected should also surface their death
// mid-term and the by-election that followed, even though the by-election itself
// isn't its own entry in the year dropdown.
function getWindowForYear(year) {
    const idx = sortedElectionYears.findIndex(([y]) => y === year);
    if (idx === -1) return null;
    const startDate = sortedElectionYears[idx][1];
    const endDate = idx + 1 < sortedElectionYears.length ? sortedElectionYears[idx + 1][1] : null; // null = ongoing, no next election yet
    return { startDate, endDate };
}

function findHolderInfoForYear(division, year) {
    const window = getWindowForYear(year);
    if (!window || !division || !division.holders) return null;

    const inWindow = division.holders.filter(h =>
        h.start >= window.startDate && (window.endDate === null || h.start < window.endDate)
    );
    if (inWindow.length === 0) return null;

    inWindow.sort((a, b) => a.start.localeCompare(b.start));
    const electedHolder = inWindow[0]; // whoever actually won this election -- always the headline, even if a later by-election changed hands
    const notes = inWindow.flatMap(h => h.notes || []); // full story of the term: deaths, by-elections, defections, in order

    return { electedHolder, notes };
}

function loadYear(year) {
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        geoJsonLayer = null;
    }

    const statesForYear = boundaryIndex[year];
    if (!statesForYear) {
        const status = document.getElementById('map-status');
        if (status) status.textContent = `No boundary data available for ${year}.`;
        return;
    }

    const stateKeys = Object.keys(statesForYear);
    Promise.all(
        stateKeys.map(state =>
            fetch(`/assets/data/boundaries/${statesForYear[state]}`).then(r => r.json())
        )
    ).then(stateGeoJsons => {
        const combinedFeatures = [];
        stateGeoJsons.forEach(gj => {
            if (gj && gj.features) combinedFeatures.push(...gj.features);
        });
        const combined = { type: 'FeatureCollection', features: combinedFeatures };

        renderGeoJson(combined, year);

        const status = document.getElementById('map-status');
        if (status) status.textContent = `Map data for ${year} loaded.`;
    });
}

// --- 4. GEOJSON & INTERACTIVITY ---
function renderGeoJson(geoData, year) {
    geoJsonLayer = L.geoJSON(geoData, {
        style: (feature) => {
            const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
            const division = divisionsData[seatIndex];
            const stateColor = getStateStyle(division?.state).color;

            return {
                fillColor: '#fafafa',
                weight: 1.5,
                color: stateColor,
                fillOpacity: 0.1,
                className: 'division-boundary'
            };
        },

        onEachFeature: (feature, layer) => {
            const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
            const division = divisionsData[seatIndex];
            if (!division) return;

            const info = findHolderInfoForYear(division, year);
            const holder = info ? info.electedHolder : null;
            const windowNotes = info ? info.notes : [];
            const sStyle = getStateStyle(division.state);

            let badgeCount = 0;
            let badgesList = '';
            if (division.isfed === "TRUE") { badgesList += '<span class="badge fed">FEDERATION</span>'; badgeCount++; }
            if (division.ispm === "TRUE") { badgesList += '<span class="badge pm">PRIME MINISTER</span>'; badgeCount++; }
            if (division.isfem === "TRUE") { badgesList += '<span class="badge fem">WOMAN</span>'; badgeCount++; }
            if (division.isind === "TRUE") { badgesList += '<span class="badge ind">INDIGENOUS</span>'; badgeCount++; }
            if (division.isgeo === "TRUE") { badgesList += '<span class="badge geo">GEOGRAPHIC</span>'; badgeCount++; }
            if (division.isaus === "FALSE") { badgesList += '<span class="badge nonaus">NON-AUSTRALIAN</span>'; badgeCount++; }
            if (division.iscol === "TRUE") { badgesList += '<span class="badge old">COLONIAL</span>'; badgeCount++; }
            if (division.islinked === "TRUE") { badgesList += '<span class="badge linked">LINKED</span>'; badgeCount++; }
            if (division.islinked === "FALSE") { badgesList += '<span class="badge drifted">DRIFTED</span>'; badgeCount++; }

            layer.bindTooltip(`<strong>${division.name}</strong> (${sStyle.short})`, {
                sticky: true,
                direction: 'top',
                className: 'modern-tooltip',
                offset: [0, 5]
            });

            // party shown is the one the member was elected under at the START of this term
            const electedParty = holder && holder.parties.length ? holder.parties[0].party : null;
            const pColor = (electedParty && partyColours[electedParty]) ? `#${partyColours[electedParty]}` : '#333';

            const memberRow = holder
                ? `<div class="member-row">
                       <strong>${holder.given || ''} ${(holder.family || '').toUpperCase()}</strong>
                       <span class="party-pill">${(electedParty || 'IND')}</span>
                   </div>
                   ${windowNotes.length ? `<small class="status-notice">${windowNotes.join('<br>')}</small>` : ''}`
                : `<div class="member-row"><em>No member on record for this election.</em></div>`;

            const popupContent = `
                <div class="map-popup" style="--party-color: ${pColor}">
                    <header>
                        <h2>${division.name}</h2>
                        <span>${division.state}</span>
                    </header>

                    <section class="profile">
                        <h3>Division profile</h3>
                        <p><strong>Created:</strong> ${formatDate(division.created)}</p>
                        <p><strong>Named for:</strong> ${division.namesake}</p>

                        ${badgeCount > 0 ? `
                            <div class="tags-row">
                                <strong>Division name categories:</strong>
                                <div class="tags">${badgesList}</div>
                            </div>
                        ` : ''}
                    </section>

                    <footer>
                        <h3>Elected member</h3>
                        ${memberRow}
                    </footer>
                </div>`;

            layer.bindPopup(popupContent);

            // --- KEYBOARD ACCESSIBILITY ENHANCEMENTS ---

            const pathElement = layer.getElement();
            if (pathElement) {
                pathElement.setAttribute('tabindex', '0');
                pathElement.setAttribute('role', 'button');
                pathElement.setAttribute('aria-label', `${division.name}, ${division.state}`);

                pathElement.addEventListener('focus', function() {
                    if (currentOpenPopup && currentOpenPopup !== layer) {
                        map.closePopup();
                    }
                    const activeColor = getStateStyle(division.state).color;
                    layer.setStyle({
                        fillColor: activeColor,
                        fillOpacity: 0.25,
                        weight: 4,
                        color: activeColor
                    });
                    layer.bringToFront();
                    map.fitBounds(layer.getBounds(), {
                        padding: [50, 50],
                        maxZoom: 10
                    });
                });

                pathElement.addEventListener('blur', function() {
                    if (!geoJsonLayer.searchActive || !layer.isSearchMatch) {
                        geoJsonLayer.resetStyle(layer);
                    }
                });

                pathElement.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        layer.openPopup();
                        currentOpenPopup = layer;
                    }
                });
            }

            layer.on('popupopen', function() {
                currentOpenPopup = layer;
            });

            layer.on('popupclose', function() {
                if (currentOpenPopup === layer) {
                    currentOpenPopup = null;
                }
            });

            layer.on({
                mouseover: (e) => {
                    const l = e.target;
                    if (geoJsonLayer.searchActive && !l.isSearchMatch) return;
                    const activeColor = getStateStyle(division.state).color;
                    l.setStyle({
                        fillColor: activeColor,
                        fillOpacity: 0.25,
                        weight: 4,
                        color: activeColor
                    });
                    l.bringToFront();
                },
                mouseout: (e) => {
                    const l = e.target;
                    if (geoJsonLayer.searchActive && !l.isSearchMatch) {
                        l.setStyle({ fillOpacity: 0.05, weight: 0 });
                    } else {
                        geoJsonLayer.resetStyle(l);
                    }
                },
                click: (e) => {
                    currentOpenPopup = layer;
                }
            });
        }
    }).addTo(map);

    setupSearch(geoJsonLayer);
    updateLegend();
    disableMapTabOrder();
}

// --- 5. SEARCH ---
function setupSearch(layerGroup) {
    const searchInput = document.getElementById('division-search');
    const status = document.getElementById('map-status');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase().trim();
        layerGroup.searchActive = (value !== "");

        let matchCount = 0;
        let lastMatch = null;

        layerGroup.eachLayer((layer) => {
            const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
            const division = divisionsData[seatIndex];
            const divName = division ? division.name.toLowerCase() : "";

            if (value === "") {
                layer.isSearchMatch = false;
                layerGroup.resetStyle(layer);
            } else if (divName.includes(value)) {
                layer.isSearchMatch = true;
                matchCount++;
                lastMatch = layer;

                const activeColor = getStateStyle(division.state).color;
                layer.setStyle({
                    fillColor: activeColor,
                    fillOpacity: 0.4,
                    weight: 4,
                    color: activeColor
                });
            } else {
                layer.isSearchMatch = false;
                layer.setStyle({ fillOpacity: 0.05, weight: 0 });
            }
        });

        if (status) {
            if (value === "") {
                status.textContent = "";
            } else {
                status.textContent = `${matchCount} ${matchCount === 1 ? 'result' : 'results'} found for ${value}.`;
            }
        }

        if (layerGroup.searchActive && matchCount === 0) {
            searchInput.style.backgroundColor = '#ffeeee';
            searchInput.style.borderColor = '#ff0000';
        } else {
            searchInput.style.backgroundColor = '';
            searchInput.style.borderColor = '';
        }

        if (matchCount === 1 && lastMatch) {
            map.fitBounds(lastMatch.getBounds(), { padding: [50, 50], maxZoom: 10 });
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = e.target.value.toLowerCase().trim();
            if (value === "") return;

            let firstMatch = null;
            layerGroup.eachLayer((layer) => {
                const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
                const division = divisionsData[seatIndex];
                const divName = division ? division.name.toLowerCase() : "";
                if (!firstMatch && divName.includes(value)) firstMatch = layer;
            });

            if (firstMatch) {
                map.fitBounds(firstMatch.getBounds(), { padding: [50, 50], maxZoom: 10 });
                firstMatch.openPopup();
                currentOpenPopup = firstMatch;
            }
        }
    });
}

// --- 6. LEGEND ---
let legendControl;

function updateLegend() {
    if (legendControl) map.removeControl(legendControl);

    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = '<span class="legend-title">States</span>';

        Object.keys(nameToId).sort().forEach(stateName => {
            const cfg = getStateStyle(stateName);
            div.innerHTML += `
                <div class="legend-item">
                    <i class="legend-color" style="border-color: ${cfg.color};"></i>
                    <span>${cfg.short}</span>
                </div>`;
        });

        return div;
    };
    legendControl.addTo(map);
}
