const map = L.map('state-report-map').setView([-35.3, 149.1], 9);

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

      var mainlandBounds = L.latLngBounds();

      geoLayer = L.geoJSON(data, {
        style: {
          color: "#003895",
          weight: 1
        },
        onEachFeature: function (feature, layer) {
          if (feature.properties) {
            var p = feature.properties;
            var tooltip = "<b>" + (p.Elect_div || "Unknown Division") + "</b><br>" +
                          "<strong>No of SA1:</strong> " + (p.Numccds || "—") + "<br>" +
                          "<strong>Actual enrolment:</strong> " + (p.Actual || "—") + "<br>" +
                          "<strong>Projected enrolment:</strong> " + (p.Projected || "—");
            layer.bindTooltip(tooltip, { sticky: true });
          }

          if (layer.getBounds().getWest() < 155) {
             mainlandBounds.extend(layer.getBounds());
          }
        }
      }).addTo(map);

      if (mainlandBounds.isValid()) {
          map.fitBounds(mainlandBounds, { padding: [30, 30] });
      }
    })
    .catch(err => console.error(`Failed to load ${file}`, err));
}

// Default load
loadGeoJSON('2025-ACT-Proposed.geojson');

// If you still want year navigation later:
document.querySelectorAll('#year-nav a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const year = link.dataset.year;
    loadGeoJSON(`data/divisions-${year}.geojson`);
  });
});
