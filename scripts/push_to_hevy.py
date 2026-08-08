"""
Push the 4-day Back/Shoulders/Arms split to Hevy as 4 routines via the Hevy API.

Setup:
    pip install requests
    export HEVY_API_KEY="your-key-here"      # never hardcode it in this file
    python push_split_to_hevy.py

What it does:
    1. Fetches your full exercise template library from Hevy (GET /v1/exercise_templates)
    2. Fuzzy-matches each exercise name in the split below against that library
    3. Prints the matches it found so you can sanity-check them (and lets you fix
       any it got wrong before anything is created)
    4. On confirmation, creates 4 routines in Hevy (POST /v1/routines), one per day

Notes:
    - Requires a Hevy Pro subscription (the API is Pro-only).
    - This has NOT been run against the live Hevy API from this session -- I don't
      have network access to api.hevyapp.com from this sandbox. It's built to the
      documented request/response shape, but if Hevy's schema has shifted, the
      error messages Hevy returns should tell you what field it didn't like.
    - Rest times are stored in Hevy as rest_seconds per set.
    - "Effort" (RIR/failure) isn't a native Hevy field, so it's appended to each
      exercise's notes instead, e.g. "Effort: 1-2 RIR".
"""

import os
import sys
import difflib
import requests

API_BASE = "https://api.hevyapp.com/v1"
API_KEY = os.environ.get("HEVY_API_KEY")

if not API_KEY:
    sys.exit("Set HEVY_API_KEY as an environment variable first.")

HEADERS = {"api-key": API_KEY, "Content-Type": "application/json"}

# ---------------------------------------------------------------------------
# The split. Rest times in seconds. "effort" is stored in the exercise note.
# set_type mirrors Hevy's own convention: "normal" or "failure".
# ---------------------------------------------------------------------------

SPLIT = {
    "Day 1 - Back + Rear Delts + Biceps": [
        ("Bent Over Row (Barbell)", "1-2 RIR", [(3, "6-10", 180)]),
        ("Pull Up (Weighted)", "1-2 RIR", [(3, "6-10", 180)]),
        ("Single Arm Cable Row", "1 RIR", [(3, "10-12", 100)]),
        ("Rope Straight Arm Pulldown", "Failure", [(4, "12-15", 75)]),
        ("Rear Delt Reverse Fly (Machine)", "Failure", [(2, "12-15", 75)]),
        ("Lateral Raise (Dumbbell)", "Failure", [(2, "12-15", 75)]),
        ("Hammer Curl (Dumbbell)", "Failure", [(4, "10-12", 75)]),
    ],
    "Day 2 - Shoulders + Triceps": [
        ("Seated Shoulder Press (Machine)", "1-2 RIR", [(3, "6-10", 180)]),
        ("Lateral Raise (Dumbbell)", "Failure", [(2, "12-15", 75)]),
        ("Rear Delt Reverse Fly (Machine)", "Failure", [(2, "12-15", 75)]),
        ("Front Raise (Cable)", "Failure", [(2, "12-15", 75)]),
        ("Triceps Pushdown", "Failure", [(4, "10-12", 75)]),
        ("Triceps Extension (Cable)", "Failure", [(4, "10-12", 75)]),
    ],
    "Day 3 - Legs": [
        ("Hack Squat (Machine)", "1-2 RIR", [(3, "6-10", 210)]),
        ("Romanian Deadlift (Barbell)", "1-2 RIR", [(3, "8-10", 180)]),
        ("Leg Press (Machine)", "1 RIR", [(4, "10-12", 120)]),
        ("Lying Leg Curl (Machine)", "Failure", [(3, "10-12", 75)]),
        ("Seated Calf Raise", "Failure", [(3, "10-15", 75)]),
    ],
    "Day 4 - Arms Finisher + Chest Maintenance": [
        ("Incline Chest Press (Machine)", "1-2 RIR", [(3, "8-12", 120)]),
        ("Chest Fly (Machine)", "Failure", [(2, "12-15", 75)]),
        ("Bicep Curl (Barbell)", "Failure", [(4, "8-12", 75)]),
        ("Seated Incline Curl (Dumbbell)", "Failure", [(4, "10-12", 75)]),
        ("Triceps Dip (Weighted)", "Failure", [(3, "8-12", 75)]),
        ("Triceps Kickback (Dumbbell)", "Failure", [(2, "12-15", 75)]),
    ],
}


