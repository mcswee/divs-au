#!/usr/bin/env python3
"""
ptv_gtfs_stations.py
Processes PTV GTFS Schedule into static JSON for the divs.au Melbourne
train departures board. Supports metropolitan trains and optional V/Line.

Download GTFS from:
  https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/gtfs/
  Folder 2 = metropolitan trains
  Folder 1 = V/Line services

Usage:
  python ptv_gtfs_stations.py "gtfs\\2\\google_transit.zip"
  python ptv_gtfs_stations.py "gtfs\\2\\google_transit.zip" "gtfs\\1\\google_transit.zip"

Output (written to ./out/):
  stations.json              - station index for the dropdown
  departures_{id}.json       - per-station departures (loaded on demand)
  patterns_{route}.json      - stopping patterns per route (loaded on expand)
"""

import sys, os, io, re, json, zipfile, csv
from collections import defaultdict
from datetime import datetime

OUTPUT_DIR = "out"

# ── Metro line groups ─────────────────────────────────────────────────────────
# route_short_name → (group_id, hex_colour)
METRO_GROUPS = {
    "Frankston":             ("frankston",    "#028420"),
    "Stony Point":           ("frankston",    "#028420"),
    "Lilydale":              ("burnley",      "#152C6B"),
    "Belgrave":              ("burnley",      "#152C6B"),
    "Alamein":               ("burnley",      "#152C6B"),
    "Glen Waverley":         ("burnley",      "#152C6B"),
    "Craigieburn":           ("northern",     "#FFBE00"),
    "Upfield":               ("northern",     "#FFBE00"),
    "Mernda":                ("clifton_hill", "#BE1014"),
    "Hurstbridge":           ("clifton_hill", "#BE1014"),
    "Pakenham":              ("yarra",        "#279FD5"),
    "Cranbourne":            ("yarra",        "#279FD5"),
    "Sunbury":               ("yarra",        "#279FD5"),
    "Sandringham":           ("bayside",      "#F178AF"),
    "Werribee":              ("bayside",      "#F178AF"),
    "Williamstown":          ("bayside",      "#F178AF"),
    "Flemington Racecourse": ("showgrounds",  "#95979A"),
}

GROUP_NAMES = {
    "frankston":    "Frankston / Stony Point",
    "burnley":      "Burnley",
    "northern":     "Northern",
    "clifton_hill": "Clifton Hill",
    "yarra":        "Yarra / Metro Tunnel",
    "bayside":      "Bayside / Cross City",
    "showgrounds":  "Showgrounds",
    "vline":        "V/Line",
}

VLINE_COLOUR = "#7F0D82"


# ── Helpers ───────────────────────────────────────────────────────────────────

def clean_name(raw):
    """Strip PTV boilerplate from station names."""
    name = raw.strip()
    for suffix in [" Railway Station", " Underground Station", " Station"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()
            break
    name = re.sub(r'\s*\([^)]+\)\s*$', '', name).strip()
    return name

def clean_headsign(hs):
    """Strip routing qualifiers: 'Geelong via Werribee' → 'Geelong'."""
    if not hs:
        return hs
    return hs.split(" via ")[0].strip()

def safe_fn(s):
    return re.sub(r'[^A-Za-z0-9_\-]', '_', s)

def to_min(t):
    parts = t.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])

def to_hhmm(mins):
    h, m = divmod(int(mins), 60)
    return f"{h:02d}:{m:02d}"

def make_reader(path):
    if os.path.isdir(path):
        def reader(name):
            p = os.path.join(path, name)
            if not os.path.exists(p):
                raise FileNotFoundError(p)
            return csv.DictReader(open(p, encoding="utf-8-sig"))
        return reader
    zf = zipfile.ZipFile(path)
    names = zf.namelist()
    def reader(name):
        hits = [n for n in names if n == name or n.endswith("/" + name)]
        if not hits:
            raise FileNotFoundError(f"{name} not in zip")
        return csv.DictReader(io.StringIO(zf.read(hits[0]).decode("utf-8-sig")))
    return reader


