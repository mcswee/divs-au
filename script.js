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
                    // Check for 'index' - adjust to 'Index' if the GeoJSON uses a capital I
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
                        layer.bindTooltip(`<strong>${data.division}</strong> (${data.state})`, {
                            sticky: true,
                            direction: 'top'
                        });

                        const popupContent = `
                            <div style="border-top: 5px solid ${data.colour || '#ccc'}; padding: 5px; min-width: 130px;">
                                <h3 style="margin: 0 0 5px 0;">${data.division}</h3>
                                <p style="margin: 0 0 8px 0; color: #666;">${data.state}</p>
                                <p style="margin: 0 0 5px 0;"><strong>Created:</strong> ${data.created}</p>
                                <p style="margin: 0 0 5px 0;"><strong>Named for:</strong> ${data.namesake}</p>
                                <div style="margin-bottom: 8px">
                                    <strong>Won by: </strong>${data.winner_name} ${data.winner_surname}<br>
                                    <span style="color: ${data.colour || '#333'}; font-weight: bold;">${data.party}</span>
                                </div>
                                ${data.note ? `<div style="font-size: 0.85em; font-style: italic; border-top: 1px solid #eee; padding-top: 5px;">${data.note}</div>` : ''}
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

    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase().trim();
        
        geoJsonLayer.eachLayer((layer) => {
            const seatIndex = String(layer.feature.properties.index || layer.feature.properties.Index).trim();
            const seatData = masterStats[seatIndex];
            const divName = seatData ? seatData.division.toLowerCase() : "";
            
            if (value === "") {
                geoJsonLayer.resetStyle(layer);
            } else if (divName.includes(value)) {
                layer.setStyle({
                    fillOpacity: 0.9,
                    weight: 2,
                    color: 'white'
                });
            } else {
                layer.setStyle({
                    fillOpacity: 0.05,
                    weight: 0
                });
            }
        });
    });
}