def fetch_all_exercise_templates():
    templates = []
    page = 1
    while True:
        r = requests.get(
            f"{API_BASE}/exercise_templates",
            headers=HEADERS,
            params={"page": page, "pageSize": 100},
        )
        r.raise_for_status()
        data = r.json()
        batch = data.get("exercise_templates", [])
        if not batch:
            break
        templates.extend(batch)
        if page >= data.get("page_count", page):
            break
        page += 1
    return templates


def best_match(name, templates):
    titles = [t["title"] for t in templates]
    matches = difflib.get_close_matches(name, titles, n=1, cutoff=0.5)
    if not matches:
        return None
    matched_title = matches[0]
    return next(t for t in templates if t["title"] == matched_title)


def build_sets(rep_scheme, set_type):
    """rep_scheme like '8-6' or '10-12' -> use the upper number as target reps."""
    reps = int(rep_scheme.split("-")[-1])
    return {
        "type": "normal" if set_type == "normal" else "failure",
        "weight_kg": None,
        "reps": reps,
    }


def main():
    print("Fetching your Hevy exercise template library...")
    templates = fetch_all_exercise_templates()
    print(f"  -> {len(templates)} templates found.\n")

    resolved = {}
    unresolved = []

    for day, exercises in SPLIT.items():
        resolved[day] = []
        for name, effort, sets_spec in exercises:
            match = best_match(name, templates)
            if match is None:
                unresolved.append((day, name))
                print(f"  [NO MATCH] {name}")
                continue
            print(f"  {name!r:45s} -> {match['title']!r} (id: {match['id']})")
            resolved[day].append((match, effort, sets_spec))

    if unresolved:
        print("\nSome exercises had no confident match in your Hevy library:")
        for day, name in unresolved:
            print(f"  - {name} ({day})")
        print("Fix the SPLIT dict above with the exact title Hevy uses, then re-run.")
        answer = input("\nContinue and push routines WITHOUT the unmatched exercises? [y/N] ")
        if answer.strip().lower() != "y":
            sys.exit("Aborted.")

    confirm = input("\nCreate these 4 routines in Hevy now? [y/N] ")
    if confirm.strip().lower() != "y":
        sys.exit("Aborted, nothing created.")

    for day, exs in resolved.items():
        exercises_payload = []
        for template, effort, sets_spec in exs:
            sets_payload = []
            # sets_spec entries share one rest value per exercise in this split,
            # so use the first entry's rest for the exercise-level field.
            exercise_rest = sets_spec[0][2]
            for count, rep_scheme, rest in sets_spec:
                set_type = "normal" if effort != "Failure" else "failure"
                for _ in range(count):
                    sets_payload.append(build_sets(rep_scheme, set_type))
            exercises_payload.append(
                {
                    "exercise_template_id": template["id"],
                    "notes": f"Effort: {effort}",
                    "rest_seconds": exercise_rest,
                    "sets": sets_payload,
                }
            )

        payload = {
            "routine": {
                "title": f"Claude {day}",
                "notes": "",
                "exercises": exercises_payload,
            }
        }

        r = requests.post(f"{API_BASE}/routines", headers=HEADERS, json=payload)
        if r.status_code in (200, 201):
            print(f"Created: Claude {day}")
        else:
            print(f"FAILED: Claude {day} -> {r.status_code} {r.text}")


if __name__ == "__main__":
    main()