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

// --- 2. MAP INITIALIZATION ---
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var map = L.map('map', {
    zoomControl: true,
    minZoom: minZoom,
    zoomAnimation: !reduceMotion,
    fadeAnimation: !reduceMotion
}).setView(initialCenter, initialZoom);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_3li0_1_3bd3e03fbf5a91dbb6cb9f61', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> | Data <a href="/copyright">&copy; ABS</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

let divisionsData = {};   // divisions_output.json -- static profile + full holder history, keyed by 4-letter ID
let partyColours = {};    // party_colours.json -- 3-letter code -> hex colour
let boundaryIndex = {};   // boundary_index.json -- { year: { state: filename } }
let electionDates = {};   // election_dates.json -- { year: ISO polling date }
let geoJsonLayer = null;
let currentOpenPopup = null;
let lastKeyboardLayer = null;   // division whose popup was opened from the keyboard
let outlineMode = 'state';      // 'state' or 'party'
let currentYear = null;
const outlineCache = new Map();

// --- KEYBOARD ACCESSIBILITY: Close popup with Escape ---
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && currentOpenPopup) {
        map.closePopup();
        currentOpenPopup = null;
    }
});

// --- KEYBOARD: popups are dialogs; focus goes in on open and back to the division on close ---
map.on('popupopen', (e) => {
    const container = e.popup.getElement();
    if (!container) return;
    container.setAttribute('role', 'dialog');
    const heading = container.querySelector('h2');
    if (heading) {
        heading.id = 'popup-title';
        container.setAttribute('aria-labelledby', 'popup-title');
    }
    const body = container.querySelector('.map-popup');
    if (lastKeyboardLayer && body) {
        body.setAttribute('tabindex', '-1');
        body.focus();
    }
});

map.on('popupclose', () => {
    if (!lastKeyboardLayer) return;
    const layer = lastKeyboardLayer;
    lastKeyboardLayer = null;
    const active = document.activeElement;
    if (!active || active === document.body) {
        const path = layer.getElement();
        if (path) path.focus({ preventScroll: true });
    }
});

function openPopupFor(layer, byKeyboard) {
    lastKeyboardLayer = byKeyboard ? layer : null;
    layer.openPopup();
    currentOpenPopup = layer;
}

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
}).catch(err => {
    console.error('Could not load the map data:', err);
    const status = document.getElementById('map-status');
    if (status) status.textContent = 'The map data could not be loaded.';
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

    // multi-member seats (e.g. South Australia and Tasmania's single state-wide
    // electorate at Federation) can return several people simultaneously --
    // anyone sharing the earliest start date in this window was a co-equal
    // winner, not a single headline winner followed by colleagues
    const earliestStart = inWindow[0].start;
    const electedHolders = inWindow.filter(h => h.start === earliestStart);

    const notes = inWindow.flatMap(h => h.notes || []); // full story of the term, in order

    return { electedHolders, notes };
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
    }).catch(err => {
        console.error(`Could not load the boundaries for ${year}:`, err);
        const status = document.getElementById('map-status');
        if (status) status.textContent = `The boundaries for ${year} could not be loaded.`;
    });
}

// --- 4. OUTLINE COLOURS (by state or by party) ---
const NEUTRAL_GREY = '#b0b0b0';   // no member on record, or no colour known for the party
const MULTI_GREY = '#666666';     // more than one member elected to the division

// Both colours for a division in the selected year, worked out once and kept
function getOutline(feature) {
    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
    const key = seatIndex + '|' + currentYear;
    if (outlineCache.has(key)) return outlineCache.get(key);

    const division = divisionsData[seatIndex];
    const outline = { state: getStateStyle(division?.state).color, party: NEUTRAL_GREY, partyCode: 'NONE' };

    const info = division ? findHolderInfoForYear(division, currentYear) : null;
    const holders = info ? info.electedHolders : [];
    if (holders.length > 1) {
        outline.party = MULTI_GREY;
        outline.partyCode = 'MULTI';
    } else if (holders.length === 1) {
        const code = holders[0].parties.length ? holders[0].parties[0].party : 'IND';
        outline.partyCode = code;
        outline.party = partyColours[code] ? `#${partyColours[code]}` : NEUTRAL_GREY;
    }

    outlineCache.set(key, outline);
    return outline;
}

