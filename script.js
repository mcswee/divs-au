const map = L.map('map').setView([-28.5, 135], 5); // Centre of Aus
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CartoDB',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

let geoLayer = null;

function loadGeoJSON(year) {
  const file = `data/divisions-${year}.geojson`;

  fetch(file)
    .then(res => res.json())
    .then(data => {
      if (geoLayer) map.removeLayer(geoLayer);
      geoLayer = L.geoJSON(data, {
        style: { color: "#005a9c", weight: 1 }
      }).addTo(map);
    })
    .catch(err => console.error(`Failed to load ${file}`, err));
}

document.querySelectorAll('#year-nav a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const year = link.dataset.year;
    loadGeoJSON(year);
  });
});

// Load default year
loadGeoJSON('2022');
