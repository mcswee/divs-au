#!/usr/bin/env python3
"""
SAGE Index — Surprise Adjusted Game Evaluation
Fetches AFL game data from Squiggle API, computes SAGE ratings,
and writes output JSON for the static site.
"""

import json
import math
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Constants ────────────────────────────────────────────────────────────────

SQUIGGLE_BASE = "https://api.squiggle.com.au/"
USER_AGENT    = "SAGE Index - https://github.com/mcswee/divs-au/"
START_YEAR    = 2010
CURRENT_YEAR  = datetime.now(timezone.utc).year

TEAM_STATE = {
    "Adelaide": "SA", "Brisbane Lions": "QLD", "Carlton": "VIC",
    "Collingwood": "VIC", "Essendon": "VIC", "Fremantle": "WA",
    "Geelong": "VIC", "Gold Coast": "QLD", "Greater Western Sydney": "NSW",
    "Hawthorn": "VIC", "Melbourne": "VIC", "North Melbourne": "VIC",
    "Port Adelaide": "SA", "Richmond": "VIC", "St Kilda": "VIC",
    "Sydney": "NSW", "West Coast": "WA", "Western Bulldogs": "VIC",
}

VENUE_STATE = {
    "Adelaide Oval": "SA", "Barossa Park": "SA", "Bellerive Oval": "TAS",
    "Blacktown": "NSW", "Carrara": "QLD", "Cazaly's Stadium": "FNQ",
    "Docklands": "VIC", "Eureka Stadium": "VIC", "Football Park": "SA",
    "Gabba": "QLD", "Hands Oval": "WA", "Jiangwan Stadium": "OS",
    "Kardinia Park": "VIC", "M.C.G.": "VIC", "Manuka Oval": "ACT",
    "Marrara Oval": "NT", "Norwood Oval": "SA", "Princes Park": "VIC",
    "Perth Stadium": "WA", "Riverway Stadium": "FNQ", "S.C.G.": "NSW",
    "Stadium Australia": "NSW", "Subiaco": "WA", "Summit Sport Park": "SA",
    "Sydney Showground": "NSW", "Traeger Park": "NT", "Wellington": "OS",
    "York Park": "TAS",
}

ALL_TEAMS = [
    "Adelaide", "Brisbane Lions", "Carlton", "Collingwood", "Essendon",
    "Fremantle", "Geelong", "Gold Coast", "Greater Western Sydney",
    "Hawthorn", "Melbourne", "North Melbourne", "Port Adelaide",
    "Richmond", "St Kilda", "Sydney", "West Coast", "Western Bulldogs",
]


# ── API ───────────────────────────────────────────────────────────────────────

def fetch(params: str) -> dict:
    url = f"{SQUIGGLE_BASE}?{params}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

def get_games(year: int) -> list:
    return fetch(f"q=games;year={year};complete=100").get("games", [])

def get_upcoming_games(year: int) -> list:
    games = fetch(f"q=games;year={year};complete=!100").get("games", [])
    return [g for g in games if g.get("ateam") and g.get("complete", 0) == 0]


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_dt(date_str: str):
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.000Z", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str[:19], fmt[:19]).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None

def game_value(margin: int) -> float:
    """Outcome + margin/60 — the base unit used in R11, V11, and delta."""
    outcome = 1 if margin > 0 else (-1 if margin < 0 else 0)
    return outcome + (margin / 60)

def rest_penalty(team: str, game_dt, history: list) -> float:
    team_games = [g for g in history if g["hteam"] == team or g["ateam"] == team]
    if not team_games or not game_dt:
        return 0.0
    last_dt = parse_dt(team_games[-1].get("date"))
    if not last_dt:
        return 0.0
    days = (game_dt - last_dt).total_seconds() / 86400
    return (days - 7) * 0.2 if days < 6.95 else 0.0

def travel_bonus(team: str, venue: str) -> float:
    ts = TEAM_STATE.get(team)
    vs = VENUE_STATE.get(venue)
    if not ts or not vs:
        return 0.0
    return 0.2 if vs in ("OS", "FNQ", "NT", "ACT", "TAS") or vs != ts else 0.0

def compute_r11(team: str, opponent: str, history: list) -> float:
    """Average game_value across last 11 H2H games (team perspective)."""
    h2h = [g for g in history if
           (g["hteam"] == team and g["ateam"] == opponent) or
           (g["ateam"] == team and g["hteam"] == opponent)][-11:]
    if not h2h:
        return 0.0
    vals = []
    for g in h2h:
        m = (g["hscore"] - g["ascore"]) if g["hteam"] == team else (g["ascore"] - g["hscore"])
        vals.append(game_value(m))
    return sum(vals) / len(vals)