# ── GTFS loader (reused for both metro and V/Line) ───────────────────────────

def load_stops(read, existing_name_to_id=None):
    """
    Load stops.txt. Returns:
      parent_name:  {parent_id → display name}
      child_parent: {child_id  → parent_id}
      child_plat:   {child_id  → platform label}
      name_to_id:   {display name → parent_id}  (for cross-feed matching)

    If existing_name_to_id provided, stations already known are mapped to
    their existing parent_id rather than creating duplicates.
    """
    parent_name  = {}
    child_parent = {}
    child_plat   = {}
    all_stops    = list(read("stops.txt"))

    # First pass: station-level stops
    for row in all_stops:
        loc = row.get("location_type", "").strip()
        par = row.get("parent_station", "").strip()
        if loc == "1" or (not par and loc != "4"):
            raw_name = clean_name(row["stop_name"])
            stop_id  = row["stop_id"]
            # If this station is already known from another feed, reuse that ID
            if existing_name_to_id and raw_name in existing_name_to_id:
                canonical_id = existing_name_to_id[raw_name]
                # Map this feed's parent_id to the canonical one
                child_parent[stop_id] = canonical_id
            else:
                parent_name[stop_id] = raw_name

    # Second pass: platform-level stops
    for row in all_stops:
        par = row.get("parent_station", "").strip()
        if not par:
            continue
        # Resolve through any canonical remapping
        canonical_par = child_parent.get(par, par if par in parent_name else None)
        if canonical_par:
            child_parent[row["stop_id"]] = canonical_par
            child_plat[row["stop_id"]]   = row.get("platform_code", "").strip()

    # Fallback: flat GTFS
    if not child_parent and not any(
        row.get("parent_station","").strip()
        for row in all_stops
    ):
        for row in all_stops:
            raw_name = clean_name(row["stop_name"])
            stop_id  = row["stop_id"]
            if existing_name_to_id and raw_name in existing_name_to_id:
                child_parent[stop_id] = existing_name_to_id[raw_name]
            else:
                parent_name[stop_id] = raw_name

    name_to_id = {v: k for k, v in parent_name.items()}
    return parent_name, child_parent, child_plat, name_to_id


def load_calendar(read, existing=None):
    """Load calendar.txt into a service_id dict, merging with existing if given."""
    cal = dict(existing) if existing else {}
    try:
        for row in read("calendar.txt"):
            sid     = row["service_id"]
            weekday = any(row.get(d,"0")=="1"
                          for d in ["monday","tuesday","wednesday","thursday","friday"])
            sat     = row.get("saturday","0") == "1"
            sun     = row.get("sunday",  "0") == "1"
            try:
                start = int(row.get("start_date") or 0)
                end   = int(row.get("end_date")   or 0)
            except ValueError:
                start = end = 0
            cal[sid] = {"weekday": weekday, "saturday": sat, "sunday": sun,
                        "from": start, "until": end}
    except FileNotFoundError:
        pass
    return cal


# ── Main ──────────────────────────────────────────────────────────────────────

