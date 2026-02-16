// --- 1. MAP INITIALIZATION ---
const isMobile = window.innerWidth < 768;
const initialZoom = isMobile ? 4 : 5;
const minZoom = isMobile ? 3 : 4;
const initialCenter = [-28.0, 133.0];

const stateStyles = {
    'New South Wales': { color: '#0075be', short: 'NSW' },
    'Victoria': { color: '#001f7e', short: 'VIC' },
    'Queensland': { color: '#73182c', short: 'QLD' },
    'Western Australia':  { color: '#c98600', short: 'WA' },
    'South Australia':  { color: '#d50032', short: 'SA' },
    'Tasmania': { color: '#006747', short: 'TAS' },
    'Australian Capital Territory': { color: '#012b88', short: 'ACT' },
    'Northern Territory':  { color: '#c75b12', short: 'NT' }
};

var map = L.map('map', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a> | Data <a href="/copyright">&copy; AEC & ABS</a>',
    zoomControl: true,
    minZoom: minZoom,
}).setView(initialCenter, initialZoom);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

const masterStats = {};
let geoJsonLayer = null; 

// --- 2. DATA LOADING ---
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
        } 
    }); 
}

// --- 3. GEOJSON & INTERACTIVITY ---
function renderGeoJson(year) {
    fetch(`/assets/data/${year}.geojson`)
        .then(res => res.json())
        .then(geoData => {
            geoJsonLayer = L.geoJSON(geoData, {
                style: (feature) => {
                    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
                    const data = masterStats[seatIndex];
                    const stateColor = stateStyles[data?.state]?.color || '#666';
                    
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

                        let badgesHtml = '';
                        if (badgeCount > 0) {
                            badgesHtml = `
                                <div style="margin-top: 12px; margin-bottom: 12px;">
                                    <div style="font-size: 0.85em; color: #888; margin-bottom: 6px; letter-spacing: 0.3px; font-weight: bold;">Division name classification</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">${badgesList}</div>
                                </div>`;
                        }

                        layer.bindTooltip(`<strong>${data.division}</strong> (${data.state})`, {
                            sticky: true,
                            direction: 'top',
                            className:'modern-tooltip',
                            offset: [0, 5]
                        });

                        const popupContent = `
                            <div style="border-top: 5px solid ${stateStyles[data.state]?.color || '#ccc'}; padding: 5px; min-width: 240px;">
                                <h2 style="margin: 0 0 2px 0; border-bottom: none; font-size: 1.2rem;">${data.division}</h2>
                                <p style="margin: 0 0 8px 0; color: #666; font-size: 0.85em; letter-spacing: 0.65px;">${data.state}</p>
                                <div style="font-size: 0.9em; line-height: 1.4; margin-bottom: 4px;">
                                    <strong>Date created:</strong> ${data.created}<br>
                                    <strong>Named for:</strong> ${data.namesake}
                                </div>
                                ${badgesHtml}
                                <div style="margin-top: 16px; padding-top: 2px; border-top: 1px solid #eee;">
                                    <div style="font-size: 0.85em; color: #888; margin-bottom: 4px; letter-spacing: 0.3px;">Elected Member</div>
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <span style="font-weight: bold; font-size: 1.05em;">${data.winner_name || 'N/A'} ${data.winner_surname || ''}</span>
                                        <span style="background: white; color: ${data.colour || '#333'}; padding: 1px 8px; border: 1px solid ${data.colour || '#333'}; border-radius: 12px; font-size: 10px; font-weight: bold; white-space: nowrap;">
                                            ${(data.party || 'unknown').toUpperCase()}
                                        </span>
                                    </div>
                                   ${data.note ? `<div style="font-size: 0.85em; margin-top: 8px; padding: 6px; background: #f5f5fa; border-left: 3px solid #ccc; border-radius: 0 4px 4px 0; color: #444; line-height: 1.3;">${data.note}</div>` : ''}
                                </div>
                            </div>`;

                        layer.bindPopup(popupContent);

                        layer.on({
                            mouseover: (e) => {
                                const l = e.target;
                                if (geoJsonLayer.searchActive && !l.isSearchMatch) return;
                                l.setStyle({ 
                                    fillOpacity: 0.4, 
                                    weight: 4, 
                                    color: stateStyles[data.state]?.color || '#666' 
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
        }); 
}

// --- 4. SEARCH ---
function setupSearch(layerGroup) {
    const searchInput = document.getElementById('division-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase().trim();
        layerGroup.searchActive = (value !== "");

        layerGroup.eachLayer((layer) => {
            const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
            const seatData = masterStats[seatIndex];
            const divName = seatData ? seatData.division.toLowerCase() : "";

            if (value === "") {
                layer.isSearchMatch = false;
                layerGroup.resetStyle(layer);
            } else if (divName.includes(value)) {
                layer.isSearchMatch = true; 
                layer.setStyle({ fillOpacity: 0.4, weight: 4, color: stateStyles[seatData.state]?.color || '#666' });
            } else {
                layer.isSearchMatch = false;
                layer.setStyle({ fillOpacity: 0.05, weight: 0 });
            }
        }); 
    }); 
}

// --- 5. LEGEND ---
let legendControl; 

function updateLegend() {
    if (legendControl) map.removeControl(legendControl);

    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.innerHTML = '<span class="legend-title">States</span>';

        // Sort by abbreviation to keep the list orderly
        Object.keys(stateStyles).sort().forEach(stateName => {
            const cfg = stateStyles[stateName];
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
