# Gym Tracker

A simple hypertrophy and running tracker for your phone. Tap **Start**, do the set, tap **Done** — or **Different** if you got more or less than the target — and the app works out next week's target for you.

## 📲 Install it

**Open this link on your phone: https://pillowfishsticks.github.io/gym-tracker/**

- **Android (Chrome):** open the link → tap **⋮** → **Install app** (or "Add to Home screen"). It installs like a normal app and works offline.
- **iPhone (Safari):** open the link → tap **Share** → **Add to Home Screen**. Always open it from that icon so your data is kept.

Your workouts are stored **only on your phone** — nothing is uploaded. Use **Program → Back up data** now and then to save a backup file (also how you move data to another phone).

## How progression works

Each exercise has a rep range (e.g. 10–15) and a weight.

- Hit your target on every set → next time is **+1 rep**.
- Hit the **top of the range** on every set → **weight goes up** one step (2.5 kg by default — type any amount per exercise, e.g. 0.5 or 1) and reps go back to the bottom of the range.
- Short of the target once → same target next time. Missed twice in a row → target drops to the reps you actually got, then builds back up.
- Had to **drop the weight** → next time starts from the lighter weight and builds back up.
- Most sets **below the bottom of the range** → weight comes down one step.

Exercises are remembered across programs, so adding "Leg press" to a new program picks up where you left off.

## Runs

Three types: threshold, long and easy. Enter any two of distance, time and pace and the third is filled in. Each run is compared with your last one of the same type.

## Programs

A program is your week (which workout and/or run goes on which day) for a set number of weeks. When it ends, start the next one — copy the old one or start blank — and the old one moves to the **Archive**, where you can compare lifts and runs across months and years.

## For development

Plain HTML, CSS and JavaScript — no build step. Run any static server in this folder (e.g. `npx http-server`) and open it. Data lives in `localStorage` under `gym-tracker:v1`. When you change app files, bump `VERSION` in `sw.js` so phones pick up the update.

## Fixing mistakes and changing order

- **Busy machine?** During a workout tap the list icon (top right) and pick any exercise to do next. Sets already done are kept.
- **Mistyped a set?** Tap "Done: …" on the set screen, or a finished exercise in the list, to change reps/weight or delete a set. Past sessions can be fixed from **Progress → exercise → Recent sessions**. Runs can be edited by tapping them.
- **Reorder exercises** by dragging the ⠿ handle in a workout. **Swap two days** by dragging a day's ⠿ onto another day.
