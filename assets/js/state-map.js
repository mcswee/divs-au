document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('state-map');
    if (!mapEl) return;

    const { geojson, lat, lng, zoom, state, color } = mapEl.dataset;
    const style = getComputedStyle(mapEl);
    const brandColor = style.getPropertyValue('--contrast').trim() || 
                   style.getPropertyValue('--trad').trim() || 
                   "#333366";

    // Initialise using Front Matter values
    const map = L.map('state-map').setView([lat, lng], parseInt(zoom));

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a> Data: &copy; <a href="/copyright">ABS</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

    function disableMapTabOrder() {
        mapEl.querySelectorAll('a, button').forEach(el => el.setAttribute('tabindex', '-1'));
    }

    disableMapTabOrder();

    fetch(geojson)
        .then(res => res.json())
        .then(data => {
            const geoLayer = L.geoJSON(data, {
                style: { 
                    color: brandColor,
                    weight: 1.5,
                    fillOpacity: 0.25
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        const p = feature.properties;
                        // Dynamic border color matches the state/brand color
                        const tooltipContent = `
                            <div class="map-tooltip-popup">
                                <div class="tooltip-header" style="border-color: ${brandColor}">${p.Name || "Unknown"}</div>
                                <div class="tooltip-row"><span>SA1s:</span> <strong>${p.Numccds || "—"}</strong></div>
                                <div class="tooltip-row"><span>Actual:</span> <strong>${p.Actual || "—"}</strong></div>
                                <div class="tooltip-row"><span>Projected:</span> <strong>${p.Projected || "—"}</strong></div>
                            </div>`;
                        layer.bindTooltip(tooltipContent, { 
                            sticky: true,
                            className: 'custom-map-tooltip' 
                        });
                    }
                }
            }).addTo(map);

            const status = document.getElementById('map-status');
            if (status) status.textContent = `Map data for ${state} has loaded.`;

            disableMapTabOrder();
            
            // Skip fitBounds for states with massive territorial outliers
            const outliers = ["ACT", "NT", "Australian Capital Territory", "Northern Territory"];
            if (!outliers.includes(state)) {
                map.fitBounds(geoLayer.getBounds());
            }
        })
        .catch(err => console.error(`Failed to load ${geojson}`, err));
});