function outlineColour(feature) {
    return getOutline(feature)[outlineMode];
}

function styleForFeature(feature) {
    return {
        fillColor: '#fafafa',
        weight: 1.5,
        color: outlineColour(feature),
        fillOpacity: 0.1,
        className: 'division-boundary'
    };
}

function highlightLayer(layer, fillOpacity) {
    const colour = outlineColour(layer.feature);
    layer.setStyle({ fillColor: colour, fillOpacity, weight: 4, color: colour });
}

function setOutlineMode(mode) {
    outlineMode = mode;
    if (!geoJsonLayer) return;
    geoJsonLayer.eachLayer(layer => geoJsonLayer.resetStyle(layer));
    applySearch(false);
    updateLegend();

    const status = document.getElementById('map-status');
    if (status) {
        status.textContent = mode === 'party'
            ? 'Outlines are now coloured by party. Divisions with more than one member are dark grey.'
            : 'Outlines are now coloured by state.';
    }
}

function initOutlineToggle() {
    // the browser can restore the chosen option when the page is reloaded
    const checked = document.querySelector('input[name="outline-mode"]:checked');
    outlineMode = checked ? checked.value : 'state';
    document.querySelectorAll('input[name="outline-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) setOutlineMode(e.target.value);
        });
    });
}

// --- 5. GEOJSON & INTERACTIVITY ---
function renderGeoJson(geoData, year) {
    currentYear = year;
    outlineCache.clear();

    geoJsonLayer = L.geoJSON(geoData, {
        style: styleForFeature,

        onEachFeature: (feature, layer) => {
            const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
            const division = divisionsData[seatIndex];
            if (!division) return;

            const info = findHolderInfoForYear(division, year);
            const holders = info ? info.electedHolders : [];
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

            // each member's party pill carries that member's own party colour,
            // so divisions with several members at once show every party correctly
            const memberRows = holders.length
                ? holders.map(h => {
                    const party = h.parties.length ? h.parties[0].party : 'IND';
                    const colour = partyColours[party] ? `#${partyColours[party]}` : NEUTRAL_GREY;
                    return `<div class="member-row">
                        <strong>${h.given || ''} ${(h.family || '').toUpperCase()}</strong>
                        <span class="party-pill" style="--party-color: ${colour}">${party}</span>
                     </div>`;
                }).join('')
                : `<div class="member-row"><em>No member on record for this election.</em></div>`;

            const memberRow = memberRows + (windowNotes.length ? `<small class="status-notice">${windowNotes.join('<br>')}</small>` : '');
            const popupContent = `
                <div class="map-popup">
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
                        <h3>${holders.length > 1 ? 'Elected members' : 'Elected member'}</h3>
                        ${memberRow}
                    </footer>
                </div>`;

            layer.bindPopup(popupContent);
            layer.divisionLabel = `${division.name}, ${division.state}`;

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
                    highlightLayer(l, 0.25);
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
                click: () => {
                    currentOpenPopup = layer;
                    lastKeyboardLayer = null;
                }
            });
        }
    }).addTo(map);

    makePathsKeyboardAccessible();
    applySearch(false);
    updateLegend();
}

// Divisions can be reached from the keyboard. This has to run after the layer is
// on the map: a division's SVG path does not exist before then.
function makePathsKeyboardAccessible() {
    geoJsonLayer.eachLayer(layer => {
        const path = layer.getElement && layer.getElement();
        if (!path || !layer.divisionLabel) return;

        path.setAttribute('tabindex', '0');
        path.setAttribute('role', 'button');
        path.setAttribute('aria-label', layer.divisionLabel);
        path.setAttribute('aria-haspopup', 'dialog');

        path.addEventListener('focus', function() {
            if (currentOpenPopup && currentOpenPopup !== layer) {
                map.closePopup();
            }
            highlightLayer(layer, 0.25);
            map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 10 });
        });

        path.addEventListener('blur', function() {
            if (!geoJsonLayer.searchActive || !layer.isSearchMatch) {
                geoJsonLayer.resetStyle(layer);
            }
        });

        path.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPopupFor(layer, true);
            }
        });
    });
}

