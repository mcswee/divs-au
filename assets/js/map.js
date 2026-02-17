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

const masterStats = {};
let geoJsonLayer = null; 

// --- 3. DATA LOADING ---
Papa.parse('/assets/data/electoral_division_data.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(staticRes) {
        staticRes.data.forEach(row => {
            const idx = String(row.index).trim();
            masterStats[idx] = { 
                division: row.division, 
                state: row.state,
                created: row.created,
                namesake: row.namesake,
                fed: row.isfed,
                fem: row.isfem,
                ind: row.isind,
                pm: row.ispm,
                geo: row.isgeo,
                aus: row.isaus,
                old: row.iscol
            }; 
        }); 

        const yearSelector = document.getElementById('year-select');
        loadYear(yearSelector.value);

        yearSelector.addEventListener('change', (e) => {
            loadYear(e.target.value);
        });
    } 
}); 

function loadYear(year) {
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
    }

    Papa.parse(`/assets/data/${year}.csv`, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(resultsRes) {
            resultsRes.data.forEach(row => {
                const idx = String(row.index).trim();
                if (masterStats[idx]) {
                    masterStats[idx].winner_name = row.name;
                    masterStats[idx].winner_surname = row.surname;
                    masterStats[idx].party = row.party;
                    masterStats[idx].colour = row.colour;
                    masterStats[idx].linked = row.linked;
                    masterStats[idx].note = row.note;
                }
            }); 

            renderGeoJson(year);
            
            const status = document.getElementById('map-status');
            if (status) status.textContent = `Map data for ${year} loaded.`;
        } 
    }); 
}

// --- 4. GEOJSON & INTERACTIVITY ---
function renderGeoJson(year) {
    fetch(`/assets/data/${year}.geojson`)
        .then(res => res.json())
        .then(geoData => {
            geoJsonLayer = L.geoJSON(geoData, {
                style: (feature) => {
                    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
                    const data = masterStats[seatIndex];
                    const stateColor = getStateStyle(data?.state).color;
                    
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
                    const data = masterStats[seatIndex];

                    if (data) {
                        const sStyle = getStateStyle(data.state);
                        let badgeCount = 0;
                        let badgesList = '';

                        if (data.fed === "TRUE") { badgesList += '<span class="badge fed">FEDERATION</span>'; badgeCount++; }
                        if (data.pm === "TRUE") { badgesList += '<span class="badge pm">PRIME MINISTER</span>'; badgeCount++; }
                        if (data.fem === "TRUE") { badgesList += '<span class="badge fem">WOMAN</span>'; badgeCount++; }
                        if (data.ind === "TRUE") { badgesList += '<span class="badge ind">INDIGENOUS</span>'; badgeCount++; }
                        if (data.geo === "TRUE") { badgesList += '<span class="badge geo">GEOGRAPHIC</span>'; badgeCount++; }
                        if (data.linked === "FALSE") { badgesList += '<span class="badge linked">DRIFTED</span>'; badgeCount++; }
                        if (data.old === "TRUE") { badgesList += '<span class="badge old">COLONIAL</span>'; badgeCount++; }
                        if (data.aus === "FALSE") { badgesList += '<span class="badge nonaus">NON-AUSTRALIAN</span>'; badgeCount++; }

                        layer.bindTooltip(`<strong>${data.division}</strong> (${sStyle.short})`, {
                            sticky: true,
                            direction: 'top',
                            className: 'modern-tooltip',
                            offset: [0, 5]
                        });
                        
                        const pColor = data.colour || '#333';
                        const popupContent = `
                            <div class="popup-container">
                                <header class="popup-header">
                                    <h2 class="popup-title">${data.division}</h2>
                                    <p class="popup-label">${data.state}</p>
                                </header>
                                <section class="popup-historical">
                                    <div><strong>Created:</strong> ${data.created}</div>
                                    <div><strong>Named for:</strong> ${data.namesake}</div>
                                </section>
                                ${badgeCount > 0 ? `
                                    <div class="popup-label">Division name classification</div>
                                    <div class="popup-badges-list">${badgesList}</div>
                                ` : ''}
                                <footer class="popup-footer">
                                    <div class="popup-label">Elected member</div>
                                    <div class="popup-member-details">
                                        <span class="popup-member-name">${data.winner_name || 'N/A'} ${data.winner_surname || ''}</span>
                                        <span class="popup-party-badge" style="--party-color: ${pColor};">
                                            ${(data.party || 'unknown').toUpperCase()}
                                        </span>
                                    </div>
                                    ${data.note ? `<div class="popup-note">${data.note}</div>` : ''}
                                </footer>
                            </div>`;

                        layer.bindPopup(popupContent);

                        layer.on({
                            mouseover: (e) => {
                                const l = e.target;
                                if (geoJsonLayer.searchActive && !l.isSearchMatch) return;
                                const activeColor = getStateStyle(data.state).color;
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
                            }
                        }); 
                    } 
                } 
            }).addTo(map); 

            setupSearch(geoJsonLayer);
            updateLegend();
            disableMapTabOrder();
        }); 
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
            const seatData = masterStats[seatIndex];
            const divName = seatData ? seatData.division.toLowerCase() : "";

            if (value === "") {
                layer.isSearchMatch = false;
                layerGroup.resetStyle(layer);
            } else if (divName.includes(value)) {
                layer.isSearchMatch = true;
                matchCount++;
                lastMatch = layer;
                
                const activeColor = getStateStyle(seatData.state).color;
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

        // Update accessibility status
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
                const seatData = masterStats[seatIndex];
                const divName = seatData ? seatData.division.toLowerCase() : "";
                if (!firstMatch && divName.includes(value)) firstMatch = layer;
            });

            if (firstMatch) {
                map.fitBounds(firstMatch.getBounds(), { padding: [50, 50], maxZoom: 10 });
                firstMatch.openPopup();
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
