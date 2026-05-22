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
USER_AGENT = "SAGE Index - mcswee/divs"
START_YEAR = 2010
CURRENT_YEAR = datetime.now(timezone.utc).year

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

# Seed ratings from 2009 final ladder (1st = highest seed)
# Scale: position mapped to a starting rating spread of ±1.0
LADDER_2009 = [
    "Geelong", "St Kilda", "Western Bulldogs", "Collingwood", "Carlton",
    "Brisbane Lions", "Adelaide", "Sydney", "Hawthorn", "Fremantle",
    "Melbourne", "West Coast", "Essendon", "Richmond", "Port Adelaide",
    "North Melbourne", "Gold Coast", "Greater Western Sydney",
]

def seed_ratings():
    """Generate starting SAGE ratings from 2009 ladder finish."""
    n = len(LADDER_2009)
    ratings = {}
    for i, team in enumerate(LADDER_2009):
        # Top team gets +1.0, bottom gets -1.0, linear spread
        ratings[team] = round(1.0 - (2.0 * i / (n - 1)), 4)
    return ratings


# ── API Fetch ─────────────────────────────────────────────────────────────────

def fetch(params: str) -> dict:
    url = f"{SQUIGGLE_BASE}?{params}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def get_games(year: int) -> list:
    data = fetch(f"q=games;year={year};complete=100")
    return data.get("games", [])


def get_upcoming_games(year: int) -> list:
    data = fetch(f"q=games;year={year};complete=!100")
    games = data.get("games", [])
    # Filter out byes (no ateam) and in-progress
    return [g for g in games if g.get("ateam") and g.get("complete", 0) == 0]


# ── SAGE Model ────────────────────────────────────────────────────────────────

def parse_dt(date_str: str) -> datetime:
    """Parse Squiggle date string to UTC datetime."""
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.000Z", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(date_str[:19], fmt[:len(date_str[:19])])
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def rest_penalty(days_between: float) -> float:
    if days_between < 6.95:
        return (days_between - 7) * 0.2
    return 0.0


def travel_bonus(team: str, venue: str) -> float:
    team_state = TEAM_STATE.get(team)
    venue_state = VENUE_STATE.get(venue)
    if team_state is None or venue_state is None:
        return 0.0
    if venue_state in ("OS", "FNQ", "NT", "ACT", "TAS"):
        return 0.2
    if venue_state != team_state:
        return 0.2
    return 0.0


def compute_r11(team: str, opponent: str, history: list) -> float:
    """Average margin (team perspective) in last 11 H2H games."""
    h2h = [g for g in history if
           (g["hteam"] == team and g["ateam"] == opponent) or
           (g["ateam"] == team and g["hteam"] == opponent)]
    h2h = h2h[-11:]
    if not h2h:
        return 0.0
    margins = []
    for g in h2h:
        if g["hteam"] == team:
            margins.append(g["hscore"] - g["ascore"])
        else:
            margins.append(g["ascore"] - g["hscore"])
    return sum(margins) / len(margins)


def compute_v11(team: str, venue: str, history: list) -> float:
    """Average margin (team perspective) in last 11 games at this venue."""
    venue_games = [g for g in history if
                   g.get("venue") == venue and
                   (g["hteam"] == team or g["ateam"] == team)]
    venue_games = venue_games[-11:]
    if not venue_games:
        return 0.0
    margins = []
    for g in venue_games:
        if g["hteam"] == team:
            margins.append(g["hscore"] - g["ascore"])
        else:
            margins.append(g["ascore"] - g["hscore"])
    return sum(margins) / len(margins)


def compute_rest(team: str, game_dt: datetime, history: list) -> float:
    """Compute rest penalty for team."""
    team_games = [g for g in history if
                  g["hteam"] == team or g["ateam"] == team]
    if not team_games:
        return 0.0
    last = team_games[-1]
    last_dt = parse_dt(last.get("date"))
    if not last_dt or not game_dt:
        return 0.0
    hours = (game_dt - last_dt).total_seconds() / 3600
    days = hours / 24
    return rest_penalty(days)


def surprise_factor(team_output: float, opp_output: float) -> float:
    return 1 - math.tanh((opp_output - team_output) / 30)


def compute_delta(sf: float, outcome: int, margin: int,
                  scored: int, team: str, venue: str) -> float:
    outcome_multiple = sf * outcome
    margin_component = margin / 60
    century = 0.2 if scored >= 100 else 0.0
    travel = travel_bonus(team, venue)
    return outcome_multiple + margin_component + century + travel


