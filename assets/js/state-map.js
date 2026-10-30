document.addEventListener('DOMContentLoaded', () => {
    const mapEl = document.getElementById('state-map');
    if (!mapEl) return;

    const { geojson, lat, lng, zoom, state } = mapEl.dataset;
    const style = getComputedStyle(mapEl);
    const brandColor = style.getPropertyValue('--contrast').trim() || 
                   style.getPropertyValue('--trad').trim() || 
                   "#333366";

    // Initialise using Front Matter values
    const map = L.map('state-map').setView([lat, lng], parseInt(zoom));
    L.tileLayer("https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_3li0_1_3bd3e03fbf5a91dbb6cb9f61", {
       attribution: 'Tiles &copy; <a href="https://carto.com/attributions">CARTO</a> | Data <a href="/copyright/">ABS</a>',
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
                                <div class="tooltip-header" style="border-color: ${brandColor}">${p.division || "Unknown"}</div>
                                <div class="tooltip-row"><span>SA1s:</span> <strong>${p.ccds || "—"}</strong></div>
                                <div class="tooltip-row"><span>Actual:</span> <strong>${p.actual || "—"}</strong></div>
                                <div class="tooltip-row"><span>Projected:</span> <strong>${p.projected || "—"}</strong></div>
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