def compute_v11(team: str, venue: str, history: list) -> float:
    """Average game_value across last 11 games at this venue (team perspective)."""
    vg = [g for g in history if
          g.get("venue") == venue and (g["hteam"] == team or g["ateam"] == team)][-11:]
    if not vg:
        return 0.0
    vals = []
    for g in vg:
        m = (g["hscore"] - g["ascore"]) if g["hteam"] == team else (g["ascore"] - g["hscore"])
        vals.append(game_value(m))
    return sum(vals) / len(vals)

def surprise_factor(team_output: float, opp_output: float) -> float:
    """
    SF = 1 + tanh((opp_output - team_output) / 30)
    Stronger team (higher output) gets lower SF.
    Weaker team gets higher SF — a win by them is more surprising.
    """
    return 1 + math.tanh((opp_output - team_output) / 30)

def prediction(sf: float) -> float:
    """
    Confidence that this team wins = 1 - (SF / 2).
    Lower SF (stronger team) → higher prediction.
    """
    return 1 - (sf / 2)

def compute_delta(sf: float, outcome: int, margin: int, scored: int,
                  team: str, venue: str) -> float:
    return (sf * outcome) + (margin / 60) + (0.2 if scored >= 100 else 0.0) + travel_bonus(team, venue)


# ── Core game processor ───────────────────────────────────────────────────────

def process_game(game: dict, ratings: dict, prior_ratings: dict, history: list):
    """
    Compute SAGE for one completed game.
    Updates ratings in-place. Returns a record dict or None (draw/bye).
    """
    hteam  = game["hteam"]
    ateam  = game["ateam"]
    hscore = game.get("hscore") or 0
    ascore = game.get("ascore") or 0
    venue  = game.get("venue", "")
    gdt    = parse_dt(game.get("date"))

    h_margin = hscore - ascore
    a_margin = ascore - hscore

    if h_margin > 0:
        h_outcome, a_outcome = 1, -1
    elif h_margin < 0:
        h_outcome, a_outcome = -1, 1
    else:
        return None  # draw — no change

    # R11 / V11
    h_r11 = compute_r11(hteam, ateam, history)
    a_r11 = -h_r11
    h_v11 = compute_v11(hteam, venue, history)
    a_v11 = compute_v11(ateam, venue, history)

    # Rest
    h_rest = rest_penalty(hteam, gdt, history)
    a_rest = rest_penalty(ateam, gdt, history)

    # Rating seed: use current season rating if they've played, else prior year's final
    h_rat = ratings.get(hteam, 0.0)
    a_rat = ratings.get(ateam, 0.0)
    h_seed = h_rat if h_rat != 0.0 else prior_ratings.get(hteam, 0.0)
    a_seed = a_rat if a_rat != 0.0 else prior_ratings.get(ateam, 0.0)

    h_output = h_r11 + h_v11 + h_rest + h_seed
    a_output = a_r11 + a_v11 + a_rest + a_seed

    h_sf = surprise_factor(h_output, a_output)
    a_sf = surprise_factor(a_output, h_output)

    h_pred = prediction(h_sf)
    a_pred = prediction(a_sf)

    h_delta = compute_delta(h_sf, h_outcome, h_margin, hscore, hteam, venue)
    a_delta = compute_delta(a_sf, a_outcome, a_margin, ascore, ateam, venue)

    ratings[hteam] = round(ratings.get(hteam, 0.0) + h_delta, 4)
    ratings[ateam] = round(ratings.get(ateam, 0.0) + a_delta, 4)

    return {
        "game_id":        game["id"],
        "year":           game["year"],
        "round":          game["round"],
        "roundname":      game.get("roundname", f"Round {game['round']}"),
        "date":           game.get("date"),
        "venue":          venue,
        "hteam":          hteam,
        "ateam":          ateam,
        "hscore":         hscore,
        "ascore":         ascore,
        "h_pred":         round(h_pred * 100, 1),
        "a_pred":         round(a_pred * 100, 1),
        "h_delta":        round(h_delta, 4),
        "a_delta":        round(a_delta, 4),
        "h_rating_after": ratings[hteam],
        "a_rating_after": ratings[ateam],
    }


