# Studora

A simple, modern time tracker for studying. Give each task a daily target, start / pause / resume
freely, switch between tasks with one tap, and see day, week and month stats.

- **No backend, no login.** All data stays in your browser (IndexedDB). Works offline.
- **Installable** on a phone's home screen (PWA).
- **Stack:** React + Vite + TypeScript, Tailwind CSS v4, Dexie (IndexedDB), Framer Motion, vite-plugin-pwa.

## Run it locally

Needs Node.js 20+ (LTS is fine).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine, stats and backup tests
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## How it works

Time is stored as **sessions** (`taskId`, `start`, `end`), never as a ticking counter.

- Start / resume opens a session. Pause (or switching to another task) closes it.
- Only one session is ever open, so switching tasks is a single tap and can't double-count.
- Only the start timestamp is saved, so the timer is exact across refreshes, closed tabs and a
  locked phone.
- Every number in Today and Stats is computed from the sessions. A session that crosses midnight
  is split between the two days.
- A task's target repeats every day. Archiving a task hides it but keeps its history; deleting it
  removes the history too.

```
src/
  lib/        db.ts (Dexie schema) · timer.ts (engine) · time.ts · stats.ts · backup.ts · colors.ts
  hooks/      useTimer.ts (live queries, ticking clock) · useTheme.ts
  components/ ActiveTimerCard · TaskCard · TaskSheet · StackedBars · BottomNav · TitleSync
  screens/    Today · Stats · Settings
scripts/make-icons.mjs   regenerates the PWA icons in public/
```

## Deploy for free (GitHub + Vercel)

Vercel's Hobby plan is free and meant for personal, non-commercial projects, which is what this is.
Sign-up may ask for details; check what it asks for on their page.

### 1. Push the code to GitHub

1. On github.com click **New repository**, name it `studora`, leave it empty (no README,
   no .gitignore), and click **Create repository**.
2. In this project folder:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/studora.git
git push -u origin main
```

If Git asks you to sign in, follow the browser prompt, or use a personal access token as the
password.

### 2. Deploy on Vercel

1. Go to vercel.com and choose **Sign Up -> Continue with GitHub**.
2. Click **Add New -> Project**, find `studora`, and click **Import**.
3. Vercel should detect the **Vite** preset. Leave the defaults (build command `npm run build`,
   output directory `dist`).
4. Click **Deploy**. After about a minute you get a URL like `studora-xxxx.vercel.app`.

Every later `git push` to `main` redeploys automatically.

### 3. Install on your iPhone

1. Open your Vercel URL in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open the app from the new home-screen icon from now on.

Notes for iPhone:

- The Safari tab and the home-screen app keep **separate data**. Install first, then add your
  tasks inside the home-screen app. If you already entered data in Safari, use **Settings ->
  Export** there and **Import** in the installed app.
- Safari can delete data for sites you haven't visited in about a week. Apps added to the Home
  Screen are not affected, which is another reason to install it.
- Your data lives only on that device. Use **Settings -> Export** now and then and keep the file
  in iCloud Drive or Google Drive.

### Updating the app later

Edit the code, then:

```bash
git add -A
git commit -m "Describe the change"
git push
```

Vercel redeploys. The installed app updates itself the next time you open it (it may need a
second launch to pick up the new version).

## Known limits (version 1)

- No sync between devices. Moving data means Export, then Import.
- Targets aren't versioned: editing a target changes how past days are judged too.
- Stats read all sessions on screen load, which is fine for years of personal use.

## Ideas for later

Cloud sync and login (Supabase free tier), Pomodoro and break reminders, notes per session,
CSV export, weekly goals, keeping the screen awake while a timer runs.