def main(metro_gtfs, vline_gtfs=None):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Shared output structures (merged across feeds)
    all_parent_name  = {}   # parent_id → display name
    all_child_parent = {}   # child_id  → parent_id
    all_child_plat   = {}   # child_id  → platform label
    all_trip_meta    = {}   # trip_id   → {service_id, name, group, colour, headsign}
    all_trip_stops   = defaultdict(list)   # trip_id → [{seq,par,plat,min}]
    all_service_cal  = {}   # service_id → {weekday,sat,sun,from,until}
    route_patterns   = defaultdict(dict)   # route_name → {trip_id: [[name,time]]}

    # ═══════════════════════════════════════════════════════════════
    # Phase 1: Metropolitan trains
    # ═══════════════════════════════════════════════════════════════
    print("── Metropolitan trains ──────────────────────────")
    read = make_reader(metro_gtfs)

    print("Loading stops...")
    metro_parent, metro_child_par, metro_child_plat, metro_name_to_id = load_stops(read)
    all_parent_name.update(metro_parent)
    all_child_parent.update(metro_child_par)
    all_child_plat.update(metro_child_plat)
    print(f"  {len(metro_parent)} stations")

    print("Loading routes...")
    metro_route_ids = set()
    metro_route_meta = {}
    all_route_names  = set()
    for row in read("routes.txt"):
        name = (row.get("route_short_name") or row.get("route_long_name","")).strip()
        rid  = row["route_id"]
        all_route_names.add(name)
        if name in METRO_GROUPS:
            group, colour = METRO_GROUPS[name]
            metro_route_meta[rid] = {"name": name, "group": group, "colour": colour}
            metro_route_ids.add(rid)
    print(f"  {len(metro_route_ids)} routes matched")
    missing = set(METRO_GROUPS) - {m["name"] for m in metro_route_meta.values()}
    if missing:
        print(f"  WARNING: not found: {missing}")

    print("Loading trips...")
    for row in read("trips.txt"):
        rid = row["route_id"]
        if rid not in metro_route_ids:
            continue
        all_trip_meta[row["trip_id"]] = {
            "service_id": row["service_id"],
            "headsign":   row.get("trip_headsign","").strip(),
            "direction":  row.get("direction_id","0").strip(),
            **metro_route_meta[rid],
        }
    print(f"  {len(all_trip_meta)} trips")

    print("Loading calendar...")
    all_service_cal = load_calendar(read)
    print(f"  {len(all_service_cal)} entries")

    print("Loading stop_times.txt...")
    rows = 0
    for row in read("stop_times.txt"):
        tid = row["trip_id"]
        if tid not in all_trip_meta:
            continue
        sid = row["stop_id"]
        if sid in all_child_parent:
            par, plat = all_child_parent[sid], all_child_plat.get(sid,"")
        elif sid in all_parent_name:
            par, plat = sid, ""
        else:
            continue
        dep = (row.get("departure_time") or row.get("arrival_time") or "").strip()
        if not dep:
            continue
        try:
            dep_min = to_min(dep)
            seq     = int(row.get("stop_sequence",0))
        except (ValueError, IndexError):
            continue
        all_trip_stops[tid].append({"seq":seq,"par":par,"plat":plat,"min":dep_min})
        rows += 1
        if rows % 500_000 == 0:
            print(f"  ... {rows:,} rows")
    print(f"  {rows:,} rows")

    # ═══════════════════════════════════════════════════════════════
    # Phase 2: V/Line (optional)
    # ═══════════════════════════════════════════════════════════════
    if vline_gtfs:
        print()
        print("── V/Line ───────────────────────────────────────")
        vread = make_reader(vline_gtfs)

        print("Loading stops...")
        # Pass existing metro name→id so shared stations reuse metro IDs
        vline_parent, vline_child_par, vline_child_plat, _ = load_stops(
            vread, existing_name_to_id=metro_name_to_id
        )
        all_parent_name.update(vline_parent)
        all_child_parent.update(vline_child_par)
        all_child_plat.update(vline_child_plat)
        print(f"  {len(vline_parent)} new stations (shared stations reuse metro IDs)")

        print("Loading routes...")
        vline_route_ids  = set()
        vline_route_meta = {}
        for row in vread("routes.txt"):
            name = (row.get("route_short_name") or row.get("route_long_name","")).strip()
            rid  = row["route_id"]
            vline_route_meta[rid] = {"name": name, "group": "vline", "colour": VLINE_COLOUR}
            vline_route_ids.add(rid)
        print(f"  {len(vline_route_ids)} V/Line routes")

        print("Loading trips...")
        vline_trips_added = 0
        for row in vread("trips.txt"):
            rid = row["route_id"]
            if rid not in vline_route_ids:
                continue
            all_trip_meta[row["trip_id"]] = {
                "service_id": row["service_id"],
                "headsign":   row.get("trip_headsign","").strip(),
                "direction":  row.get("direction_id","0").strip(),
                **vline_route_meta[rid],
            }
            vline_trips_added += 1
        print(f"  {vline_trips_added} trips")

        print("Loading calendar...")
        all_service_cal = load_calendar(vread, existing=all_service_cal)
        print(f"  {len(all_service_cal)} total calendar entries")

        print("Loading V/Line stop_times.txt...")
        vrows = 0
        for row in vread("stop_times.txt"):
            tid = row["trip_id"]
            if tid not in all_trip_meta:
                continue
            if all_trip_meta[tid]["group"] != "vline":
                continue
            sid = row["stop_id"]
            if sid in all_child_parent:
                par, plat = all_child_parent[sid], all_child_plat.get(sid,"")
            elif sid in all_parent_name:
                par, plat = sid, ""
            else:
                continue
            dep = (row.get("departure_time") or row.get("arrival_time") or "").strip()
            if not dep:
                continue
            try:
                dep_min = to_min(dep)
                seq     = int(row.get("stop_sequence",0))
            except (ValueError, IndexError):
                continue
            all_trip_stops[tid].append({"seq":seq,"par":par,"plat":plat,"min":dep_min})
            vrows += 1
        print(f"  {vrows:,} rows")

    # ═══════════════════════════════════════════════════════════════
    # Assemble departures
    # ═══════════════════════════════════════════════════════════════
    print()
    print("Sorting stop sequences...")
    for tid in all_trip_stops:
        all_trip_stops[tid].sort(key=lambda x: x["seq"])

    # Build master stopping pattern per (route, direction).
    # The longest trip is the all-stations reference — express services
    # are subsets of it with intermediate stops removed.
    print("Computing master stopping patterns...")
    master_pat = {}  # (route_name, direction) → [parent_id, ...]
    for tid, stops in all_trip_stops.items():
        meta = all_trip_meta[tid]
        key  = (meta["name"], meta.get("direction","0"))
        if key not in master_pat or len(stops) > len(master_pat[key]):
            master_pat[key] = [s["par"] for s in stops]
    print(f"  {len(master_pat)} route/direction combinations")

    def get_cal(service_id):
        return all_service_cal.get(service_id,
               {"weekday":True,"saturday":True,"sunday":True,"from":0,"until":0})

    print("Assembling departures...")
    station_deps = defaultdict(list)

    for tid, stops in all_trip_stops.items():
        meta = all_trip_meta[tid]
        cal  = get_cal(meta["service_id"])

        last_name = all_parent_name.get(stops[-1]["par"],"")
        hs_clean  = clean_headsign(meta["headsign"])
        dest = hs_clean if hs_clean and hs_clean != meta["name"] else last_name

        # Stations whose absence doesn't indicate an express service —
        # these are routing variations (loop vs direct) not suburban skips.
        CITY_STATIONS = {
            "Flinders Street", "Southern Cross", "Flagstaff",
            "Melbourne Central", "Parliament", "Richmond",
            "State Library", "Town Hall", "Anzac",
        }

        # Determine service type by comparing against master all-stations pattern
        key       = (meta["name"], meta.get("direction","0"))
        master    = master_pat.get(key, [])
        stop_pars = [s["par"] for s in stops]
        master_pos = {par: i for i, par in enumerate(master)}

        service_type = ""
        if master and len(stop_pars) > 1:
            first_m = master_pos.get(stop_pars[0], -1)
            last_m  = master_pos.get(stop_pars[-1], -1)
            if first_m >= 0 and last_m >= 0 and last_m > first_m:
                expected = set(master[first_m:last_m+1])
                skipped  = {p for p in (expected - set(stop_pars))
                            if p in all_parent_name
                            and all_parent_name[p] not in CITY_STATIONS}
                service_type = "Express" if skipped else "All stations"

        # Build annotated pattern with __EXP__ markers for skipped stops
        pattern = []
        for i, stop in enumerate(stops):
            pattern.append([all_parent_name.get(stop["par"], stop["par"]),
                            to_hhmm(stop["min"])])
            if i < len(stops) - 1 and master:
                cur_m  = master_pos.get(stop["par"], -1)
                next_m = master_pos.get(stops[i+1]["par"], -1)
                if cur_m >= 0 and next_m >= 0 and next_m > cur_m + 1:
                    skipped_names = [
                        all_parent_name[master[j]]
                        for j in range(cur_m+1, next_m)
                        if master[j] in all_parent_name
                    ]
                    if skipped_names:
                        pattern.append(["__EXP__", ", ".join(skipped_names)])

        route_patterns[meta["name"]][tid] = pattern

        # Skip last stop (terminus — arrival not departure)
        for i, stop in enumerate(stops):
            if i == len(stops) - 1:
                continue
            pid = stop["par"]
            station_deps[pid].append({
                "trip_id":  tid,
                "route":    meta["name"],
                "group":    meta["group"],
                "colour":   meta["colour"],
                "dest":     dest,
                "plat":     stop["plat"],
                "departs":  to_hhmm(stop["min"]),
                "dep_min":  stop["min"],
                "days":     cal,
                "pat_idx":  i,
                "stype":    service_type,
            })

    # ═══════════════════════════════════════════════════════════════
    # Write output
    # ═══════════════════════════════════════════════════════════════
    print("Writing departure files...")
    station_index = []

    for pid, deps in station_deps.items():
        if pid not in all_parent_name:
            continue
        deps.sort(key=lambda x: x["dep_min"])
        for d in deps:
            del d["dep_min"]
        name   = all_parent_name[pid]
        groups = sorted(set(d["group"] for d in deps))
        sid    = safe_fn(pid)
        with open(os.path.join(OUTPUT_DIR, f"departures_{sid}.json"), "w", encoding="utf-8") as f:
            json.dump({"id":pid,"name":name,"departures":deps}, f, separators=(",",":"))
        station_index.append({"id":pid,"name":name,"groups":groups})

    station_index.sort(key=lambda x: x["name"])

    with open(os.path.join(OUTPUT_DIR, "stations.json"), "w", encoding="utf-8") as f:
        json.dump({"generated":datetime.now().isoformat(),
                   "groups":GROUP_NAMES,
                   "stations":station_index}, f, indent=2)

    print("Writing pattern files...")
    for route, trips in route_patterns.items():
        with open(os.path.join(OUTPUT_DIR, f"patterns_{safe_fn(route)}.json"), "w", encoding="utf-8") as f:
            json.dump(trips, f, separators=(",",":"))

    total_kb = sum(
        os.path.getsize(os.path.join(OUTPUT_DIR,fn))
        for fn in os.listdir(OUTPUT_DIR) if fn.endswith(".json")
    ) // 1024

    print(f"\n✓ Done")
    print(f"  stations.json       — {len(station_index)} stations")
    print(f"  departures_*.json   — {len(station_deps)} files")
    print(f"  patterns_*.json     — {len(route_patterns)} files")
    print(f"  Total size: {total_kb:,} KB")

    # Sanity check
    print("\nSanity check — Southern Cross (first 5 weekday departures):")
    ssx = next((s for s in station_index if "Southern Cross" in s["name"]), None)
    if ssx:
        with open(os.path.join(OUTPUT_DIR, f"departures_{safe_fn(ssx['id'])}.json")) as f:
            data = json.load(f)
        shown = 0
        for d in data["departures"]:
            if not d["days"].get("weekday"): continue
            print(f"  {d['departs']}  {d['route']:<22}  → {d['dest']:<25}  Plat {d['plat'] or '—'}  [{d['group']}]")
            shown += 1
            if shown >= 5: break


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    vline = sys.argv[2] if len(sys.argv) >= 3 else None
    main(sys.argv[1], vline)