def predict_upcoming(game: dict, ratings: dict, prior_ratings: dict, history: list) -> dict:
    hteam = game["hteam"]
    ateam = game["ateam"]
    venue = game.get("venue", "")
    gdt   = parse_dt(game.get("date"))

    h_r11 = compute_r11(hteam, ateam, history)
    a_r11 = -h_r11
    h_v11 = compute_v11(hteam, venue, history)
    a_v11 = compute_v11(ateam, venue, history)
    h_rest = rest_penalty(hteam, gdt, history)
    a_rest = rest_penalty(ateam, gdt, history)

    h_rat  = ratings.get(hteam, 0.0)
    a_rat  = ratings.get(ateam, 0.0)
    h_seed = h_rat if h_rat != 0.0 else prior_ratings.get(hteam, 0.0)
    a_seed = a_rat if a_rat != 0.0 else prior_ratings.get(ateam, 0.0)

    h_output = h_r11 + h_v11 + h_rest + h_seed
    a_output = a_r11 + a_v11 + a_rest + a_seed

    h_sf = surprise_factor(h_output, a_output)
    a_sf = surprise_factor(a_output, h_output)

    return {
        "game_id":  game["id"],
        "year":     game["year"],
        "round":    game["round"],
        "roundname":game.get("roundname", f"Round {game['round']}"),
        "date":     game.get("date"),
        "venue":    venue,
        "hteam":    hteam,
        "ateam":    ateam,
        "h_pred":   round(prediction(h_sf) * 100, 1),
        "a_pred":   round(prediction(a_sf) * 100, 1),
        "h_rating": round(h_seed, 4),
        "a_rating": round(a_seed, 4),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("SAGE Index — computing ratings from 2010...")

    prior_ratings  = {t: 0.0 for t in ALL_TEAMS}
    ratings        = {t: 0.0 for t in ALL_TEAMS}
    all_history    = []
    game_records   = []
    ratings_by_round = []

    for year in range(START_YEAR, CURRENT_YEAR + 1):
        print(f"  Fetching {year}...")
        try:
            games = get_games(year)
        except Exception as e:
            print(f"    Error: {e}")
            continue
        if not games:
            continue

        # Reset season ratings
        ratings = {t: 0.0 for t in ALL_TEAMS}

        games.sort(key=lambda g: g.get("date") or "")

        rounds = {}
        for g in games:
            rounds.setdefault(g.get("round", 0), []).append(g)

        for rnd in sorted(rounds.keys()):
            round_records = []
            for game in rounds[rnd]:
                if not game.get("ateam") or not game.get("hteam"):
                    continue
                if game.get("hscore") is None:
                    continue
                rec = process_game(game, ratings, prior_ratings, all_history)
                if rec:
                    game_records.append(rec)
                    round_records.append(rec)
                all_history.append(game)

            if round_records:
                ratings_by_round.append({
                    "year":      year,
                    "round":     rnd,
                    "roundname": round_records[0]["roundname"],
                    "ratings":   {t: round(v, 4) for t, v in ratings.items()},
                })

        prior_ratings = dict(ratings)
        time.sleep(0.5)

    # Power rankings
    power_rankings = [
        {"rank": i + 1, "team": t, "rating": round(v, 4)}
        for i, (t, v) in enumerate(sorted(ratings.items(), key=lambda x: x[1], reverse=True))
    ]

    # Upcoming predictions
    print("  Fetching upcoming games...")
    predictions = []
    try:
        for game in get_upcoming_games(CURRENT_YEAR):
            predictions.append(predict_upcoming(game, ratings, prior_ratings, all_history))
        predictions.sort(key=lambda g: g.get("date") or "")
    except Exception as e:
        print(f"  Could not fetch upcoming games: {e}")

    current_round = None
    if game_records:
        last = game_records[-1]
        current_round = {"year": last["year"], "round": last["round"], "roundname": last["roundname"]}

    output = {
        "generated":       datetime.now(timezone.utc).isoformat(),
        "current_round":   current_round,
        "power_rankings":  power_rankings,
        "predictions":     predictions,
        "game_records":    game_records[-200:],
        "ratings_by_round": ratings_by_round,
    }

    out_path = Path("assets/data/sage.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    print(f"Done. Written to {out_path}")
    print(f"  {len(game_records)} game records")
    print(f"  {len(predictions)} upcoming predictions")
    print(f"  {len(ratings_by_round)} round snapshots")


if __name__ == "__main__":
    main()
