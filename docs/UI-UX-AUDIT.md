# StaffCove — UI/UX Audit

Date: 2026-11-12. Scope: the signed-in app, its shell, both themes, mobile and the PWA.
The public pages (landing, blog, guides, features, legal) use the separate "Daylight"
token set and were redesigned in October 2026; they are out of scope here except where
they share the PWA.

Method: read every layout, page and component; measured class usage across the 98
files of the signed-in app; screenshotted each page as the demo Admin, Manager and
Employee at 1440 px and 390 px, in light and dark.

## 1. What exists (must be preserved exactly)

**Roles:** Super Admin, Admin, HR, Manager, Employee. Navigation is filtered per role
in `src/components/Sidebar.tsx`.

**Routes** (hash based, `#/<id>`, rendered in `src/App.tsx`):

| Route | Page | Roles |
|---|---|---|
| `dashboard` | Admin, Manager or Employee dashboard | all |
| `super-admin/<tab>` | Super Admin console, 15 tabs | Super Admin |
| `profile`, `settings` | Profile + password; system settings | all; Admin/HR |
| `attendance` | Check-in / check-out (selfie, GPS, office Wi-Fi), breaks | all |
| `attendance-logs`, `attendance-audit` | My attendance; audit + corrections | all; Admin/HR/Manager |
| `leave`, `leave/<id>` | Apply, approve, balances, all leaves | all |
| `announcements` | List, create, edit | all |
| `admin-notifications` | Notification centre | Admin/HR |
| `employees` | Directory, add/edit/offboard, CSV/PDF | Admin/HR/Manager |
| `performance-review` | Review cycles per role | all |
| `organization` | Company, structure, teams, shifts, holidays, leave policy, geofences, office Wi-Fi, workflows, notification settings | Admin/HR |
| `reports` | Employee summary, hours worked, detail records, CSV/PDF/email | Admin/HR |
| `upgrade` | Ad-free plans and online payment | Admin |

Also: Login, register organization, verify account, reset password, setup, 404,
subscription banner, suspended page, setup checklist, help buttons, global search,
notification bell, push permission prompt, cookie consent, PWA update banner.

## 2. Design system today

* **Two token sets.** `--app-*` (bg, sidebar, card, elevated, border, text, muted) and
  `--primary*` for the app; `--dl-*` for public pages. The app tokens are barely used:
  `bg-app-*` appears 2 times and `text-app-*` 0 times across 98 files.
* **Pages are styled with raw palette utilities:** 1,537 `text-slate-*`, 626
  `bg-slate-*`, 580 `border-slate-*`, 350 `bg-white`.
* **No shared UI primitives.** There is no Button, Card, Input, Modal, Table or Badge
  component. 452 buttons, 177 inputs, 55 selects, 12 tables and 31 modal overlays are
  each styled by hand.
* **Radii drift:** `rounded-xl` (498), `-2xl` (304), `-3xl` (31) and arbitrary
  `rounded-[2rem]`, `[1.5rem]`, `[32px]`, `[2.5rem]`, `[3rem]`.
* **Type drift:** 515 arbitrary pixel sizes, including `text-[10px]` ×374, `[9px]` ×76,
  `[8px]` ×34 and `[7px]` ×1. Text under 11 px is below comfortable legibility,
  especially on phones. 428 `uppercase tracking-*` micro-labels make screens read as
  shouting; buttons are uppercase and letter-spaced ("PROVISION NEW USER").
* **Page titles** use `text-2xl`, `3xl` and `4xl` inconsistently.
* **Colour noise:** dashboard quick actions use five tinted fills; report stat tiles use
  seven hues; indigo (63 uses) competes with the blue brand.
* **Decorative copy:** a "Cloud Node Alpha" badge in the header carries no meaning.

## 3. Dark mode today

* `ThemeContext` stores `light | dark | system` in `localStorage`
  (`openhr-dark-mode`). `index.html` sets `.dark` before first paint, so there is no
  white flash. Both behaviours are correct and are kept.
* Dark mode for the app works by **~80 `!important` overrides** in `src/index.css` that
  repaint specific slate/white/tint utilities with hard-coded hex values. Anything not
  on that list stays in its light colour. Seen in screenshots:
  * Reports → Departments panel turns into a grey translucent slab (`bg-slate-50/50`
    and other opacity variants are not covered).
  * Report stat tiles: tinted fills darken but labels keep light-mode `-600/-700`
    text, giving low contrast.
  * `bg-slate-900` buttons ("PDF Summary", selected report type) become nearly black
    on a dark navy card and lose their edge.
  * The demo banner's indigo text on its dark tint is hard to read.
* The `.dark .prose` rules use a third, older grey palette (`#1e293b`, `#475569`).
* There are no charts library charts (Recharts is installed but unused); the bar and
  donut visuals are hand-made with the same utilities, so they follow the fixes above.

## 4. Mobile

* Layout is responsive: a slide-in drawer below `lg`, a five-slot bottom bar
  (Home, History, Leave, Account, More) and safe-area padding. No horizontal overflow
  was found at 390 px on any audited page.
* Problems: dense 8–10 px labels; large two-column stat cards truncate
  ("Thanksgivin…"); the push-permission card covers content above the bottom bar;
  some buttons and chips are below the 44 px touch target.

## 5. PWA

Working: valid `manifest.json` linked from `index.html`; `display: standalone`;
`start_url` and `scope` `/`; 192 and 512 icons; wide and narrow screenshots;
`injectManifest` service worker with an update prompt; auth, realtime and edge
functions are network-only.

Problems:

1. **Private data is cached.** Every Supabase REST `GET` (attendance, leaves,
   profiles, salaries) is stored in the `supabase-rest-v1` cache, which survives
   sign-out on a shared device. This must become network-only.
2. **Push notification taps open the 404 page.** Reminder pushes link to
   `/attendance`, a path the app does not route (it uses `#/attendance`).
3. `theme_color` / `background_color` are `#fcfdfe`, an old colour that matches neither
   theme's surface (`#F5F7FB` / `#080F1F`).
4. The maskable icons reuse the "any" artwork, so Android masks can crop the logo.
5. `orientation: portrait-primary` locks tablets and desktop installs to portrait.
6. The status-bar meta tag stays `#F5F7FB` in light mode only; fine.

Not a PWA bug but visible in the UI: the `avatars` storage bucket is private while the
app builds public URLs for it, so uploaded avatars can fail to load. Changing the
bucket is a database change and needs the owner's approval; it is listed, not fixed.

## 6. Plan

1. **Design system.** Semantic tokens for both themes (surface, raised, sunken,
   border, text, muted, subtle, primary, success, warning, danger, info) on `:root` and
   `:root.dark`; one radius scale (8 / 10 / 12 / 16); two-layer shadows; a type floor of
   11 px; sentence-case labels. Rebuild the dark overrides on these tokens, covering
   opacity and hover variants and status text, so every existing utility resolves to a
   token in both themes.
2. **Shell.** Sidebar, header and bottom bar on the tokens; remove the meaningless
   header badge; keep every nav item, role filter and route.
3. **Pages.** Restyle each page in place, keeping its components, data and handlers.
4. **PWA.** Network-only for private REST data; fix push deep links; correct theme and
   background colours; allow any orientation.
5. **Verify.** Type-check, test suite against the 58-failure baseline, and screenshots
   of every page in both themes at desktop and phone width.

No feature, page, card, statistic or navigation item is added or removed.