// --- 6. SEARCH ---
function applySearch(fromInput) {
    const searchInput = document.getElementById('division-search');
    const status = document.getElementById('map-status');
    const hint = document.getElementById('search-hint');
    if (!searchInput || !geoJsonLayer) return;

    const value = searchInput.value.toLowerCase().trim();
    geoJsonLayer.searchActive = (value !== "");

    let matchCount = 0;
    let lastMatch = null;

    geoJsonLayer.eachLayer((layer) => {
        const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
        const division = divisionsData[seatIndex];
        const divName = division ? division.name.toLowerCase() : "";

        if (value === "") {
            layer.isSearchMatch = false;
            geoJsonLayer.resetStyle(layer);
        } else if (divName.includes(value)) {
            layer.isSearchMatch = true;
            matchCount++;
            lastMatch = layer;
            highlightLayer(layer, 0.4);
        } else {
            layer.isSearchMatch = false;
            layer.setStyle({ fillOpacity: 0.05, weight: 0 });
        }
    });

    const noMatch = geoJsonLayer.searchActive && matchCount === 0;
    searchInput.classList.toggle('no-match', noMatch);
    if (hint) hint.textContent = noMatch ? `No divisions match "${searchInput.value.trim()}".` : '';

    if (!fromInput) return;

    if (status) {
        status.textContent = value === ""
            ? ""
            : `${matchCount} ${matchCount === 1 ? 'result' : 'results'} found for ${value}.`;
    }

    if (matchCount === 1 && lastMatch) {
        map.fitBounds(lastMatch.getBounds(), { padding: [50, 50], maxZoom: 10 });
    }
}

function initSearch() {
    const searchInput = document.getElementById('division-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => applySearch(true));

    // Enter opens the first match: the keyboard route to any division's details
    searchInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !geoJsonLayer) return;
        const value = e.target.value.toLowerCase().trim();
        if (value === "") return;

        let firstMatch = null;
        geoJsonLayer.eachLayer((layer) => {
            const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
            const division = divisionsData[seatIndex];
            const divName = division ? division.name.toLowerCase() : "";
            if (!firstMatch && divName.includes(value)) firstMatch = layer;
        });

        if (firstMatch) {
            map.fitBounds(firstMatch.getBounds(), { padding: [50, 50], maxZoom: 10 });
            openPopupFor(firstMatch, true);
        }
    });
}

// --- 7. LEGEND ---
let legendControl;

function legendItem(colour, label) {
    return `
        <div class="legend-item">
            <i class="legend-color" style="border-color: ${colour};" aria-hidden="true"></i>
            <span>${label}</span>
        </div>`;
}

function stateLegendHtml() {
    return '<span class="legend-title">States</span>' +
        Object.keys(nameToId).sort().map(stateName => {
            const cfg = getStateStyle(stateName);
            return legendItem(cfg.color, cfg.short);
        }).join('');
}

// Only the parties that appear in the selected year, most divisions first
function partyLegendHtml() {
    const found = {};
    geoJsonLayer.eachLayer(layer => {
        const o = getOutline(layer.feature);
        if (!found[o.partyCode]) found[o.partyCode] = { colour: o.party, count: 0 };
        found[o.partyCode].count++;
    });

    const codes = Object.keys(found)
        .filter(c => c !== 'MULTI' && c !== 'NONE')
        .sort((a, b) => found[b].count - found[a].count || a.localeCompare(b));

    let html = '<span class="legend-title">Parties</span>' + codes.map(c => legendItem(found[c].colour, c)).join('');
    if (found.MULTI) html += legendItem(MULTI_GREY, 'Multiple members');
    if (found.NONE) html += legendItem(NEUTRAL_GREY, 'None on record');
    return html;
}

function updateLegend() {
    if (legendControl) map.removeControl(legendControl);

    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.setAttribute('role', 'group');
        div.setAttribute('aria-label', outlineMode === 'party' ? 'Map key: outline colour by party' : 'Map key: outline colour by state');
        div.innerHTML = outlineMode === 'party' ? partyLegendHtml() : stateLegendHtml();
        return div;
    };
    legendControl.addTo(map);
}

// --- 8. SET UP THE CONTROLS ---
initOutlineToggle();
initSearch();
