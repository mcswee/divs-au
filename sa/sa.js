document.addEventListener('DOMContentLoaded', async () => {
  const map = L.map('map').setView([-30.5, 135.5], 6);

  // Base map
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '© CartoDB, © OpenStreetMap contributors'
}).addTo(map);
  

  // Fetch the GeoJSON
  const response = await fetch('/sa/2025-SA-Proposed.geojson');
  const data = await response.json();

  // Style for divisions
  const baseStyle = {
    color: '#0074d9',
    weight: 2,
    fillOpacity: 0.2
  };

  const highlightStyle = {
    color: '#001f3f',
    weight: 3,
    fillOpacity: 0.4
  };

  // Define interaction behaviour
  function onEachFeature(feature, layer) {
    const props = feature.properties;

    // Tooltip for hover info
    if (props) {
// sa.js
document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('map').setView([-30.5, 135.5], 6);

  // Base map
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Load GeoJSON
  fetch('2025-SA-Proposed.geojson')
    .then(res => res.json())
    .then(data => {
      const baseStyle = { color: '#0074d9', weight: 2, fillOpacity: 0.2 };
      const highlightStyle = { color: '#001f3f', weight: 3, fillOpacity: 0.4 };

      const geoLayer = L.geoJSON(data, {
        style: baseStyle,
        onEachFeature: (feature, layer) => {
          const props = feature.properties;
          if (props) {
            const tooltip = `<strong>${props.name}</strong><br>
              Actual enrolment: ${props.actual_enrolment ? props.actual_enrolment.toLocaleString() : 'N/A'}<br>
              Projected enrolment: ${props.projected_enrolment ? props.projected_enrolment.toLocaleString() : 'N/A'}`;
            layer.bindTooltip(tooltip, { sticky: true });
          }

          layer.on({
            mouseover: e => {
              e.target.setStyle(highlightStyle);
              e.target.bringToFront();
            },
            mouseout: e => {
              geoLayer.resetStyle(e.target);
            }
          });
        }
      }).addTo(map);

      map.fitBounds(geoLayer.getBounds());
    })
    .catch(err => console.error('Failed to load GeoJSON:', err));
});
