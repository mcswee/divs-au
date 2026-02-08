const map = L.map('state-map').setView([-42, 146], 7); // Centre of Aus

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a> | Data <a href="/copyright">&copy; AEC & ABS</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

let geoLayer = null;

function loadGeoJSON(file) {
  fetch(file)
    .then(res => res.json())
.then(function (data) {
  if (geoLayer) {
    map.removeLayer(geoLayer);
  }

  geoLayer = L.geoJSON(data, {
    style: {
      color: "#006746",
      weight: 1
    },
    onEachFeature: function (feature, layer) {
      if (feature.properties) {
        var p = feature.properties;
        var tooltip = "<b>" + (p["Proposed Division"] || "Unknown Division") + "</b><br>" +
                      "<strong>No of SA1:</strong> " + (p.Numccds || "—") + "<br>" +
                      "<strong>Actual enrollment:</strong> " + (p.Actual || "—") + "<br>" +
                      "<strong>Projected enrollment:</strong> " + (p.Projected || "—");
        layer.bindTooltip(tooltip, { sticky: true });
      }
    }
  }).addTo(map);

  map.fitBounds(geoLayer.getBounds());
})
    .catch(err => console.error(`Failed to load ${file}`, err));
}

// Default load
loadGeoJSON('/assets/data/tas-2025-proposed.geojson');