def process_completed_game(game: dict, ratings: dict, history: list) -> dict:
    """Compute SAGE delta for both teams and return updated ratings + game record."""
    hteam = game["hteam"]
    ateam = game["ateam"]
    hscore = game.get("hscore", 0) or 0
    ascore = game.get("ascore", 0) or 0
    venue = game.get("venue", "")
    game_dt = parse_dt(game.get("date"))

    # Margin from each team's perspective
    h_margin = hscore - ascore
    a_margin = ascore - hscore

    # Outcome flags
    if hscore > ascore:
        h_outcome, a_outcome = 1, -1
    elif ascore > hscore:
        h_outcome, a_outcome = -1, 1
    else:
        h_outcome = a_outcome = 0

    # Draw = no SAGE change
    if h_outcome == 0:
        return None

    # R11 / V11
    h_r11 = compute_r11(hteam, ateam, history)
    a_r11 = -h_r11
    h_v11 = compute_v11(hteam, venue, history)
    a_v11 = compute_v11(ateam, venue, history)

    # Rest
    h_rest = compute_rest(hteam, game_dt, history)
    a_rest = compute_rest(ateam, game_dt, history)

    # Team output = rival adv + ground adv + rest + last rating
    h_output = h_r11 + h_v11 + h_rest + ratings.get(hteam, 0)
    a_output = a_r11 + a_v11 + a_rest + ratings.get(ateam, 0)

    # Surprise factors
    h_sf = surprise_factor(h_output, a_output)
    a_sf = surprise_factor(a_output, h_output)

    # Prediction (pre-game, stored for display)
    h_pred = (h_sf - a_sf) / 2
    a_pred = (a_sf - h_sf) / 2

    # Delta
    h_delta = compute_delta(h_sf, h_outcome, h_margin, hscore, hteam, venue)
    a_delta = compute_delta(a_sf, a_outcome, a_margin, ascore, ateam, venue)

    # New ratings
    new_h = ratings.get(hteam, 0) + h_delta
    new_a = ratings.get(ateam, 0) + a_delta

    ratings[hteam] = round(new_h, 4)
    ratings[ateam] = round(new_a, 4)

    return {
        "game_id": game["id"],
        "year": game["year"],
        "round": game["round"],
        "roundname": game.get("roundname", f"Round {game['round']}"),
        "date": game.get("date"),
        "venue": venue,
        "hteam": hteam,
        "ateam": ateam,
        "hscore": hscore,
        "ascore": ascore,
        "h_pred": round(h_pred * 100, 1),
        "a_pred": round(a_pred * 100, 1),
        "h_delta": round(h_delta, 4),
        "a_delta": round(a_delta, 4),
        "h_rating_after": ratings[hteam],
        "a_rating_after": ratings[ateam],
    }


def predict_game(game: dict, ratings: dict, history: list) -> dict:
    """Generate prediction for an upcoming game."""
    hteam = game["hteam"]
    ateam = game["ateam"]
    venue = game.get("venue", "")
    game_dt = parse_dt(game.get("date"))

    h_r11 = compute_r11(hteam, ateam, history)
    a_r11 = -h_r11
    h_v11 = compute_v11(hteam, venue, history)
    a_v11 = compute_v11(ateam, venue, history)
    h_rest = compute_rest(hteam, game_dt, history)
    a_rest = compute_rest(ateam, game_dt, history)

    h_output = h_r11 + h_v11 + h_rest + ratings.get(hteam, 0)
    a_output = a_r11 + a_v11 + a_rest + ratings.get(ateam, 0)

    h_sf = surprise_factor(h_output, a_output)
    a_sf = surprise_factor(a_output, h_output)

    h_pred = (h_sf - a_sf) / 2
    a_pred = (a_sf - h_sf) / 2

    return {
        "game_id": game["id"],
        "year": game["year"],
        "round": game["round"],
        "roundname": game.get("roundname", f"Round {game['round']}"),
        "date": game.get("date"),
        "venue": venue,
        "hteam": hteam,
        "ateam": ateam,
        "h_pred": round(h_pred * 100, 1),
        "a_pred": round(a_pred * 100, 1),
        "h_rating": round(ratings.get(hteam, 0), 4),
        "a_rating": round(ratings.get(ateam, 0), 4),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("SAGE Index — computing ratings from 2010...")
    ratings = seed_ratings()
    all_history = []      # all completed games in chronological order
    game_records = []     # per-game SAGE records
    ratings_by_round = [] # snapshot after each round

    for year in range(START_YEAR, CURRENT_YEAR + 1):
        print(f"  Fetching {year}...")
        try:
            games = get_games(year)
        except Exception as e:
            print(f"    Error fetching {year}: {e}")
            continue

        if not games:
            continue

        # Sort by date
        games.sort(key=lambda g: g.get("date") or "")

        # Group by round
        rounds = {}
        for g in games:
            r = g.get("round", 0)
            rounds.setdefault(r, []).append(g)

        for rnd in sorted(rounds.keys()):
            round_games = rounds[rnd]
            round_records = []
            for game in round_games:
                # Skip byes and walkovers
                if not game.get("ateam") or not game.get("hteam"):
                    continue
                if game.get("hscore") is None:
                    continue

                rec = process_completed_game(game, ratings, all_history)
                if rec:
                    game_records.append(rec)
                    round_records.append(rec)

                all_history.append(game)

            # Snapshot ratings after this round
            if round_records:
                snapshot = {
                    "year": year,
                    "round": rnd,
                    "roundname": round_records[0]["roundname"],
                    "ratings": {t: round(v, 4) for t, v in ratings.items()},
                }
                ratings_by_round.append(snapshot)

        time.sleep(0.5)  # be nice to Squiggle

    # Current ratings → ranked
    ranked = sorted(ratings.items(), key=lambda x: x[1], reverse=True)
    power_rankings = [
        {"rank": i + 1, "team": t, "rating": round(v, 4)}
        for i, (t, v) in enumerate(ranked)
    ]

    # Upcoming predictions
    print("  Fetching upcoming games...")
    predictions = []
    try:
        upcoming = get_upcoming_games(CURRENT_YEAR)
        for game in upcoming:
            pred = predict_game(game, ratings, all_history)
            predictions.append(pred)
        predictions.sort(key=lambda g: g.get("date") or "")
    except Exception as e:
        print(f"  Could not fetch upcoming games: {e}")

    # Determine current round
    current_round = None
    if game_records:
        last = game_records[-1]
        current_round = {"year": last["year"], "round": last["round"], "roundname": last["roundname"]}

    output = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "current_round": current_round,
        "power_rankings": power_rankings,
        "predictions": predictions,
        "game_records": game_records[-200:],  # last 200 games for recent history display
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
