# habits · calm habit tracker

Build good habits and avoid bad ones, one day at a time. Same calm, minimal style as `expenses`, with its own emerald identity.

## Features

- **Habits CRUD with categories**: name, Lucide-icon category, type, choosable color (defaults to the category color, never random), optional chained next habit.
- **Two habit types**: `build` (success = doing it, e.g. "Make the bed") and `avoid` (success = not slipping, e.g. "No energy drinks"). Copy, icons and reports differ ("times done" vs "clean days").
- **Counter mode**: optional daily goal (`target_count` + `unit`, e.g. 8 glasses). Stepper, quick +1, complete-goal button.
- **Streaks per habit**: flame + count + best, freeze earned every 2 straight days, today pending, rest days skipped.
- **Chaining**: each habit has one optional `next_habit_id`. Marking a habit auto-opens the next one. Cycles (A→B→A) rejected in UI and DB.
- **Flashcards with swipe**: big card per habit, drag right = done, left = missed (framer-motion). Buttons + `←/→` keyboard + mouse support. Counter adds `↑/↓`.
- **Reports**: 30-day rate (active days only), current/best streak, editable month heatmap (click a day: done → missed → clear), bar/pie toggle, global overview.
- **Auth & settings**: email + Google (Supabase), ES/EN dictionaries, light/dark toggle, danger zone (reset streaks, delete account).
- **PWA**: installable manifest + emerald icons + minimal service worker.

## Stack

Next.js (App Router + TypeScript) + HeroUI v3 + Tailwind v4 + lucide-react + framer-motion + Supabase (Auth + Postgres + RLS) + Server Actions only (no API routes).

## Getting started

1. Copy env and fill in your Supabase project:
   ```bash
   cp .env.example .env.local
   ```
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
2. Run `supabase/schema.sql` in Supabase → SQL Editor (profiles, habit_categories, habits, habit_logs, RLS, anti-cycle trigger, seed categories, `delete_my_account()`).
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

## Routes

| Route | What |
|---|---|
| `/` | Landing (redirects to `/hoy` when signed in) |
| `/hoy` | Today's active habits + flashcard runner |
| `/habitos` | Habits and categories CRUD |
| `/informes` | Per-habit + global reports, editable heatmap |
| `/ajustes` | Profile, language, theme, danger zone |

## Day rules

- Day closes at local midnight. Log dates are `YYYY-MM-DD` strings generated client-side.
- Habits have `days_active` (Mon–Sun ISO). Rest days neither break nor extend streaks.
- Any past day can be corrected from the heatmap. Chaining only runs in the Today flow.
- Missing log on a past active day counts as missed; today without a log is pending.

## Scripts

```bash
npm run dev     # develop
npm run build   # production build
npm run start   # serve build
npm run lint    # eslint
```

## License

See [LICENSE](./LICENSE).
