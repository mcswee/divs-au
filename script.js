// 1. Initialize Map
var map = L.map('map', {
    zoomControl: true,
    minZoom: 4
}).setView([-27.00, 133.00], 5);

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

        Papa.parse('/data/2025_results.csv', {
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
    fetch('/data/2025_electoral_divisions.geojson')
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
                        // Build the badges
                        let badgesHtml = '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">';
                        
                        if (data.fed === "TRUE") badgesHtml += '<span style="background: #389b6f; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">FEDERATION</span>';
                        if (data.pm === "TRUE") badgesHtml += '<span style="background: #ffb703; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">PRIME MINISTER</span>';
                        if (data.fem === "TRUE") badgesHtml += '<span style="background: #7209b7; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">WOMAN</span>';
                        if (data.ind === "TRUE") badgesHtml += '<span style="background: #e85d04; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">INDIGENOUS</span>';
                        if (data.geo === "TRUE") badgesHtml += '<span style="background: #7f5539; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">GEOGRAPHIC</span>';
                        if (data.old === "TRUE") badgesHtml += '<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">COLONIAL</span>';
                        
                        // "AUS" logic: Badge shows if they are NOT Australian (False)
                        if (data.aus === "FALSE") badgesHtml += '<span style="background: #b62631; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">NON-AUSTRALIAN</span>';
                        
                        badgesHtml += '</div>';

                        layer.bindTooltip(`<strong>${data.division}</strong> (${data.state})`, {
                            sticky: true,
                            direction: 'top'
                        });

                        const popupContent = `
                            <div style="border-top: 5px solid ${data.colour || '#ccc'}; padding: 5px; min-width: 160px;">
                                <h3 style="margin: 0 0 5px 0;">${data.division}</h3>
                                <p style="margin: 0 0 8px 0; color: #666; font-size: 0.9em;">${data.state}</p>
                                <p style="margin: 0 0 5px 0; font-size: 0.85em;"><strong>Created:</strong> ${data.created}</p>
                                <p style="margin: 0 0 5px 0; font-size: 0.85em;"><strong>Named for:</strong> ${data.namesake}</p>
                                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee;">
                                    <strong style="font-size: 0.85em;">Current MP:</strong><br>
                                    ${data.winner_name} ${data.winner_surname}<br>
                                    <span style="color: ${data.colour || '#333'}; font-weight: bold;">${data.party}</span>
                                </div>
                                ${badgesHtml}
                                ${data.note ? `<div style="font-size: 0.8em; font-style: italic; border-top: 1px solid #eee; padding-top: 5px; margin-top: 8px;">${data.note}</div>` : ''}
                            </div>
                        `;
                        layer.bindPopup(popupContent);

                        layer.on({
                            mouseover: (e) => {
                                const l = e.target;
                                l.setStyle({ fillOpacity: 0.9, weight: 2, color: 'white' });
                                l.bringToFront();
                            },
                            mouseout: (e) => {
                                geoJsonLayer.resetStyle(e.target);
                            }
                        });
                    }
                }
            }).addTo(map);

            setupSearch(geoJsonLayer);

            if (typeof addLegend === "function") {
                addLegend(partyColours);
            }
        });
}


function setupSearch(geoJsonLayer) {
    const searchInput = document.getElementById('division-search');
    if (!searchInput) return;

    // This handles the highlighting as you type
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase().trim();
        
        geoJsonLayer.eachLayer((layer) => {
            const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
            const seatData = masterStats[seatIndex];
            const divName = seatData ? seatData.division.toLowerCase() : "";
            
            if (value === "") {
                geoJsonLayer.resetStyle(layer);
            } else if (divName.includes(value)) {
                layer.setStyle({ fillOpacity: 0.9, weight: 2, color: 'white' });
            } else {
                layer.setStyle({ fillOpacity: 0.05, weight: 0 });
            }
        });
    });

    // This handles zooming when you hit Enter
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const value = e.target.value.toLowerCase().trim();
            if (value === "") return;

            let firstMatch = null;

            geoJsonLayer.eachLayer((layer) => {
                const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
                const seatData = masterStats[seatIndex];
                const divName = seatData ? seatData.division.toLowerCase() : "";

                // Find the first division that actually matches the search string
                if (!firstMatch && divName.includes(value)) {
                    firstMatch = layer;
                }
            });

            if (firstMatch) {
                // Zoom to the division and pop the bubble open
                map.fitBounds(firstMatch.getBounds(), { padding: [50, 50], maxZoom: 12 });
                firstMatch.openPopup();
            }
        }
    });
}
