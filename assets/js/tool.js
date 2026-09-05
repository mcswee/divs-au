/* ============================================================
   Electoral redistribution tool
   ------------------------------------------------------------
   Three independent data layers, joined at runtime by SA1 code:
     1. Geometry   - GeoJSON, SA1 polygons, SA1_CODE21 only
     2. Reference  - CSV, SA1 -> SA2 code/name, seed division,
                      actual + projected enrolment
     3. Assignment - mutable in-memory state, SA1 -> division
                      (starts as a copy of the seed division)
   ============================================================ */

(function () {
  "use strict";

  var STATE_FILES = {
    act: {
      geojson: "/assets/data/act_sa1.geojson",
      csv: "/assets/data/act_sa1.csv",
      center: [-35.3, 149.1],
      zoom: 8
    },
    sa: {
      geojson: "/assets/data/sa_sa1.geojson",
      csv: "/assets/data/sa_sa1.csv",
      center: [-31.8, 135.55],
      zoom: 6
    },
    tas: {
      geojson: "/assets/data/tas_sa1.geojson",
      csv: "/assets/data/tas_sa1.csv",
      center: [-42.0, 146.8],
      zoom: 7
    },
        qld: {
      geojson: "/assets/data/qld_sa1.geojson",
      csv: "/assets/data/qld_sa1.csv",
      center: [-23.0, 144.5], 
      zoom: 5                 
    }

  };

  var DIVISION_COLOURS = [
    "#336699", "#a3203b", "#0b6b3a", "#b3791e",
    "#6a4c93", "#1f7a8c", "#c2541f", "#5f9ad9",
   "#84b366", "#b157bd", "#e3c06d", "#8a694d"
  ];

  var ALL_COLOURS = [
    "#336699", "#a3203b", "#0b6b3a", "#b3791e",
    "#6a4c93", "#1f7a8c", "#c2541f", "#5f9ad9",
    "#84b366", "#b157bd", "#e3c06d", "#8a694d"
  ];

  // ---- runtime state ----
  var sa1Reference = {};      // sa1Code -> { sa2Code, sa2Name, actual, projected, originalDivision }
  var assignment = {};        // sa1Code -> division name (current assignment, mutable)
  var divisionColours = {};   // division name -> hex
  var sa1Layers = {};         // sa1Code -> [leaflet layer, ...] (usually 1, occasionally split fragments)
  var activeDivision = null;
  var map = null;
  var colourCursor = 0;

  // ---- DOM refs ----
  var el = {
    stateSelect: document.getElementById("state-select"),
    quotaActualValue: document.getElementById("quota-actual-value"),
    quotaActualBand: document.getElementById("quota-actual-band"),
    quotaProjectedValue: document.getElementById("quota-projected-value"),
    quotaProjectedBand: document.getElementById("quota-projected-band"),
    quotaDivisor: document.getElementById("quota-divisor"),
    activeDivisionSwatch: document.getElementById("active-division-swatch"),
    activeDivisionName: document.getElementById("active-division-name"),
    divisionList: document.getElementById("division-list"),
    createDivisionBtn: document.getElementById("create-division-btn"),
    exportBtn: document.getElementById("export-btn")
  };

  init();

  function init() {
    setupMap();
    el.createDivisionBtn.addEventListener("click", onCreateDivision);
    el.exportBtn.addEventListener("click", onExport);
    el.stateSelect.addEventListener("change", function () {
      loadState(el.stateSelect.value);
    });
    loadState(el.stateSelect.value);
  }

  function setupMap() {
    map = L.map("tool-map", { preferCanvas: true });
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>|Data <a href="/copyright/">ABS</a>',
      maxZoom: 19,
      maxNativeZoom: 16
    }).addTo(map);
  }

  function loadState(stateKey) {
    var cfg = STATE_FILES[stateKey];
    if (!cfg) return;

    clearMap();
    sa1Reference = {};
    assignment = {};
    divisionColours = {};
    sa1Layers = {};
    colourCursor = 0;
    activeDivision = null;

    map.setView(cfg.center, cfg.zoom);

    Papa.parse(cfg.csv, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        results.data.forEach(function (row) {
          if (!row.SA1_CODE_DIV) return;
          sa1Reference[row.SA1_CODE_DIV] = {
            sa2Code: row.SA2_CODE,
            sa2Name: row.SA2_NAME,
            actual: parseInt(row.ACTUAL, 10) || 0,
            projected: parseInt(row.PROJECTED, 10) || 0,
            originalDivision: row.DIVISION
          };
          assignment[row.SA1_CODE_DIV] = row.DIVISION;
        });

        // seed colours for every division present in the data
        var seenDivisions = uniqueDivisions();
        seenDivisions.forEach(function (name) { assignColourTo(name); });

        fetch(cfg.geojson)
          .then(function (r) { return r.json(); })
          .then(function (geo) {
            renderGeoJSON(geo);
            setActiveDivision(seenDivisions[0] || null);
            refreshAll();
          });
      }
    });
  }

  function clearMap() {
    Object.keys(sa1Layers).forEach(function (code) {
      sa1Layers[code].forEach(function (layer) { map.removeLayer(layer); });
    });
  }

  // ---- geometry rendering ----

  function renderGeoJSON(geo) {
    var layer = L.geoJSON(geo, {
      style: styleForFeature,
      onEachFeature: function (feature, lyr) {
        var code = feature.properties.SA1_CODE_DIV;
        if (!sa1Layers[code]) sa1Layers[code] = [];
        sa1Layers[code].push(lyr);

        lyr.on("click", function () { onSa1Click(code); });
        lyr.on("dblclick", function (e) {
          L.DomEvent.stopPropagation(e);
          onSa1DoubleClick(code);
        });
        lyr.on("mouseover", function () { lyr.setStyle({ weight: 2 }); });
        lyr.on("mouseout", function () { 
          var division = assignment[code];
          var colour = division ? (divisionColours[division] || "#999") : "#999";
          lyr.setStyle({ color: "#ffffff", weight: 0.6, fillColor: colour, fillOpacity: 0.65 });
        });

        var ref = sa1Reference[code];
        if (ref) {
          var displayCode = code.split("-")[0];
          var currentDiv = assignment[code];
          var divisionText = currentDiv;
          if (currentDiv !== ref.originalDivision) {
            divisionText = '<span style="opacity:0.5; font-style:italic;">' + escapeHtml(ref.originalDivision) + '</span> → ' + escapeHtml(currentDiv);
          }
          lyr.bindTooltip(
            '<span class="sa1-sa2">' + escapeHtml(ref.sa2Name) + '</span>' +
            'SA1 ' + displayCode + '<br>' +
            'Division: ' + divisionText + '<br>' +
            'Actual: ' + ref.actual.toLocaleString() + ' &middot; Projected: ' + ref.projected.toLocaleString(),
            { className: "sa1-tooltip", sticky: true }
          );
        }
      }
    }).addTo(map);

    map.fitBounds(layer.getBounds(), { padding: [10, 10] });
  }

  function styleForFeature(feature) {
    var code = feature.properties.SA1_CODE21;
    var division = assignment[code];
    var colour = division ? (divisionColours[division] || "#999") : "#999";
    return {
      color: "#ffffff",
      weight: 0.6,
      fillColor: colour,
      fillOpacity: 0.65
    };
  }

  function restyleSa1(code) {
    var layers = sa1Layers[code];
    if (!layers) return;
    var division = assignment[code];
    var colour = division ? (divisionColours[division] || "#999") : "#999";
    layers.forEach(function (lyr) {
      lyr.setStyle({ fillColor: colour, fillOpacity: 0.65 });
    });
  }

  // ---- interaction ----

  function onSa1Click(code) {
    if (!activeDivision) return;
    // Clicking an SA1 already in the active division is a no-op.
    // Clicking one currently in a different division reassigns it
    // to the active division.
    if (assignment[code] === activeDivision) return;
    assignment[code] = activeDivision;
    restyleSa1(code);
    refreshDivisionList();
  }

  function onSa1DoubleClick(code) {
    var ref = sa1Reference[code];
    if (!ref || !activeDivision) return;
    var sa2Code = ref.sa2Code;
    var sa2Name = ref.sa2Name;
    var siblingCodes = Object.keys(sa1Reference).filter(function (c) {
      return sa1Reference[c].sa2Code === sa2Code;
    });

    var confirmed = window.confirm(
      "Assign all of " + sa2Name + " (" + siblingCodes.length + " SA1 areas) to " + activeDivision + "?"
    );
    if (!confirmed) return;

    siblingCodes.forEach(function (c) {
      assignment[c] = activeDivision;
      restyleSa1(c);
    });
    refreshDivisionList();
  }

  function setActiveDivision(name) {
    activeDivision = name;
    el.activeDivisionName.textContent = name || "None selected";
    el.activeDivisionSwatch.style.background = name ? divisionColours[name] : "transparent";
    refreshDivisionList();
  }

  // ---- division management ----

  function uniqueDivisions() {
    var set = {};
    Object.keys(assignment).forEach(function (code) { set[assignment[code]] = true; });
    return Object.keys(set);
  }

  function assignColourTo(name) {
    if (divisionColours[name]) return;
    divisionColours[name] = DIVISION_COLOURS[colourCursor % DIVISION_COLOURS.length];
    colourCursor++;
  }

  function onCreateDivision() {
    var defaultName = nextDefaultName();
    var name = window.prompt("Name the new division:", defaultName);
    if (!name) return;
    name = name.trim();
    if (!name) return;
    if (divisionColours[name]) {
      window.alert("A division with that name already exists.");
      return;
    }
    assignColourTo(name);
    setActiveDivision(name);
    refreshDivisionList();
  }

  function nextDefaultName() {
    var n = 1;
    var existing = Object.keys(divisionColours);
    while (existing.indexOf("New Division " + n) !== -1) n++;
    return "New Division " + n;
  }

  function renameDivision(oldName) {
    var newName = window.prompt("Rename division:", oldName);
    if (!newName) return;
    newName = newName.trim();
    if (!newName || newName === oldName) return;
    if (divisionColours[newName]) {
      window.alert("A division with that name already exists.");
      return;
    }

    divisionColours[newName] = divisionColours[oldName];
    delete divisionColours[oldName];

    Object.keys(assignment).forEach(function (code) {
      if (assignment[code] === oldName) assignment[code] = newName;
    });

    if (activeDivision === oldName) activeDivision = newName;

    setActiveDivision(activeDivision);
    refreshAll();
  }

  function showColourPicker(swatchEl, divisionName) {
    // close any existing picker
    var existing = document.querySelector(".colour-picker");
    if (existing) existing.remove();

    var picker = document.createElement("div");
    picker.className = "colour-picker";
    var currentColour = divisionColours[divisionName];

    ALL_COLOURS.forEach(function (colour) {
      var option = document.createElement("div");
      option.className = "colour-option" + (colour === currentColour ? " current" : "");
      option.style.background = colour;
      option.addEventListener("click", function (e) {
        e.stopPropagation();
        divisionColours[divisionName] = colour;
        refreshAll();
      });
      picker.appendChild(option);
    });

    swatchEl.parentElement.style.position = "relative";
    swatchEl.parentElement.appendChild(picker);

    // close on outside click
    var closeHandler = function (e) {
      if (!picker.contains(e.target) && e.target !== swatchEl) {
        picker.remove();
        document.removeEventListener("click", closeHandler);
      }
    };
    document.addEventListener("click", closeHandler);
  }

  function computeQuotaStatus() {
    var q = computeQuota();
    var totals = divisionTotals();
    var actualStatus = "ok";  // default green
    var projectedStatus = "ok";

    if (q.divisor === 0) {
      return { actualStatus: "empty", projectedStatus: "empty" };
    }

    Object.keys(totals).forEach(function (name) {
      var t = totals[name];
      if (t.count === 0) return;

      // Check actual quota
      var actualStat = statusFor(t.actual, q.actualQuota, 0.10);
      if (actualStat === "under" || actualStatus === "under") actualStatus = "under";
      if (actualStat === "over" || actualStatus === "over") actualStatus = "over";
      if (actualStat === "under" && actualStatus === "over") actualStatus = "both";
      if (actualStat === "over" && actualStatus === "under") actualStatus = "both";

      // Check projected quota
      var projStat = statusFor(t.projected, q.projectedQuota, 0.035);
      if (projStat === "under" || projectedStatus === "under") projectedStatus = "under";
      if (projStat === "over" || projectedStatus === "over") projectedStatus = "over";
      if (projStat === "under" && projectedStatus === "over") projectedStatus = "both";
      if (projStat === "over" && projectedStatus === "under") projectedStatus = "both";
    });

    return { actualStatus: actualStatus, projectedStatus: projectedStatus, quota: q };
  }

  function divisionTotals() {
    var totals = {}; // name -> { count, actual, projected }
    Object.keys(divisionColours).forEach(function (name) {
      totals[name] = { count: 0, actual: 0, projected: 0 };
    });
    Object.keys(assignment).forEach(function (code) {
      var div = assignment[code];
      var ref = sa1Reference[code];
      if (!totals[div] || !ref) return;
      totals[div].count++;
      totals[div].actual += ref.actual;
      totals[div].projected += ref.projected;
    });
    return totals;
  }

  function stateWideTotals() {
    var actual = 0, projected = 0;
    Object.keys(sa1Reference).forEach(function (code) {
      actual += sa1Reference[code].actual;
      projected += sa1Reference[code].projected;
    });
    return { actual: actual, projected: projected };
  }

  function computeQuota() {
    var totals = divisionTotals();
    var nonZeroCount = Object.keys(totals).filter(function (name) {
      return totals[name].count > 0;
    }).length;

    var stateTotals = stateWideTotals();

    if (nonZeroCount === 0) {
      return { actualQuota: 0, projectedQuota: 0, divisor: 0 };
    }

    return {
      actualQuota: stateTotals.actual / nonZeroCount,
      projectedQuota: stateTotals.projected / nonZeroCount,
      divisor: nonZeroCount
    };
  }

  function statusFor(value, quota, tolerance) {
    if (quota === 0) return "empty";
    var lower = quota * (1 - tolerance);
    var upper = quota * (1 + tolerance);
    if (value < lower) return "under";
    if (value > upper) return "over";
    return "ok";
  }

  function statusLabel(status) {
    if (status === "ok") return "Within quota";
    if (status === "under") return "Under quota";
    if (status === "over") return "Over quota";
    return "&mdash;";
  }

  // ---- rendering: sidebar ----

  function refreshAll() {
    refreshDivisionList();
    // restyle every SA1 in case a rename moved colours around
    Object.keys(sa1Layers).forEach(restyleSa1);
  }

  function refreshQuotaPanel() {
    var q = computeQuota();
    var status = computeQuotaStatus();

    if (q.divisor === 0) {
      el.quotaDivisor.innerHTML = "Based on 0 divisions";
      el.quotaActualValue.innerHTML = "—";
      el.quotaActualBand.innerHTML = "—";
      el.quotaProjectedValue.innerHTML = "—";
      el.quotaProjectedBand.innerHTML = "—";
      return;
    }

    var thresholdStyle = function (isLow, stat) {
      var bgColor = "#f5f5f5";
      var textColor = "#666";
      if (isLow && stat === "under") {
        bgColor = "#fff4d9";
        textColor = "#8a6200";
      } else if (isLow && stat === "ok") {
        bgColor = "#e6f4ec";
        textColor = "#0b6b3a";
      } else if (!isLow && stat === "over") {
        bgColor = "#fde8ea";
        textColor = "#a3203b";
      } else if (!isLow && stat === "ok") {
        bgColor = "#e6f4ec";
        textColor = "#0b6b3a";
      }
      return "background:" + bgColor + "; color:" + textColor + ";";
    };

    el.quotaDivisor.innerHTML = 
      '<span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; background:#f0f0f0; color:#666;">[ ' + q.divisor + ' divisions ]</span>';

    el.quotaActualValue.innerHTML = 
      '<span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:600; background:#f0f0f0; color:#666;">' + Math.round(q.actualQuota).toLocaleString() + '</span>';

    el.quotaActualBand.innerHTML = 
      '<span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; ' + thresholdStyle(true, status.actualStatus) + '">[ ' + Math.round(q.actualQuota * 0.9).toLocaleString() + ' ]</span> ' +
      '<span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; ' + thresholdStyle(false, status.actualStatus) + '">[ ' + Math.round(q.actualQuota * 1.1).toLocaleString() + ' ]</span>';

    el.quotaProjectedValue.innerHTML = 
      '<span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:600; background:#f0f0f0; color:#666;">' + Math.round(q.projectedQuota).toLocaleString() + '</span>';

    el.quotaProjectedBand.innerHTML = 
      '<span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; ' + thresholdStyle(true, status.projectedStatus) + '">[ ' + Math.round(q.projectedQuota * 0.965).toLocaleString() + ' ]</span> ' +
      '<span style="display:inline-block; padding:4px 8px; border-radius:4px; font-size:0.7rem; font-weight:600; ' + thresholdStyle(false, status.projectedStatus) + '">[ ' + Math.round(q.projectedQuota * 1.035).toLocaleString() + ' ]</span>';
  }

  function refreshDivisionList() {
    refreshQuotaPanel();
    var q = computeQuota();
    var totals = divisionTotals();
    var names = Object.keys(divisionColours).sort();

    el.divisionList.innerHTML = "";

    names.forEach(function (name) {
      var t = totals[name] || { count: 0, actual: 0, projected: 0 };
      var actualStatus = t.count === 0 ? "empty" : statusFor(t.actual, q.actualQuota, 0.10);
      var projectedStatus = t.count === 0 ? "empty" : statusFor(t.projected, q.projectedQuota, 0.035);

      var li = document.createElement("li");
      li.className = "division-row" + (name === activeDivision ? " is-active" : "");

      var actualPct = (q.actualQuota && t.count > 0) ? pctDeviation(t.actual, q.actualQuota) : null;
      var projectedPct = (q.projectedQuota && t.count > 0) ? pctDeviation(t.projected, q.projectedQuota) : null;

      li.innerHTML =
        '<div class="division-row-top">' +
          '<span class="div-swatch" style="background:' + divisionColours[name] + '" data-division="' + escapeHtml(name) + '"></span>' +
          '<span class="div-name">' + escapeHtml(name) + '</span>' +
          '<span class="div-sa1-count">' + t.count + ' SA1' + (t.count === 1 ? "" : "s") + '</span>' +
          '<button type="button" class="div-action" data-action="rename" title="Rename">&#9998;</button>' +
        '</div>' +
        statusLine("Actual", t.actual, actualStatus, actualPct) +
        statusLine("Projected", t.projected, projectedStatus, projectedPct) +
        (t.count === 0 ? '<span class="warning-chip">No SA1s assigned</span>' : "");

      li.addEventListener("click", function (e) {
        if (e.target && e.target.getAttribute("data-action") === "rename") {
          e.stopPropagation();
          renameDivision(name);
          return;
        }
        if (e.target && e.target.classList.contains("div-swatch")) {
          e.stopPropagation();
          showColourPicker(e.target, name);
          return;
        }
        setActiveDivision(name);
      });

      el.divisionList.appendChild(li);
    });
  }

  function statusLine(label, value, status, pct) {
    var pctText = pct === null ? "" : " (" + (pct > 0 ? "+" : "") + pct.toFixed(1) + "%)";
    return (
      '<div class="status-line status-' + status + '">' +
        '<span>' + label + ': ' + value.toLocaleString() + pctText + '</span>' +
        '<span class="status-tag">' + statusLabel(status) + '</span>' +
      '</div>'
    );
  }

  function pctDeviation(value, quota) {
    if (!quota) return 0;
    return ((value - quota) / quota) * 100;
  }

  // ---- export ----

  function onExport() {
    var rows = [];
    rows.push(["SA1_CODE", "SA2_CODE", "SA2_NAME", "ACTUAL", "PROJECTED", "DIVISION", "SA1_CODE_DIV"]);

    var sa1CodeDivs = Object.keys(sa1Reference).sort();
    sa1CodeDivs.forEach(function (codeDivComposite) {
      var ref = sa1Reference[codeDivComposite];
      var div = assignment[codeDivComposite] || "";
      var displayCode = codeDivComposite.split("-")[0];
      rows.push([
        displayCode,
        ref.sa2Code,
        ref.sa2Name,
        ref.actual,
        ref.projected,
        div,
        codeDivComposite
      ]);
    });

    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        if (typeof cell === "string" && (cell.includes(",") || cell.includes('"') || cell.includes("\n"))) {
          return '"' + cell.replace(/"/g, '""') + '"';
        }
        return cell;
      }).join(",");
    }).join("\n");

    var stateKey = el.stateSelect.value;
    var today = new Date();
    var dateStr = today.getFullYear() + "-" + 
                  String(today.getMonth() + 1).padStart(2, "0") + "-" + 
                  String(today.getDate()).padStart(2, "0");
    var filename = "redistribution_" + stateKey + "_" + dateStr + ".csv";

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ---- utils ----

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str == null ? "" : str;
    return d.innerHTML;
  }

})();
