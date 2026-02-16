// --- 1. MAP INITIALIZATION ---
const isMobile = window.innerWidth < 768;
const initialZoom = isMobile ? 4 : 5;
const minZoom = isMobile ? 3 : 4;
const initialCenter = [-28.0, 133.0];

const stateStyles = {
    'New South Wales': { color: '#0075be' },
    'Victoria': { color: '#001f7e' },
    'Queensland': { color: '#73182c' },
    'Western Australia':  { color: '#c98600' },
    'South Australia':  { color: '#d50032' },
    'Tasmania': { color: '#006747' },
    'Australian Capital Territory': { color: '#012b88' },
    'Northern Territory':  { color: '#c75b12' }
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
            const idx = String(row.index || row.Index).trim();
            masterStats[idx] = row;
        }); 

        const yearSelector = document.getElementById('year-select');
        if (yearSelector) {
            loadYear(yearSelector.value);
            yearSelector.addEventListener('change', (e) => loadYear(e.target.value));
        }
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
                const idx = String(row.index || row.Index).trim();
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
                    const sName = data ? data.state : 'Unknown';
                    const stateColor = stateStyles[sName]?.color || '#666';
                    
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
                        const sName = data.state || 'Unknown';
                        const stateColor = stateStyles[sName]?.color || '#666';

                        let badgesList = '';
                        if (String(data.fed).toUpperCase() === "TRUE") badgesList += '<span class="badge fed">FEDERATION</span>';
                        if (String(data.pm).toUpperCase() === "TRUE") badgesList += '<span class="badge pm">PRIME MINISTER</span>';
                        if (String(data.fem).toUpperCase() === "TRUE") badgesList += '<span class="badge fem">WOMAN</span>';
                        if (String(data.ind).toUpperCase() === "TRUE") badgesList += '<span class="badge ind">INDIGENOUS</span>';
                        if (String(data.geo).toUpperCase() === "TRUE") badgesList += '<span class="badge geo">GEOGRAPHIC</span>';
                        if (String(data.linked).toUpperCase() === "FALSE") badgesList += '<span class="badge linked">DRIFTED</span>';
                        if (String(data.old).toUpperCase() === "TRUE") badgesList += '<span class="badge old">COLONIAL</span>';
                        if (String(data.aus).toUpperCase() === "FALSE") badgesList += '<span class="badge nonaus">NON-AUSTRALIAN</span>';

                        const badgesHtml = badgesList ? `
                            <div style="margin-top: 12px; margin-bottom: 12px;">
                                <div style="font-size: 0.85em; color: #888; margin-bottom: 6px; letter-spacing: 0.3px; font-weight: bold;">Division name classification</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 4px;">${badgesList}</div>
                            </div>` : '';

                        layer.bindTooltip(`<strong>${data.division}</strong>`, {
                            sticky: true,
                            direction: 'top',
                            className:'modern-tooltip',
                            offset: [0, 5]
                        });

                        const popupContent = `
                            <div style="border-top: 5px solid ${stateColor}; padding: 5px; min-width: 240px;">
                                <h2 style="margin: 0 0 2px 0; border-bottom: none; font-size: 1.2rem;">${data.division}</h2>
                                <p style="margin: 0 0 8px 0; color: #666; font-size: 0.85em; letter-spacing: 0.65px;">${sName}</p>
                                <div style="font-size: 0.9em; line-height: 1.4; margin-bottom: 4px;">
                                    <strong>Date created:</strong> ${data.created}<br>
                                    <strong>Named for:</strong> ${data.namesake}
                                </div>
                                ${badgesHtml}
                                <div style="margin-top: 16px; padding-top: 2px; border-top: 1px solid #eee;">
                                    <div style="font-size: 0.85em; color: #888; margin-bottom: 4px; letter-spacing: 0.3px;">Elected Member</div>
                                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                        <span style="font-weight: bold; font-size: 1.05em;">${data.winner_name} ${data.winner_surname}</span>
                                        <span style="background: white; color: ${data.colour || '#333'}; padding: 1px 8px; border: 1px solid ${data.colour || '#333'}; border-radius: 12px; font-size: 10px; font-weight: bold; white-space: nowrap;">
                                            ${(data.party || '').toUpperCase()}
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
                                l.setStyle({ fillOpacity: 0.4, weight: 4, color: stateColor });
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
                const sColor = stateStyles[seatData.state]?.color || '#666';
                layer.setStyle({ fillOpacity: 0.4, weight: 4, color: sColor });
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
        div.style.cssText = 'background:rgba(255,255,255,0.9); padding:10px; border-radius:4px; box-shadow:0 0 15px rgba(0,0,0,0.2);';
        div.innerHTML = '<strong style="display:block; margin-bottom: 8px;">State</strong>';

        Object.keys(stateStyles).sort().forEach(state => {
            const color = stateStyles[state].color;
            div.innerHTML += `
                <div style="display: flex; align-items: center; margin-bottom: 4px; font-size: 12px;">
                    <i style="width: 14px; height: 14px; display: inline-block; margin-right: 8px; border: 2px solid ${color}; background: rgba(250, 250, 250, 0.2);"></i>
                    <span>${state}</span>
                </div>`;
        }); 

        return div;
    }; 
    legendControl.addTo(map);
}
