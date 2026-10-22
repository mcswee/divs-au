(() => {
  "use strict";
  const root = document.querySelector(".itu-page");
  if (!root) return;

  const DATA_URL = "/assets/data/itu.json";
  const $ = (id) => document.getElementById(id);
  const slider = $("year-slider");
  const yearSelect = $("year-select");
  const yearDisplay = $("year-display");
  const listYear = $("list-year");
  const allocationList = $("allocation-list");
  const allocationSearch = $("allocation-search");
  const resultsMeta = $("results-meta");
  const showMore = $("show-more");
  const prefixSearch = $("prefix-search");
  const prefixSuggestions = $("prefix-suggestions");
  const prefixGo = $("prefix-go");
  const prefixHistory = $("prefix-history");
  let data, currentYear = 2026, visibleLimit = 40, filteredAllocations = [];
  const palette = ["#4d5792", "#397c78", "#b58a47", "#6f789d", "#b26f5b", "#5989a3", "#7d6b9e", "#8c8b58"];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const entityName = (code) => data.entities[code] || `Unknown entity (${code})`;

  function getAssignment(prefix, year) {
    return prefix.assignments[String(year)] || "";
  }
  function runsFor(prefix) {
    const years = data.years.map(Number);
    const runs = [];
    let start = null, lastYear = null, lastCode = null;
    for (const year of years) {
      const code = getAssignment(prefix, year);
      if (code === lastCode && code && lastYear === year - 1) {
        lastYear = year;
        continue;
      }
      if (start !== null) runs.push({start, end:lastYear, code:lastCode});
      start = code ? year : null;
      lastYear = code ? year : null;
      lastCode = code || null;
    }
    if (start !== null) runs.push({start, end:lastYear, code:lastCode});
    return runs;
  }
  function populateYears() {
    data.years.slice().reverse().forEach(y => {
      const option = document.createElement("option");
      option.value = y; option.textContent = y;
      yearSelect.appendChild(option);
    });
  }
  function renderYear() {
    currentYear = Number(slider.value);
    yearSelect.value = String(currentYear);
    yearDisplay.textContent = currentYear;
    listYear.textContent = currentYear;
    const active = data.prefixes.filter(p => getAssignment(p, currentYear));
    const entities = new Set(active.map(p => getAssignment(p, currentYear)));
    const changed = currentYear === 1906 ? 0 : active.filter(p => {
      const prev = getAssignment(p, currentYear - 1);
      return prev !== getAssignment(p, currentYear);
    }).length;
    $("allocation-count").textContent = active.length.toLocaleString("en-AU");
    $("entity-count").textContent = entities.size.toLocaleString("en-AU");
    $("year-change-count").textContent = currentYear === 1906 ? "—" : changed.toLocaleString("en-AU");
    const query = allocationSearch.value.trim().toLocaleLowerCase();
    filteredAllocations = active.filter(p => {
      const code = getAssignment(p, currentYear);
      return p.prefix.toLowerCase().includes(query) || code.toLowerCase().includes(query) || entityName(code).toLowerCase().includes(query);
    }).sort((a,b) => a.prefix.localeCompare(b.prefix));
    visibleLimit = 40;
    renderAllocationRows();
  }
  function renderAllocationRows() {
    const shown = filteredAllocations.slice(0, visibleLimit);
    allocationList.innerHTML = shown.length ? shown.map(p => {
      const code = getAssignment(p, currentYear);
      return `<a class="itu-allocation-row" href="#by-prefix" data-prefix="${esc(p.prefix)}"><span class="itu-prefix-code">${esc(p.prefix)}</span><span class="itu-allocation-entity">${esc(entityName(code))}<small>Entity code: ${esc(code)}</small></span><span class="itu-row-arrow" aria-hidden="true">↗</span></a>`;
    }).join("") : `<div class="itu-empty-results">No allocations match that search in ${currentYear}.</div>`;
    resultsMeta.textContent = `${filteredAllocations.length.toLocaleString("en-AU")} allocation${filteredAllocations.length === 1 ? "" : "s"}${allocationSearch.value.trim() ? " matching your search" : ""}`;
    showMore.hidden = filteredAllocations.length <= visibleLimit;
    showMore.textContent = `Show more allocations (${(filteredAllocations.length - visibleLimit).toLocaleString("en-AU")} remaining)`;
  }
  function renderSuggestions() {
    const q = prefixSearch.value.trim().toUpperCase();
    if (!q) { prefixSuggestions.hidden = true; return; }
    const matches = data.prefixes.filter(p => p.prefix.includes(q)).sort((a,b) => {
      const ap = a.prefix === q ? 0 : a.prefix.startsWith(q) ? 1 : 2;
      const bp = b.prefix === q ? 0 : b.prefix.startsWith(q) ? 1 : 2;
      return ap - bp || a.prefix.localeCompare(b.prefix);
    }).slice(0,8);
    prefixSuggestions.innerHTML = matches.map(p => {
      const runs = runsFor(p), latest = getAssignment(p, 2026);
      return `<button type="button" role="option" data-prefix="${esc(p.prefix)}"><strong>${esc(p.prefix)}</strong><span>${esc(latest ? entityName(latest) : (runs.length ? entityName(runs[runs.length-1].code) : "No recorded allocation"))}</span></button>`;
    }).join("");
    prefixSuggestions.hidden = !matches.length;
  }
  function showPrefix(prefixText) {
    const key = String(prefixText || "").trim().toUpperCase();
    const prefix = data.prefixes.find(p => p.prefix === key);
    if (!prefix) {
      prefixHistory.innerHTML = `<div class="itu-empty-results">No prefix “${esc(key)}” was found. Try a prefix listed in the annual explorer.</div>`;
      return;
    }
    prefixSearch.value = key;
    prefixSuggestions.hidden = true;
    const runs = runsFor(prefix);
    const first = runs.length ? runs[0].start : null;
    const last = runs.length ? runs[runs.length-1].end : null;
    const activeYears = Object.keys(prefix.assignments).length;
    const segments = runs.map((r,i) => {
      const left = ((r.start - 1906) / 121) * 100;
      const width = ((r.end - r.start + 1) / 121) * 100;
      return `<button class="itu-timeline-segment" style="left:${left}%;width:${Math.max(width,.4)}%;background:${palette[i % palette.length]}" title="${esc(r.start === r.end ? r.start : `${r.start}–${r.end}`)}: ${esc(entityName(r.code))}" aria-label="${esc(`${r.start} to ${r.end}, ${entityName(r.code)}`)}" data-start="${r.start}" data-end="${r.end}" data-code="${esc(r.code)}"></button>`;
    }).join("");
    const periods = runs.map((r,i) => `<div class="itu-period"><div class="itu-period-dates">${r.start === r.end ? r.start : `${r.start}–${r.end}`}</div><div><div class="itu-period-name">${esc(entityName(r.code))}<span class="itu-period-code">${esc(r.code)}</span></div><div class="itu-period-note">${r.start === r.end ? "Recorded for one year" : `${r.end-r.start+1} consecutive years`}</div></div></div>`).join("");
    prefixHistory.innerHTML = `
      <div class="itu-history-top"><div><h3>${esc(key)}</h3><p>${first ? `Recorded from ${first} to ${last}` : "No recorded assignments"} · ${runs.length} allocation period${runs.length === 1 ? "" : "s"}</p></div><span class="itu-history-count">${activeYears} annual records</span></div>
      <div class="itu-timeline" role="group" aria-label="Timeline of ${esc(key)} allocations">
        <div class="itu-timeline-years"><span>1906</span><span>1936</span><span>1966</span><span>1996</span><span>2026</span></div>
        <div class="itu-timeline-track">${segments}</div>
      </div>
      <div class="itu-periods">${periods || '<div class="itu-empty-results">No allocation periods recorded.</div>'}</div>`;
    prefixHistory.querySelectorAll(".itu-timeline-segment").forEach(button => button.addEventListener("click", () => {
      const start = Number(button.dataset.start);
      slider.value = String(start); renderYear();
      allocationSearch.value = key; renderYear();
      $("by-year").scrollIntoView({behavior:"smooth",block:"start"});
    }));
    history.replaceState(null, "", `${location.pathname}?prefix=${encodeURIComponent(key)}${location.hash === "#by-year" ? "#by-year" : "#by-prefix"}`);
  }

  allocationList.addEventListener("click", e => {
    const link = e.target.closest("[data-prefix]");
    if (!link) return;
    e.preventDefault();
    showPrefix(link.dataset.prefix);
    document.querySelectorAll("[data-mode-link]").forEach(a => a.classList.toggle("selected", a.dataset.modeLink === "prefix"));
    $("by-prefix").scrollIntoView({behavior:"smooth",block:"start"});
  });
  prefixSuggestions.addEventListener("click", e => {
    const button = e.target.closest("[data-prefix]");
    if (button) showPrefix(button.dataset.prefix);
  });
  slider.addEventListener("input", renderYear);
  yearSelect.addEventListener("change", () => { slider.value = yearSelect.value; renderYear(); });
  allocationSearch.addEventListener("input", renderYear);
  showMore.addEventListener("click", () => { visibleLimit += 40; renderAllocationRows(); });
  prefixSearch.addEventListener("input", renderSuggestions);
  prefixSearch.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); showPrefix(prefixSearch.value); } });
  prefixGo.addEventListener("click", () => showPrefix(prefixSearch.value));
  document.querySelectorAll("[data-mode-link]").forEach(a => a.addEventListener("click", () => {
    document.querySelectorAll("[data-mode-link]").forEach(link => link.classList.toggle("selected", link === a));
  }));

  fetch(DATA_URL).then(r => {
    if (!r.ok) throw new Error(`Could not load archive data (${r.status})`);
    return r.json();
  }).then(json => {
    data = json;
    populateYears();
    const params = new URLSearchParams(location.search);
    const requestedYear = Number(params.get("year"));
    if (requestedYear >= 1906 && requestedYear <= 2026) slider.value = String(requestedYear);
    renderYear();
    const requestedPrefix = params.get("prefix");
    if (requestedPrefix) showPrefix(requestedPrefix);
  }).catch(err => {
    root.insertAdjacentHTML("afterbegin", `<p class="itu-load-error">The archive data could not be loaded. ${esc(err.message)}</p>`);
  });
})();