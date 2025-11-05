const map = L.map('map').setView([-28.5, 135], 5); // Centre of Aus

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CartoDB',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

let geoLayer = null;

function loadGeoJSON(file) {
  fetch(file)
    .then(res => res.json())
    .then(data => {
      if (geoLayer) map.removeLayer(geoLayer);
      geoLayer = L.geoJSON(data, {
        style: { color: "#d51c38", weight: 1 }
      }).addTo(map);
      map.fitBounds(geoLayer.getBounds());
    onEachFeature: (feature, layer) => {
          const props = feature.properties;
          const tooltip = `
            <strong>${props.Elect_div || 'Unknown Division'}</strong><br>
            Numccds: ${props.Numccds ?? '—'}<br>
            Actual: ${props.Actual ?? '—'}<br>
            Projected: ${props.Projected ?? '—'}
          `;
          layer.bindTooltip(tooltip, { sticky: true });
    }
    
    })
    .catch(err => console.error(`Failed to load ${file}`, err));
}

// Default load
loadGeoJSON('2025-SA-Proposed.geojson');


  });
});
