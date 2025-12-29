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
                note: row.note || ""
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
                    const data = masterStats[String(feature.properties.Index).trim()];
                    return {
                        fillColor: data ? data.colour : '#888',
                        weight: 1,
                        color: 'white',
                        fillOpacity: 0.6 
                    };
                },
                onEachFeature: (feature, layer) => {
                    const data = masterStats[String(feature.properties.Index).trim()];
                    if (data) {
                        layer.bindTooltip(`<strong>${data.division} (${data.state})</strong>`, { sticky: true });
                        const popupContent = `
                            <div style="border-top: 5px solid ${data.colour}; padding: 5px;">
                                <h3>${data.division} (${data.state})</h3>
                                <strong>Won by: </strong>${data.winner_name} ${data.winner_surname} (${data.party})
                                <p>${data.note}</p>
                            </div>`;
                        layer.bindPopup(popupContent);
                    }
                }
            }).addTo(map);
            setupSearch(geoJsonLayer);
        });
}

function setupSearch(layerGroup) {
    const searchInput = document.getElementById('division-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', function(e) {
        const val = e.target.value.toLowerCase().trim();
        if (val.length < 3) return;
        layerGroup.eachLayer(layer => {
            const data = masterStats[String(layer.feature.properties.Index).trim()];
            if (data && data.division.toLowerCase().includes(val)) {
                map.fitBounds(layer.getBounds());
                layer.openPopup();
            }
        });
    });
}
