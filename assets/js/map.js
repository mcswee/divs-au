// --- 1. MAP INITIALIZATION ---
const isMobile = window.innerWidth < 768;
const initialZoom = isMobile ? 4 : 5;
const minZoom = isMobile ? 3 : 4;
const initialCenter = [-28.0, 133.0];

var map = L.map('map', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a> | Data <a href="/copyright">&copy; AEC & ABS</a>',
    zoomControl: true,
    minZoom: minZoom,
}).setView(initialCenter, initialZoom);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM contributors &copy; CARTO',
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
                    return {
                        fillColor: 'var(--highlight)',
                        weight: 1,
                        color: 'var(--text-accent)',
                        fillOpacity: 0.8
                    };
                }, 

                onEachFeature: (feature, layer) => {
                    const seatIndex = String(feature.properties.index || feature.properties.Index).trim();
                    const data = masterStats[seatIndex];

                    if (data) {
                        let badgesList = '';
                        if (data.fed === "TRUE") badgesList += '<span class="badge fed">FEDERATION</span>';
                        if (data.pm === "TRUE") badgesList += '<span class="badge pm">PRIME MINISTER</span>';
                        if (data.fem === "TRUE") badgesList += '<span class="badge fem">WOMAN</span>';
                        if (data.ind === "TRUE") badgesList += '<span class="badge ind">INDIGENOUS</span>';
                        if (data.geo === "TRUE") badgesList += '<span class="badge geo">GEOGRAPHIC</span>';
                        if (data.linked === "FALSE") badgesList += '<span class="badge linked">DRIFTED</span>';
                        if (data.old === "TRUE") badgesList += '<span class="badge old">COLONIAL</span>';
                        if (data.aus === "FALSE") badgesList += '<span class="badge nonaus">NON-AUSTRALIAN</span>';

                        let badgesHtml = badgesList ? `<div class="badge-container">${badgesList}</div>` : '';

                        layer.bindTooltip(`<strong>${data.division}</strong> (${data.state})`, {
                            sticky: true,
                            direction: 'top',
                            className:'modern-tooltip',
                            offset: [0, 5]
                        });

                        const popupContent = `
                            <div class="map-popup-card">
                                <header class="popup-header">
                                    <h2 class="popup-title">${data.division}</h2>
                                    <p class="popup-subtitle">${data.state}</p>
                                </header>
                                <section class="popup-body">
                                    <p class="namesake-text">Named for ${data.namesake}.</p>
                                    <div class="stat-meta">Established ${data.created}</div>
                                    ${badgesHtml}
                                </section>
                                <footer class="popup-footer">
                                    <div class="member-info">
                                        <span class="member-name">${data.winner_name} ${data.winner_surname}</span>
                                        <span class="party-pill" style="--party-colour: ${data.colour}">${data.party.toUpperCase()}</span>
                                    </div>
                                    ${data.note ? `<div class="popup-note">${data.note}</div>` : ''}
                                </footer>
                            </div>`;

                        layer.bindPopup(popupContent);

                        layer.on({
                            mouseover: (e) => {
                                const l = e.target;
                                if (geoJsonLayer.searchActive && !l.isSearchMatch) return;
                                l.setStyle({ 
                                    fillOpacity: 0.9, 
                                    weight: 2, 
                                    color: 'var(--brand-main)' 
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

// --- 4. SEARCH FUNCTIONALITY ---
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
                layer.setStyle({ fillOpacity: 0.9, weight: 2, color: 'var(--brand-main)' });
            } else {
                layer.isSearchMatch = false;
                layer.setStyle({ fillOpacity: 0.05, weight: 0 });
            }
        }); 
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
                map.fitBounds(firstMatch.getBounds(), { padding: [50, 50], maxZoom: 12 });
                firstMatch.openPopup();
            }
        } 
    }); 
} 

// --- 5. LEGEND GENERATION ---
let legendControl; 

function updateLegend() {
    if (legendControl) map.removeControl(legendControl);

    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        const parties = {};

        Object.values(masterStats).forEach(data => {
            if (data.party && data.colour) parties[data.party] = data.colour;
        }); 

        const sortedParties = Object.keys(parties).sort();
        div.innerHTML = '<strong style="display:block; margin-bottom: 5px;">Party</strong>';

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
