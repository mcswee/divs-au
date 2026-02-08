/**
 * ACT-Specific Map Script
 * Focuses on mainland ACT while ignoring Norfolk Island/Jervis Bay.
 */

// 1. Initialize Map with dynamic zoom for mobile vs desktop
const initialZoom = window.innerWidth < 600 ? 8 : 9;
const map = L.map('state-map').setView([-35.47, 149.01], initialZoom);

// 2. Base Layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CartoDB</a> | Data <a href="/copyright">&copy; AEC & ABS</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// Clean up the Leaflet prefix
map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');

let geoLayer = null;

/**
 * Loads GeoJSON and adds it to the map without forcing a re-zoom.
 */
function loadGeoJSON(file) {
  fetch(file)
    .then(res => res.json())
    .then(function (data) {
      // Remove old layer if switching years
      if (geoLayer) {
        map.removeLayer(geoLayer);
      }

      // Add the new layer
      geoLayer = L.geoJSON(data, {
        style: {
          color: "#003895",
          weight: 1,
          fillOpacity: 0.2
        },
        onEachFeature: function (feature, layer) {
          if (feature.properties) {
            var p = feature.properties;
            var tooltip = "<b>" + (p["Proposed Division"] || "Unknown Division") + "</b><br>" +
                          "<strong>No of SA1:</strong> " + (p.Numccds || "—") + "<br>" +
                          "<strong>Actual enrolment:</strong> " + (p.Actual || "—") + "<br>" +
                          "<strong>Projected enrolment:</strong> " + (p.Projected || "—");
            
            layer.bindTooltip(tooltip, { sticky: true });
          }
        }
      }).addTo(map);
    })
    .catch(err => console.error(`Failed to load ${file}`, err));
}

// 3. Initial Load
loadGeoJSON('/assets/data/act-2025-proposed.geojson');
