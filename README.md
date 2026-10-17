# Sort It Out

A simple hypertrophy and running tracker for your phone. Tap **Start**, do the set, tap **Done** — or **Different** if you got more or less than the target — and the app works out next week's target for you.

## 📲 Install it

**Open this link on your phone: https://pillowfishsticks.github.io/gym-tracker/**

- **Android (Chrome):** open the link → tap **⋮** → **Install app** (or "Add to Home screen"). It installs like a normal app and works offline.
- **iPhone (Safari):** open the link → tap **Share** → **Add to Home Screen**. Always open it from that icon so your data is kept.

The first time you open it, enter **your code**. You stay signed in on that phone. Everything you log is saved to **your own Google Sheet** (one per person) within a few seconds; the phone also keeps a copy so the app is fast and works with no signal, and catches up when you're back online. **Program → Account** shows who's signed in, a link to your sheet, and Sign out.

## How progression works

Each exercise has a rep range (e.g. 10–15) and a weight, and **every set has its own rep target** — later sets are allowed to be lower, because that's normal fatigue (e.g. 12 · 11 · 10).

**Every set is scored on strength**, so reps and weight are weighed together rather than separately. The score is the Epley estimate of your one-rep max (weight × (1 + reps ÷ 30)), with reps past 15 not adding any more (the estimate gets unreliable that high), unless the exercise's own range goes higher. So 15 × 45 counts as stronger than 10 × 50, and 4 sets of 8 × 45 counts as weaker than 10 × 50.

- The session is judged on the **total strength of your planned sets**, not set by set. Target 10 · 10 · 10 and you did 11 · 10 · 9? Same total — that counts, and next time asks for one more rep on your weakest set.
- **Different weight, same or better strength** (e.g. 15 × 45 when the target was 10 × 50) → counts as progress. Next time stays at the planned weight with reps worked out from what you did (about 11 × 50). Went heavier and was stronger → the target moves up to that weight.
- **Weight goes up** one step (2.5 kg by default — type any amount per exercise) when your first set reaches the top of the range and the others are within a rep of it (e.g. 15 · 15 · 14). The new reps are worked out from your strength at the new weight, less one rep to be safe (never below the bottom of the range).
- **Short** of the target once → same target next time. Short twice in a row → the target resets to what you actually did, then builds back up.
- Had to **drop the weight** and were weaker → next time starts from the lighter weight and builds back up.
- Even your **first set** couldn't reach the bottom of the range → weight comes down until it would.
- **Extra sets** you add on the day are bonus work: they never change the target. The app never suggests adding sets — the number of sets is what you planned.

**During a workout, each set adjusts to the one before.** Get fewer reps than the target and the next set comes down to match; beat it and the next set goes up (never past the top of the range). The plan's own drop-off between sets is kept (e.g. 12 · 11 · 10). Change the weight and the next set follows that weight. Land well under the range (2+ reps below) and the next set drops one weight step; well over it and it goes up one step, with reps worked out from that set's strength. The set bars go green whenever a set is at least as strong as planned, whatever mix of reps and weight. The card says why it changed. Next week's target is still worked out from the whole session, as above.

Want more or fewer sets today? Tap **Sets, swap, skip or superset** and use **Sets today − / +** (never below the sets you've already logged), or **+ One more set of …** straight after an exercise's last set. Dropping a set judges progress on the sets you did; extra sets are bonus work that never changes the target.

**Each workout tracks its own lifts.** Hack squats in Tuesday's workout and in Thursday's are separate: each has its own target, its own "last time" and "same as last week", and progresses on its own. The first time a workout does an exercise it starts from that exercise's latest numbers from any workout. On **Progress → exercise**, the targets are listed per workout and the history can be switched between workouts. (The same workout put on two days shares one set of targets; make two workouts if the days should differ.)

Exercises are remembered across programs, so adding "Leg press" to a new program picks up where you left off.

## Runs

Three types: threshold, long and easy. Enter any two of distance, time and pace and the third is filled in. Each run is compared with your last one of the same type, and progress is judged on pace (faster = better) for every run type.

## This week

**Today → This week** shows Monday–Sunday with what you've done. Do any workout on any day and it ticks off that workout's slot (e.g. Glutes done Thursday shows as ✓ Glutes (Thu) on Friday). Missed ones are marked, and **Today** lists what's left so you can do any of it now. Your plan itself doesn't change — use the **Program** tab to change it for good. On **Program**, tap any day to see its exercises and next targets, then **Change day** if you want to swap it.

## Programs

A program is your week (which workout and/or run goes on which day) for a set number of weeks. When it ends, start the next one — copy the old one or start blank — and the old one moves to the **Archive**, where you can compare lifts and runs across months and years.

## Google Sheets sync

The app talks to a small Google Apps Script web app (in `sync/`, deployed from the owner's Google account with `clasp`). The script picks a person's sheet by their code and keeps the app's full data in a hidden **App data** tab, plus readable **Workouts**, **Runs** and **Targets** tabs that are rebuilt on every save. Codes live in `sync/Config.js`, which is not committed. People can change their own name and code from **Program → Account**; those changes are stored in the script's Script Properties, so Config.js stays as the starting codes. To change code: edit `sync/`, then `clasp push` and `clasp redeploy <deploymentId>`.

## For development

Plain HTML, CSS and JavaScript — no build step. Run any static server in this folder (e.g. `npx http-server`) and open it. Data lives in `localStorage` under `gym-tracker:v1`. When you change app files, bump `VERSION` in `sw.js` so phones pick up the update.

## Fixing mistakes and changing order

- **Busy machine?** During a workout tap the list icon (top right) and pick any exercise to do next. Sets already done are kept.
- **Reorder and superset mid-workout:** tap the list icon (top right) during a workout. Drag ⠿ to change the order (done exercises stay put; the top one becomes the current one). Tap the **Superset** link between two exercises to join them, and again on the next boundary for a tri-set; tap a lime link to split them. Dropping an exercise between two that are supersetted joins it; dragging one away from its superset takes it out. All just for today.
- **Change things just for today:** during a workout tap **Sets, swap, skip or superset** (or any exercise in the list) to swap it for another exercise, skip it (or stop early and keep the sets you did), take it out of a superset or superset it with something else. **+ Add an exercise for today** adds an extra. Your plan stays the same, and a swapped exercise keeps its own targets.
- **Change the plan mid-workout:** the list's **Change the plan for this workout** opens the workout editor. Anything you change there (sets, reps, new exercises, supersets) updates the workout you're doing straight away, keeping your logged sets and today's swaps and skips.
- **Mistyped a set?** Tap "Done: …" on the set screen, or a finished exercise in the list, to change reps/weight or delete a set. This week's finished workouts can be fixed with the **✎ pencil** next to the bin, on today's workout card or on any done day (tap it in **Today → This week**). It opens the whole workout: change any reps/weight, add or delete sets (delete all of an exercise's sets to drop it), then **Save changes**. Fixing the latest session of a workout re-works out that workout's next target from the corrected sets. Older sessions can be fixed from **Progress → exercise → Sessions**. Runs can be edited by tapping them.
- **Supersets:** tap an exercise in a workout → **Superset with …** to link it to the next one (2 or 3+). During the workout their sets alternate: A, B, A, B…
- **Reorder exercises** by dragging the ⠿ handle in a workout. **Swap two days** by dragging a day's ⠿ onto another day.
