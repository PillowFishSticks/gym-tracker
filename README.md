# Sort It Out

A simple hypertrophy and running tracker for your phone. Tap **Start**, do the set, tap **Done** — or **Different** if you got more or less than the target — and the app works out next week's target for you.

## 📲 Install it

**Open this link on your phone: https://pillowfishsticks.github.io/gym-tracker/**

- **Android (Chrome):** open the link → tap **⋮** → **Install app** (or "Add to Home screen"). It installs like a normal app and works offline.
- **iPhone (Safari):** open the link → tap **Share** → **Add to Home Screen**. Always open it from that icon so your data is kept.

The first time you open it, enter **your code**. You stay signed in on that phone. Everything you log is saved to **your own Google Sheet** (one per person) within a few seconds; the phone also keeps a copy so the app is fast and works with no signal, and catches up when you're back online. **Program → Account** shows who's signed in, a link to your sheet, and Sign out.

## How progression works

Each exercise has a rep range (e.g. 10–15) and a weight, and **every set has its own rep target** — later sets are allowed to be lower, because that's normal fatigue (e.g. 12 · 11 · 10).

- The session is judged on **total reps**, not set by set. Target 10 · 10 · 10 and you did 11 · 10 · 9? Same total — that counts, and next time asks for one more rep on your weakest set.
- **Weight goes up** one step (2.5 kg by default — type any amount per exercise) when your first set reaches the top of the range and the others are within a rep of it (e.g. 15 · 15 · 14). Reps then go back to the bottom of the range.
- **Short** of the total once → same target next time. Short twice in a row → the target resets to what you actually did, then builds back up.
- Had to **drop the weight** → next time starts from the lighter weight and builds back up.
- Even your **first set** couldn't reach the bottom of the range → weight comes down one step.

Exercises are remembered across programs, so adding "Leg press" to a new program picks up where you left off.

## Runs

Three types: threshold, long and easy. Enter any two of distance, time and pace and the third is filled in. Each run is compared with your last one of the same type, and progress is judged on pace (faster = better) for every run type.

## This week

**Program → This week** shows Monday–Sunday with what you've done. Do any workout on any day and it ticks off that workout's slot (e.g. Glutes done Thursday shows as ✓ Glutes (Thu) on Friday). Missed ones are marked, and **Today** lists what's left so you can do any of it now. Your plan itself doesn't change — use **Plan** to change it for good.

## Programs

A program is your week (which workout and/or run goes on which day) for a set number of weeks. When it ends, start the next one — copy the old one or start blank — and the old one moves to the **Archive**, where you can compare lifts and runs across months and years.

## Google Sheets sync

The app talks to a small Google Apps Script web app (in `sync/`, deployed from the owner's Google account with `clasp`). The script picks a person's sheet by their code and keeps the app's full data in a hidden **App data** tab, plus readable **Workouts**, **Runs** and **Targets** tabs that are rebuilt on every save. Codes live in `sync/Config.js`, which is not committed. To change code: edit `sync/`, then `clasp push` and `clasp redeploy <deploymentId>`.

## For development

Plain HTML, CSS and JavaScript — no build step. Run any static server in this folder (e.g. `npx http-server`) and open it. Data lives in `localStorage` under `gym-tracker:v1`. When you change app files, bump `VERSION` in `sw.js` so phones pick up the update.

## Fixing mistakes and changing order

- **Busy machine?** During a workout tap the list icon (top right) and pick any exercise to do next. Sets already done are kept.
- **Mistyped a set?** Tap "Done: …" on the set screen, or a finished exercise in the list, to change reps/weight or delete a set. Past sessions can be fixed from **Progress → exercise → Recent sessions**. Runs can be edited by tapping them.
- **Supersets:** tap an exercise in a workout → **Superset with …** to link it to the next one (2 or 3+). During the workout their sets alternate: A, B, A, B…
- **Reorder exercises** by dragging the ⠿ handle in a workout. **Swap two days** by dragging a day's ⠿ onto another day.
