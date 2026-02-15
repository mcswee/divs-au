// --- 1. MAP INITIALIZATION ---
const isMobile = window.innerWidth < 768;
const initialZoom = isMobile ? 4 : 5;
const minZoom = isMobile ? 3 : 4;
const initialCenter = [-28.0, 133.0];

const stateStyles = {
    'NSW': { color: '#0075be' },
    'VIC': { color: '#001f7e' },
    'QLD': { color: '#73182c' },
    'WA':  { color: '#c98600' },
    'SA':  { color: '#d50032' },
    'TAS': { color: '#006747' },
    'ACT': { color: '#012b88' },
    'NT':  { color: '#c75b12' }
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
                                    <div style="font-size: 0.85em; color: #888; margin-bottom: 4px; letter-spacing: 0.3px;">Elected Member
