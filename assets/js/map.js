// --- 1. CONFIG & DATA ---
const isMobile = window.innerWidth < 768;
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

const masterStats = {};
let geoJsonLayer = null;
let legendControl = null;

var map = L.map('map', {
    attribution: '&copy; OpenStreetMap &copy; CartoDB',
    zoomControl: true,
    minZoom: isMobile ? 3 : 4,
}).setView([-28.0, 133.0], isMobile ? 4 : 5);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// --- 2. CORE FUNCTIONS ---

function loadYear(year) {
    if (geoJsonLayer) map.removeLayer(geoJsonLayer);

    Papa.parse(`/assets/data/${year}.csv`, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(resultsRes) {
            resultsRes.data.forEach(row => {
                const idx = String(row.index).trim();
                if (masterStats[idx]) {
                    Object.assign(masterStats[idx], {
                        winner_name: row.name,
                        winner_surname: row.surname,
                        party: row.party,
                        colour: row.colour,
                        linked: row.linked,
                        note: row.note
                    });
                }
            }); 
            renderGeoJson(year);
        } 
    }); 
}

function renderGeoJson(year) {
    fetch(`/assets/data/${year}.geojson`)
        .then(res => res.json())
        .then(geoData => {
            geoJsonLayer = L.geoJSON(geoData, {
                style: (f) => {
                    const data = masterStats[String(f.properties.index || f.properties.Index).trim()];
                    return {
                        fillColor: '#fafafa',
                        weight: 1.5,
                        color: stateStyles[data?.state]?.color || '#666',
                        fillOpacity: 0.1
                    };
                },
                onEachFeature: setupInteractivity
            }).addTo(map);
            setupSearch();
            updateLegend();
        }).catch(err => console.error("Map Load Error:", err));
}

function setupInteractivity(feature, layer) {
    const data = masterStats[String(feature.properties.index || feature.properties.Index).trim()];
    if (!data) return;

    layer.bindTooltip(`<strong>${data.division}</strong> (${data.state})`, { sticky: true });

    // Simplified popup for stability
    const popupContent = `<div style="border-top: 5px solid ${stateStyles[data.state]?.color || '#ccc'}; padding: 5px;">
        <h3>${data.division}</h3>
        <p>${data.winner_name} ${data.winner_surname} (${data.party})</p>
    </div>`;
    layer.bindPopup(popupContent);

    layer.on({
        mouseover: (e) => {
            e.target.setStyle({ weight: 4, fillOpacity: 0.4 });
            e.target.bringToFront();
        },
        mouseout: (e) => {
            geoJsonLayer.resetStyle(e.target);
        }
    });
}

function setupSearch() {
    const input = document.getElementById('division-search');
    if (!input) return;
    input.oninput = (e) => {
        const val = e.target.value.toLowerCase().trim();
        geoJsonLayer.eachLayer(l => {
            const d = masterStats[String(l.feature.properties.index || l.feature.properties.Index).trim()];
            const match = d && d.division.toLowerCase().includes(val);
            l.setStyle(val === "" ? {weight:1.5, fillOpacity:0.1} : (match ? {weight:4, fillOpacity:0.4} : {weight:0, fillOpacity:0.05}));
        });
    };
}

function updateLegend() {
    if (legendControl) map.removeControl(legendControl);
    legendControl = L.control({ position: 'bottomright' });
    legendControl.onAdd = () => {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.background = 'white'; div.style.padding = '10px';
        div.innerHTML = '<strong>States</strong>';
        Object.keys(stateStyles).forEach(s => {
            div.innerHTML += `<br><i style="border:2px solid ${stateStyles[s].color}; width:10px; height:10px; display:inline-block"></i> ${s}`;
        });
        return div;
    };
    legendControl.addTo(map);
}

// --- 3. INITIALIZE ---
Papa.parse('/assets/data/electoral_division_data.csv', {
    download: true,
    header: true,
    complete: (res) => {
        res.data.forEach(row => { masterStats[String(row.index).trim()] = row; });
        const sel = document.getElementById('year-select');
        loadYear(sel.value);
        sel.onchange = (e) => loadYear(e.target.value);
    }
});
