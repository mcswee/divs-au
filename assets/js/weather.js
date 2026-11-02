(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const page = $('weather-page');
  if (!page) return;

  const container = $('globe-container');
  const regionEl = $('weather-region');
  const noteEl = $('weather-note');
  const modeButton = $('weather-mode');
  const modeText = $('weather-mode-text');
  const modeSr = $('weather-mode-sr');
  const pauseButton = $('weather-pause');
  const prevButton = $('weather-prev');
  const nextButton = $('weather-next');
  const listToggle = $('weather-list-toggle');
  const fullscreenButton = $('weather-fullscreen');
  const panel = $('weather-panel');
  const panelTitle = $('weather-panel-title');
  const listEl = $('weather-list');
  const statusEl = $('weather-status');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const mobileQuery = window.matchMedia('(max-width: 600px)');
  const isMobile = () => mobileQuery.matches;

  // ── Stops: each is one camera position and the cities shown from it ───────────
  // offsetY and forecastShiftX nudge a badge on desktop so neighbouring badges don't overlap
  const STOPS = [
    {
      region: "Pacific",
      lookAt: { lat: -18.14, lng: -178.9, altitude: 1.2 },
      cities: [
        { name: "Apia", lat: -13.83, lng: -171.76 },
        { name: "Auckland", lat: -36.84, lng: 174.76 },
        { name: "Christchurch", lat: -43.53, lng: 172.63, offsetY: 12 },
        { name: "Honiara", lat: -9.45, lng: 159.97, offsetY: -12 },
        { name: "Honolulu", lat: 21.30, lng: -157.85 },
        { name: "Nouméa", lat: -22.27, lng: 166.45 },
        { name: "Papeete", lat: -17.53, lng: -149.56 },
        { name: "Port Moresby", lat: -9.44, lng: 147.18, offsetY: 6 },
        { name: "Port Vila", lat: -17.73, lng: 168.32, forecastShiftX: -18 },
        { name: "Rarotonga", lat: -21.24, lng: -159.77, offsetY: 6 },
        { name: "Saipan", lat: 15.18, lng: 145.75 },
        { name: "Suva", lat: -18.14, lng: 178.44 },
        { name: "Wellington", lat: -41.28, lng: 174.77, offsetY: -6 }
      ]
    },
    {
      region: "Australia",
      lookAt: { lat: -25.27, lng: 133.77, altitude: 0.9 },
      cities: [
        { name: "Adelaide", lat: -34.92, lng: 138.60, forecastShiftX: -18 },
        { name: "Alice Springs", lat: -23.70, lng: 133.87 },
        { name: "Brisbane", lat: -27.47, lng: 153.02 },
        { name: "Broome", lat: -17.96, lng: 122.23 },
        { name: "Cairns", lat: -16.91, lng: 145.78 },
        { name: "Canberra", lat: -35.28, lng: 149.13, offsetY: 3 },
        { name: "Darwin", lat: -12.46, lng: 130.84 },
        { name: "Hobart", lat: -42.88, lng: 147.32 },
        { name: "Melbourne", lat: -37.81, lng: 144.96, offsetY: 6 },
        { name: "Perth", lat: -31.95, lng: 115.86 },
        { name: "Sydney", lat: -33.86, lng: 151.20, offsetY: -12 },
        { name: "Townsville", lat: -19.25, lng: 146.81 }
      ]
    },
    {
      region: "South-East Asia",
      lookAt: { lat: 6.48, lng: 114.13, altitude: 1.0 },
      cities: [
        { name: "Bandar Seri Begawan", lat: 4.88, lng: 114.94 },
        { name: "Bangkok", lat: 13.75, lng: 100.50 },
        { name: "Denpasar", lat: -8.65, lng: 115.21 },
        { name: "Dhaka", lat: 23.81, lng: 90.41 },
        { name: "Dili", lat: -8.55, lng: 125.57 },
        { name: "Hanoi", lat: 21.02, lng: 105.83 },
        { name: "Ho Chi Minh City", lat: 10.82, lng: 106.62 },
        { name: "Jakarta", lat: -6.20, lng: 106.84 },
        { name: "Kuala Lumpur", lat: 3.13, lng: 101.68, offsetY: -6, forecastShiftX: -18 },
        { name: "Manila", lat: 14.59, lng: 120.98 },
        { name: "Singapore", lat: 1.35, lng: 103.81, offsetY: 6 }
      ]
    },
    {
      region: "East Asia",
      lookAt: { lat: 38.38, lng: 112.07, altitude: 0.95 },
      cities: [
        { name: "Astana", lat: 51.17, lng: 71.43, offsetY: 12 },
        { name: "Beijing", lat: 39.90, lng: 116.40 },
        { name: "Fukuoka", lat: 33.59, lng: 130.40 },
        { name: "Hong Kong", lat: 22.31, lng: 114.16 },
        { name: "Irkutsk", lat: 52.295, lng: 104.29 },
        { name: "Kathmandu", lat: 27.71, lng: 85.32 },
        { name: "Novosibirsk", lat: 55.05, lng: 82.95 },
        { name: "Seoul", lat: 37.56, lng: 126.97 },
        { name: "Shanghai", lat: 31.23, lng: 121.47 },
        { name: "Taipei", lat: 25.03, lng: 121.56 },
        { name: "Tokyo", lat: 35.67, lng: 139.65 },
        { name: "Ulaanbaatar", lat: 47.92, lng: 106.92 },
        { name: "Ürümqi", lat: 43.80, lng: 87.60 },
        { name: "Vladivostok", lat: 43.12, lng: 131.89 },
        { name: "Xi'an", lat: 34.26, lng: 108.94 }
      ]
    },
    {
      region: "South and Central Asia",
      lookAt: { lat: 24.22, lng: 73.47, altitude: 0.8 },
      cities: [
        { name: "Almaty", lat: 43.23, lng: 76.88 },
        { name: "Ashgabad", lat: 37.95, lng: 58.38 },
        { name: "Bengaluru", lat: 12.97, lng: 77.59 },
        { name: "Colombo", lat: 6.92, lng: 79.86 },
        { name: "Kabul", lat: 34.526, lng: 69.18 },
        { name: "Karachi", lat: 24.86, lng: 67.00 },
        { name: "Kolkata", lat: 22.57, lng: 88.36 },
        { name: "Lahore", lat: 31.526, lng: 74.35 },
        { name: "Mumbai", lat: 19.07, lng: 72.87 },
        { name: "New Delhi", lat: 28.61, lng: 77.20 },
        { name: "Tashkent", lat: 41.29, lng: 69.24, offsetY: 6 }
      ]
    },
    {
      region: "Middle East",
      lookAt: { lat: 30.04, lng: 49.69, altitude: 0.65 },
      cities: [
        { name: "Aden", lat: 12.8, lng: 45.03 },
        { name: "Ankara", lat: 39.93, lng: 32.85 },
        { name: "Baghdad", lat: 33.31, lng: 44.36 },
        { name: "Baku", lat: 40.40, lng: 49.86 },
        { name: "Beirut", lat: 33.89, lng: 35.51 },
        { name: "Doha", lat: 25.28, lng: 51.53, offsetY: -15 },
        { name: "Dubai", lat: 25.20, lng: 55.27, offsetY: 18 },
        { name: "Jeddah", lat: 21.54, lng: 39.17 },
        { name: "Kuwait City", lat: 29.38, lng: 47.97 },
        { name: "Riyadh", lat: 24.71, lng: 46.67, offsetY: 6 },
        { name: "Tehran", lat: 35.68, lng: 51.38 },
        { name: "Tel Aviv", lat: 32.08, lng: 34.78 }
      ]
    },
    {
      region: "Africa",
      lookAt: { lat: 2.0, lng: 16.0, altitude: 1.2 },
      cities: [
        { name: "Abidjan", lat: 5.32, lng: -4.03, offsetY: 18 },
        { name: "Addis Ababa", lat: 9.03, lng: 38.74 },
        { name: "Algiers", lat: 36.75, lng: 3.05 },
        { name: "Antananarivo", lat: -18.88, lng: 47.51 },
        { name: "Cairo", lat: 30.04, lng: 31.23 },
        { name: "Cape Town", lat: -33.92, lng: 18.42 },
        { name: "Casablanca", lat: 33.57, lng: -7.58, offsetY: 6 },
        { name: "Dakar", lat: 14.71, lng: -17.46 },
        { name: "Johannesburg", lat: -26.20, lng: 28.04, offsetY: 6 },
        { name: "Kinshasa", lat: -4.44, lng: 15.26 },
        { name: "Lagos", lat: 6.45, lng: 3.39, offsetY: -3 },
        { name: "Luanda", lat: -8.84, lng: 13.29 },
        { name: "N'Djamena", lat: 12.11, lng: 15.04 },
        { name: "Nairobi", lat: -1.29, lng: 36.82 },
        { name: "Tenerife", lat: 28.46, lng: -16.25 },
        { name: "Timbuktu", lat: 16.77, lng: -3.01 },
        { name: "Windhoek", lat: -22.5609, lng: 17.0658, offsetY: -6 }
      ]
    },
    {
      region: "Europe",
      lookAt: { lat: 47.5, lng: 10.0, altitude: 0.8 },
      cities: [
        { name: "Barcelona", lat: 41.38, lng: 2.17 },
        { name: "Berlin", lat: 52.52, lng: 13.40 },
        { name: "Bucharest", lat: 44.43, lng: 26.10 },
        { name: "Dubrovnik", lat: 42.64, lng: 18.09, forecastShiftX: -12 },
        { name: "Edinburgh", lat: 55.95, lng: -3.19 },
        { name: "Istanbul", lat: 41.00, lng: 28.97 },
        { name: "Kyiv", lat: 50.45, lng: 30.52 },
        { name: "Lisbon", lat: 38.73, lng: -9.14 },
        { name: "London", lat: 51.50, lng: -0.12 },
        { name: "Milan", lat: 45.46, lng: 9.19 },
        { name: "Paris", lat: 48.85, lng: 2.35 },
        { name: "Reykjavik", lat: 64.13, lng: -21.83 },
        { name: "St. Petersburg", lat: 59.93, lng: 30.33 },
        { name: "Stockholm", lat: 59.32, lng: 18.06, offsetY: 6 },
        { name: "Tbilisi", lat: 41.72, lng: 44.83 },
        { name: "Vienna", lat: 48.21, lng: 16.37 }
      ]
    },
    {
      region: "Europe",
      lookAt: { lat: 47.50, lng: 10.0, altitude: 0.8 },
      cities: [
        { name: "Amsterdam", lat: 52.36, lng: 4.90 },
        { name: "Athens", lat: 37.98, lng: 23.72 },
        { name: "Budapest", lat: 47.49, lng: 19.04 },
        { name: "Copenhagen", lat: 55.67, lng: 12.56 },
        { name: "Dublin", lat: 53.34, lng: -6.26 },
        { name: "Helsinki", lat: 60.17, lng: 24.93 },
        { name: "Madrid", lat: 40.41, lng: -3.70 },
        { name: "Moscow", lat: 55.75, lng: 37.61 },
        { name: "Nice", lat: 43.70, lng: 7.27 },
        { name: "Oslo", lat: 59.91, lng: 10.75 },
        { name: "Prague", lat: 50.07, lng: 14.43 },
        { name: "Rome", lat: 41.90, lng: 12.49 },
        { name: "Sofia", lat: 42.69, lng: 23.32 },
        { name: "Warsaw", lat: 52.22, lng: 21.01 },
        { name: "Zurich", lat: 47.37, lng: 8.54, forecastShiftX: -12 }
      ]
    },
    {
      region: "North America",
      lookAt: { lat: 42.33, lng: -93.96, altitude: 0.9 },
      cities: [
        { name: "Anchorage", lat: 61.21, lng: -149.90 },
        { name: "Atlanta", lat: 33.76, lng: -84.42 },
        { name: "Chicago", lat: 41.87, lng: -87.62 },
        { name: "Denver", lat: 39.73, lng: -104.99, forecastShiftX: -12 },
        { name: "Edmonton", lat: 53.53, lng: -113.49 },
        { name: "Houston", lat: 29.76, lng: -95.36 },
        { name: "Kansas City", lat: 39.09, lng: -94.57, offsetY: 12 },
        { name: "Los Angeles", lat: 34.05, lng: -118.24 },
        { name: "Miami", lat: 25.76, lng: -80.19 },
        { name: "Mexico City", lat: 19.43, lng: -99.13 },
        { name: "Minneapolis", lat: 44.98, lng: -93.27 },
        { name: "Montreal", lat: 45.51, lng: -73.55 },
        { name: "New York", lat: 40.71, lng: -74.00 },
        { name: "Phoenix", lat: 33.57, lng: -112.09, offsetY: 12 },
        { name: "San Francisco", lat: 37.77, lng: -122.41 },
        { name: "St. John's", lat: 47.56, lng: -52.71 },
        { name: "Toronto", lat: 43.65, lng: -79.38 },
        { name: "Vancouver", lat: 49.28, lng: -123.12 },
        { name: "Washington D.C.", lat: 38.90, lng: -77.03 },
        { name: "Winnipeg", lat: 49.90, lng: -97.14 }
      ]
    },
    {
      region: "Central America",
      lookAt: { lat: 18.0, lng: -80.0, altitude: 0.7 },
      cities: [
        { name: "Bridgetown", lat: 13.10, lng: -59.61 },
        { name: "Cancún", lat: 21.16, lng: -86.85, offsetY: 6 },
        { name: "Ciudad Juárez", lat: 31.75, lng: -106.49, offsetY: 18 },
        { name: "Guadalajara", lat: 20.67, lng: -103.39 },
        { name: "Guatemala City", lat: 14.63, lng: -90.50 },
        { name: "Havana", lat: 23.11, lng: -82.36, offsetY: 6 },
        { name: "Kingston", lat: 17.97, lng: -76.79, offsetY: 6 },
        { name: "Monterrey", lat: 25.68, lng: -100.31 },
        { name: "Nassau", lat: 24.08, lng: -77.34, offsetY: -12 },
        { name: "Panama City", lat: 8.98, lng: -79.51, offsetY: 12 },
        { name: "Port of Spain", lat: 10.67, lng: -61.52 },
        { name: "San José", lat: 9.93, lng: -84.08, offsetY: -12 },
        { name: "San Juan", lat: 18.46, lng: -66.10, offsetY: 21 },
        { name: "Santo Domingo", lat: 18.48, lng: -69.93, offsetY: -15 },
        { name: "Tijuana", lat: 32.53, lng: -117.03, offsetY: -6 }
      ]
    },
    {
      region: "South America",
      lookAt: { lat: -20.0, lng: -60.0, altitude: 1.2 },
      cities: [
        { name: "Asunción", lat: -25.26, lng: -57.56, forecastShiftX: -28 },
        { name: "Belém", lat: -1.45, lng: -48.50 },
        { name: "Bogotá", lat: 4.71, lng: -74.07 },
        { name: "Brasília", lat: -15.80, lng: -47.88 },
        { name: "Buenos Aires", lat: -34.60, lng: -58.38 },
        { name: "Caracas", lat: 10.51, lng: -66.91 },
        { name: "Guayaquil", lat: -2.19, lng: -79.89 },
        { name: "Lima", lat: -12.04, lng: -77.04 },
        { name: "Manaus", lat: -3.11, lng: -60.02 },
        { name: "Paramaribo", lat: 5.85, lng: -55.20 },
        { name: "Rio de Janeiro", lat: -22.90, lng: -43.17, offsetY: -18 },
        { name: "Santa Cruz", lat: -17.80, lng: -63.18 },
        { name: "Santiago", lat: -33.44, lng: -70.66, forecastShiftX: -32 },
        { name: "São Paulo", lat: -23.53, lng: -46.63, offsetY: 18 }
      ]
    }
  ];

  // ── Colour scale ────────────────────────────────────────────────────────────
  const colourScale = [
    { temp: -30, colour: [241, 223, 245] },
    { temp: -20, colour: [175, 100, 190] },
    { temp: -10, colour: [100, 109, 190] },
    { temp: 0,   colour: [142, 189, 208] },
    { temp: 10,  colour: [100, 190, 109] },
    { temp: 20,  colour: [230, 206, 120] },
    { temp: 30,  colour: [220, 166, 130] },
    { temp: 40,  colour: [220, 130, 130] },
    { temp: 50,  colour: [206, 184, 184] }
  ];

  const luminance = ([r, g, b]) => {
    const [lr, lg, lb] = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  };

  // Black or white text, whichever contrasts more with the box
  function readableOn(rgb) {
    const l = luminance(rgb);
    const dark = (l + 0.05) / 0.05;     // against black
    const light = 1.05 / (l + 0.05);    // against white
    return dark >= light ? '#000' : '#fff';
  }

  function temperatureStyle(temp) {
    if (typeof temp !== 'number' || Number.isNaN(temp)) return { bg: 'rgb(90, 90, 90)', fg: '#fff' };
    const first = colourScale[0];
    const last = colourScale[colourScale.length - 1];
    let rgb;
    if (temp <= first.temp) rgb = first.colour;
    else if (temp >= last.temp) rgb = last.colour;
    else {
      const i = colourScale.findIndex((step, n) => temp >= step.temp && temp <= colourScale[n + 1].temp);
      const lower = colourScale[i];
      const upper = colourScale[i + 1];
      const t = (temp - lower.temp) / (upper.temp - lower.temp);
      rgb = lower.colour.map((v, n) => Math.round(v + (upper.colour[n] - v) * t));
    }
    return { bg: `rgb(${rgb.join(', ')})`, fg: readableOn(rgb) };
  }

  // ── Display state ───────────────────────────────────────────────────────────
  let displayMode = 'current';
  let latestWeatherData = [];
  let currentStopIndex = 0;
  let announceTimer;

  function announce(message, delay = 400) {
    clearTimeout(announceTimer);
    statusEl.textContent = '';
    announceTimer = setTimeout(() => { statusEl.textContent = message; }, delay);
  }

  // The boxes for one city in the current mode: [{ visible, spoken, bg, fg }]
  function tempBoxes(d) {
    const box = (value, prefix) => {
      const has = typeof value === 'number';
      const style = temperatureStyle(value);
      return {
        visible: has ? `${value}°` : '--',
        spoken: has ? `${prefix}${value} degrees Celsius` : `${prefix}unavailable`,
        ...style
      };
    };
    return displayMode === 'forecast'
      ? [box(d.low, 'low '), box(d.high, 'high ')]
      : [box(d.temp, '')];
  }

  const boxHtml = (box, className) =>
    `<span class="${className}" style="background-color:${box.bg};color:${box.fg}"><span aria-hidden="true">${esc(box.visible)}</span><span class="sr-only">${esc(box.spoken)}</span></span>`;

  // ── Globe ───────────────────────────────────────────────────────────────────
  function badgeFor(d) {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '0px';
    wrapper.style.height = '0px';

    // On phones the city's real position is all that is used; the offsets below are ignored
    if (isMobile()) {
      wrapper.innerHTML = `<div class="mobile-city-marker"><span class="mobile-city-dot"></span><span class="mobile-city-label">${esc(d.name)}</span></div>`;
      return wrapper;
    }

    // The offsets were tuned for a page REFERENCE_HEIGHT tall; the CSS multiplies them (and the
    // badge itself) by --w-scale, so the labels keep their spacing as the page gets taller or shorter
    const el = document.createElement('div');
    el.className = 'weather-badge';
    el.style.setProperty('--oy', `${d.offsetY || 0}px`);
    el.style.setProperty('--sx', `${displayMode === 'forecast' ? (d.forecastShiftX ?? 0) : 0}px`);
    el.innerHTML = `<strong>${esc(d.name)}</strong>${tempBoxes(d).map(box => boxHtml(box, 'weather-temp-box')).join('')}`;
    wrapper.appendChild(el);
    return wrapper;
  }

  // Page height the label offsets in STOPS were tuned for. If the labels look too big or too
  // small overall, this is the one number to change (smaller = bigger labels).
  const REFERENCE_HEIGHT = 950;
  function updateScale() {
    const scale = Math.min(1.5, Math.max(0.75, (container.clientHeight || REFERENCE_HEIGHT) / REFERENCE_HEIGHT));
    page.style.setProperty('--w-scale', scale.toFixed(3));
  }

  let world;
  if (typeof Globe === 'function') {
    world = Globe()(container)
      .globeImageUrl('/assets/images/Blue_Marble_2002.png')
      .backgroundImageUrl('/assets/images/night-sky.png')
      .width(container.clientWidth)
      .height(container.clientHeight)
      .htmlElementsData([])
      .htmlElement(badgeFor);
    // The globe sits inside the site frame, so follow its size rather than the window
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        world.width(container.clientWidth).height(container.clientHeight);
        updateScale();
      }).observe(container);
    }
    updateScale();
  } else {
    // The globe library did not load: keep the weather list working and show it
    world = { htmlElementsData() { return world; }, pointOfView() { return world; } };
    page.classList.add('show-list');
    noteEl.textContent = 'The globe could not be loaded, so the weather is shown as a list.';
    noteEl.hidden = false;
  }

  // ── Weather data ────────────────────────────────────────────────────────────
  async function getWeatherForCities(cities) {
    const CACHE_TTL = 60 * 60 * 1000;
    const now = Date.now();
    let cache = {};
    try { cache = JSON.parse(sessionStorage.getItem('weather_cache_v2')) || {}; } catch (_) { cache = {}; }

    const missing = [];
    const results = {};
    cities.forEach(city => {
      const key = `${city.lat}_${city.lng}`;
      if (cache[key] && now - cache[key].timestamp < CACHE_TTL) results[key] = cache[key];
      else missing.push(city);
    });

    if (missing.length) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${missing.map(c => c.lat).join(',')}` +
          `&longitude=${missing.map(c => c.lng).join(',')}` +
          '&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const round = value => (value !== undefined && value !== null ? Math.round(value) : '--');
        missing.forEach((city, idx) => {
          const entry = Array.isArray(data) ? data[idx] : data;
          const record = {
            temp: round(entry?.current_weather?.temperature),
            high: round(entry?.daily?.temperature_2m_max?.[0]),
            low: round(entry?.daily?.temperature_2m_min?.[0]),
            timestamp: now
          };
          cache[`${city.lat}_${city.lng}`] = record;
          results[`${city.lat}_${city.lng}`] = record;
        });
        try { sessionStorage.setItem('weather_cache_v2', JSON.stringify(cache)); } catch (_) { /* storage may be full or blocked */ }
      } catch (err) {
        console.error('Weather fetch failed (rate limit or network error). Using fallback.', err);
        missing.forEach(city => {
          results[`${city.lat}_${city.lng}`] = { temp: '--', high: '--', low: '--', timestamp: now };
        });
      }
    }
    return cities.map(city => ({ ...city, ...results[`${city.lat}_${city.lng}`] }));
  }

  // ── Weather list (always read by screen readers; shown on request and on phones) ──
  function renderList() {
    const stop = STOPS[currentStopIndex];
    panelTitle.textContent = `${stop.region}: ${displayMode === 'forecast' ? "today's low and high" : 'current'} temperatures`;
    listEl.innerHTML = latestWeatherData.map(d =>
      `<li class="weather-row"><span class="weather-city">${esc(d.name)}</span><span class="weather-temp">${tempBoxes(d).map(box => boxHtml(box, 'weather-temp-box')).join('')}</span></li>`
    ).join('');
  }

  const showPanel = () => panel.classList.add('is-visible');
  const hidePanel = () => panel.classList.remove('is-visible');

  // ── Tour ────────────────────────────────────────────────────────────────────
  const FLY_DURATION = 3500;
  const SHORT_FLY_DURATION = 800;
  const PAUSE_DURATION = 6000;
  const CAMERA_SIMILARITY_THRESHOLD = 8;
  // Pull the globe farther back on narrow screens so a stop's whole spread stays in view
  const MOBILE_ALTITUDE_MULTIPLIER = 1.45;

  let manualPaused = reduceMotion;   // people who ask for less motion start paused
  let tourToken = 0;
  let lastLookAt = null;

  const cameraDistance = (a, b) => Math.hypot(a.lat - b.lat, a.lng - b.lng);

  // Resolves true when the time is up, false when the tour was redirected meanwhile.
  // Only the time spent looking at a stop can be paused; a flight always finishes.
  function wait(ms, token, pausable) {
    return new Promise(resolve => {
      let remaining = ms;
      let lastTick = null;
      function tick(now) {
        if (token !== tourToken) { resolve(false); return; }
        if (lastTick === null) lastTick = now;
        const delta = now - lastTick;
        lastTick = now;
        if (!(pausable && manualPaused)) remaining -= delta;
        if (remaining <= 0) resolve(true);
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  async function showStop(index, token) {
    const stop = STOPS[index];
    currentStopIndex = index;
    const hop = lastLookAt && cameraDistance(stop.lookAt, lastLookAt) < CAMERA_SIMILARITY_THRESHOLD;
    const flyDuration = reduceMotion ? 0 : (hop ? SHORT_FLY_DURATION : FLY_DURATION);
    lastLookAt = stop.lookAt;

    // Everything is hidden while the camera travels
    world.htmlElementsData([]);
    hidePanel();
    regionEl.textContent = stop.region;
    const view = isMobile() ? { ...stop.lookAt, altitude: stop.lookAt.altitude * MOBILE_ALTITUDE_MULTIPLIER } : stop.lookAt;
    world.pointOfView(view, flyDuration);

    const weatherPromise = getWeatherForCities(stop.cities);
    if (!(await wait(flyDuration, token, false))) return;
    const weather = await weatherPromise;
    if (token !== tourToken) return;

    latestWeatherData = weather;
    const allMissing = weather.every(d => typeof d.temp !== 'number' && typeof d.high !== 'number');
    if (typeof Globe === 'function') {
      noteEl.textContent = allMissing ? 'Live weather could not be loaded.' : '';
      noteEl.hidden = !allMissing;
    }
    world.htmlElementsData(weather);
    renderList();
    showPanel();
    await wait(PAUSE_DURATION, token, true);
  }

  async function runTour(startIndex) {
    const token = ++tourToken;
    let index = startIndex;
    while (token === tourToken) {
      await showStop(index, token);
      index = (index + 1) % STOPS.length;
    }
  }

  function goToStop(delta) {
    const index = (currentStopIndex + delta + STOPS.length) % STOPS.length;
    runTour(index);
    announce(`${STOPS[index].region}, stop ${index + 1} of ${STOPS.length}`);
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4.5v15L19 12z"/></svg>';

  function renderPause() {
    pauseButton.innerHTML = manualPaused ? ICON_PLAY : ICON_PAUSE;
    pauseButton.setAttribute('aria-label', manualPaused ? 'Resume tour' : 'Pause tour');
  }

  pauseButton.addEventListener('click', () => {
    manualPaused = !manualPaused;
    renderPause();
    wakeControls();
    announce(manualPaused ? 'Tour paused' : 'Tour resumed', 100);
  });
  prevButton.addEventListener('click', () => goToStop(-1));
  nextButton.addEventListener('click', () => goToStop(1));

  function setList(on) {
    page.classList.toggle('show-list', on);
    listToggle.setAttribute('aria-pressed', String(on));
  }
  listToggle.addEventListener('click', () => setList(!page.classList.contains('show-list')));

  function renderMode() {
    const forecast = displayMode === 'forecast';
    modeText.textContent = forecast ? 'FORECAST' : 'NOW';
    modeSr.textContent = forecast
      ? ": showing today's low and high. Switch to current temperatures."
      : ": showing current temperatures. Switch to today's forecast.";
  }

  modeButton.addEventListener('click', () => {
    displayMode = displayMode === 'current' ? 'forecast' : 'current';
    renderMode();
    // The badges are rebuilt so their forecast offsets and boxes are recalculated
    world.htmlElementsData([]);
    world.htmlElementsData(latestWeatherData);
    if (latestWeatherData.length) renderList();
    announce(displayMode === 'forecast' ? "Showing today's low and high" : 'Showing current temperatures');
  });

  // ── Full screen: hides the site header, acknowledgement and footer, and asks the browser for ──
  // real full screen where it allows it (iPhones don't, so there it is the hidden-chrome view only)
  const ICON_ENTER = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5h5v2H7v3H5zM14 5h5v5h-2V7h-3zM5 14h2v3h3v2H5zM17 14h2v5h-5v-2h3z"/></svg>';
  const ICON_EXIT = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5h2v5H5V8h3zM14 5h2v3h3v2h-5zM5 14h5v5H8v-3H5zM14 14h5v2h-3v3h-2z"/></svg>';
  let immersive = false;

  async function setImmersive(on) {
    immersive = on;
    document.body.classList.toggle('weather-immersive', on);
    fullscreenButton.innerHTML = on ? ICON_EXIT : ICON_ENTER;
    const label = on ? 'Exit full screen' : 'Full screen';
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.title = label;
    try {
      if (on && page.requestFullscreen) await page.requestFullscreen();
      else if (!on && document.fullscreenElement) await document.exitFullscreen();
    } catch (_) { /* the hidden-chrome view still works without real full screen */ }
    wakeControls();
    announce(on ? 'Full screen. Press Escape to exit.' : 'Full screen off');
  }

  // Escape closes the credits popover first, so it shouldn't also leave full screen
  function popoverOpen() {
    try { return !!page.querySelector(':popover-open'); } catch (_) { return false; }
  }

  fullscreenButton.addEventListener('click', () => setImmersive(!immersive));
  // Escape in real full screen is handled by the browser; this catches it for the hidden-chrome view
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && immersive) setImmersive(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && immersive && !document.fullscreenElement && !popoverOpen()) setImmersive(false);
    else if ((event.key === 'f' || event.key === 'F') && !event.ctrlKey && !event.metaKey && !event.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) setImmersive(!immersive);
  });

  // ── Controls fade when nobody is using them (never while paused) and return on any movement,
  // touch, key press or focus ───────────────────────────────────────────────────────────────────
  const CONTROLS_IDLE_MS = 4000;
  let idleTimer;
  function wakeControls() {
    page.classList.remove('controls-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!manualPaused) page.classList.add('controls-idle'); }, CONTROLS_IDLE_MS);
  }
  ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'focusin'].forEach(type => page.addEventListener(type, wakeControls, { passive: true }));

  // Switching between phone and desktop changes the marker type
  mobileQuery.addEventListener('change', () => {
    if (!latestWeatherData.length) return;
    world.htmlElementsData([]);
    world.htmlElementsData(latestWeatherData);
    if (!page.classList.contains('show-list') && isMobile()) setList(true);
  });

  // ── Start ───────────────────────────────────────────────────────────────────
  if (isMobile() || typeof Globe !== 'function') setList(true);
  renderMode();
  renderPause();
  wakeControls();
  // ?immersive starts with the header and footer hidden, for a TV or kiosk. (Browsers only allow
  // real full screen after a click, so this is the hidden-chrome view.)
  if (new URLSearchParams(location.search).has('immersive')) setImmersive(true);
  if (reduceMotion) announce('The tour starts paused. Use the resume button or the next and previous buttons to move between regions.', 800);
  runTour(0);

})();
