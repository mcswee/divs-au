// Detect mobile and set initial zoom/view
const isMobile = window.innerWidth < 768;
const initialZoom = isMobile ? 4 : 5;
const minZoom = isMobile ? 3 : 4;
const initialCenter = [-28.0, 133.0];

var map = L.map('map', {
    zoomControl: true,
    minZoom: minZoom,
}).setView(initialCenter, initialZoom);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

const masterStats = {};
const partyColours = {}; 

// 2. The Double-Join
Papa.parse('/data/electoral_division_data.csv', {
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

        Papa.parse('/data/2025.csv', {
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
                        masterStats[idx].note = row.note;
                        if (row.party && row.colour) partyColours[row.party] = row.colour;
                    }
                });
                loadMapLayer();
            }
        });
    }
});

function loadMapLayer() {
    fetch('/data/2025.geojson')
        .then(res => res.json())
        .then(geoData => {
            const geoJsonLayer = L.geoJSON(geoData, {
                style: (feature) => {
                    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
                    const data = masterStats[seatIndex];
                    return {
                        fillColor: data ? data.colour : '#888',
                        weight: 1,
                        color: 'white',
                        fillOpacity: 0.6
                    };
                },
                onEachFeature: (feature, layer) => {
                    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
                    const data = masterStats[seatIndex];
                    
                    if (data) {
                        // 1. Initialize variables
                        let badgeCount = 0;
                        let badgesList = '';
                        
                        // 2. Build the badge strings
                        if (data.fed === "TRUE") { badgesList += '<span class="badge fed">FEDERATION</span>'; badgeCount++; }
                        if (data.pm === "TRUE") { badgesList += '<span class="badge pm">PRIME MINISTER</span>'; badgeCount++; }
                        if (data.fem === "TRUE") { badgesList += '<span class="badge fem">WOMAN</span>'; badgeCount++; }
                        if (data.ind === "TRUE") { badgesList += '<span class="badge ind">INDIGENOUS</span>'; badgeCount++; }
                        if (data.geo === "TRUE") { badgesList += '<span class="badge geo">GEOGRAPHIC</span>'; badgeCount++; }
                        if (data.old === "TRUE") { badgesList += '<span class="badge old">COLONIAL</span>'; badgeCount++; }
                        if (data.aus === "FALSE") { badgesList += '<span class="badge nonaus">NON-AUSTRALIAN</span>'; badgeCount++; }
                        
                        // 3. Construct the final HTML block
                        let badgesHtml = '';
                        if (badgeCount > 0) {
                            badgesHtml = `
                                <div style="margin-top: 12px; margin-bottom: 12px;">
                                    <div style="font-size: 0.75em; color: #888; margin-bottom: 6px; letter-spacing: 0.3px; font-weight: bold;">DIVISION NAME CLASSIFICATION</div>
                                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                        ${badgesList}
                                    </div>
                                </div>
                            `;
                        }

                        layer.bindTooltip(`<strong>${data.division}</strong> (${data.state})`, {
                            sticky: true,
                            direction: 'top'
                        });

                        const popupContent = `
                            <div style="border-top: 5px solid ${data.colour || '#ccc'}; padding: 5px; min-width: 250px;">
                                <h3 style="margin: 0 0 2px 0;">${data.division}</h3>
                                <p style="margin: 0 0 8px 0; color: #666; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px;">${data.state}</p>
                                <div style="font-size: 0.85em; line-height: 1.4; margin-bottom: 4px;">
                                    <strong>Created:</strong> ${data.created}<br>
                                    <strong>Named for:</strong> ${data.namesake}
                                </div>
                                <div style="margin-bottom: 12px;">
                                    ${badgesHtml}
                                </div>
                                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee;">
                                    <div style="font-size: 0.75em; color: #888; margin-bottom: 4px; letter-spacing: 0.3px;">ELECTED MEMBER</div>
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <span style="font-weight: bold; font-size: 0.95em;">${data.winner_name} ${data.winner_surname}</span>
                                        <span style="background: white; color: ${data.colour || '#333'}; padding: 1px 8px; border: 1px solid ${data.colour || '#333'}; border-radius: 12px; font-size: 10px; font-weight: bold; white-space: nowrap;">
                                            ${data.party.toUpperCase()}
                                        </span>
                                    </div>
                                    ${data.note ? `
                                        <div style="font-size: 0.8em; margin-top: 8px; padding: 6px; background: #fff0f0; border-left: 3px solid #ccc; color: #444; line-height: 1.3;">
                                            ${data.note}
                                        </div>` : ''}
                                </div>
                            </div>
                        `;

                        layer.bindPopup(popupContent);

           layer.on({
    mouseover: (e) => {
        const l = e.target;
        // If a search is happening and this isn't a match, don't highlight
        if (geoJsonLayer.searchActive && !l.isSearchMatch) return;

        l.setStyle({ fillOpacity: 0.9, weight: 2, color: 'white' });
        l.bringToFront();
    },
    mouseout: (e) => {
        const l = e.target;
        // If it's a non-match during a search, force it to stay faded
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
        }); // Correctly closing the .then(geoData => { block
} // Correctly closing the loadMapLayer function


function setupSearch(geoJsonLayer) {
    const searchInput = document.getElementById('division-search');
    if (!searchInput) return;

searchInput.addEventListener('input', (e) => {
    const value = e.target.value.toLowerCase().trim();
    
    // Flag if the search is active globally on the layer group
    geoJsonLayer.searchActive = (value !== "");

    geoJsonLayer.eachLayer((layer) => {
        const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
        const seatData = masterStats[seatIndex];
        const divName = seatData ? seatData.division.toLowerCase() : "";
        
        if (value === "") {
            layer.isSearchMatch = false;
            geoJsonLayer.resetStyle(layer);
        } else if (divName.includes(value)) {
            layer.isSearchMatch = true; // Flag as a match
            layer.setStyle({ fillOpacity: 0.9, weight: 2, color: 'white' });
        } else {
            layer.isSearchMatch = false; // Flag as a non-match
            layer.setStyle({ fillOpacity: 0.05, weight: 0 });
        }
    });
});

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = e.target.value.toLowerCase().trim();
            if (value === "") return;
            let firstMatch = null;
            geoJsonLayer.eachLayer((layer) => {
                const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
                const seatData = masterStats[seatIndex];
                const divName = seatData ? seatData.division.toLowerCase() : "";
                if (!firstMatch && divName.includes(value)) {
                    firstMatch = layer;
                }
            });
            if (firstMatch) {
                map.fitBounds(firstMatch.getBounds(), { padding: [50, 50], maxZoom: 12 });
                firstMatch.openPopup();
            }
        }
    });
}

let legendControl; 

function updateLegend() {
    if (legendControl) {
        map.removeControl(legendControl);
    }
    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        const parties = {};
        Object.values(masterStats).forEach(data => {
            if (data.party && !parties[data.party]) {
                parties[data.party] = data.colour;
            }
        });
        const sortedParties = Object.keys(parties).sort();
        div.innerHTML = '<strong style="display:block; margin-bottom: 5px; border-bottom: 1px solid #ccc;">RESULTS</strong>';
        sortedParties.forEach(party => {
            div.innerHTML += `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${parties[party]}"></div>
                    <span>${party.toUpperCase()}</span>
                </div>`;
        });
        return div;
    };
    legendControl.addTo(map);
}
