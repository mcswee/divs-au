const map = L.map('state-map').setView([-28.5, 135], 5); // Centre of Aus

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
.then(function (data) {
  if (geoLayer) {
    map.removeLayer(geoLayer);
  }

  geoLayer = L.geoJSON(data, {
    style: {
      color: "#d51c38",
      weight: 1,
    },
    onEachFeature: function (feature, layer) {
      if (feature.properties) {
        var p = feature.properties;
        var tooltip = "<b>" + (p.Elect_div || "Unknown Division") + "</b><br>" +
                      "<strong> No of SA1:</strong> " + (p.Numccds || "—") + "<br>" +
                      "<strong>Actual enrolment:</strong> " + (p.Actual || "—") + "<br>" +
                      "<strong>Projected enrolment:</strong> " + (p.Projected || "—");
        layer.bindTooltip(tooltip, { sticky: true });
      }
    }
  }).addTo(map);

  map.fitBounds(geoLayer.getBounds());
})
    .catch(err => console.error(`Failed to load ${file}`, err));
}

// Default load
loadGeoJSON('2025-SA-Proposed.geojson');

// If you still want year navigation later:
document.querySelectorAll('#year-nav a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const year = link.dataset.year;
    loadGeoJSON(`data/divisions-${year}.geojson`);
  });
});
