# ⚽ FMImporter

> Track your Football Manager squad across seasons — right in your browser.

FMImporter is a lightweight, client-side web app that lets you import Football Manager HTML exports, track player development over time, and plan your squad with a drag-and-drop builder. No server. No login. No data leaves your machine.

---

## ✨ Features

- **Import FM HTML exports** — paste in any squad view you exported from Football Manager
- **Multi-season tracking** — import a new snapshot each season and watch your players develop
- **Attribute change highlighting** — green/red cell colours show exactly what improved or declined between snapshots
- **Analytics engine** — development potential, superstar probability (CA ≥ 160), keep/sell scores, all driven by FM community research on professionalism and age curves
- **Recommendation system** — auto-categorises players as DEVELOP / KEEP / MONITOR / SELL, with manual override support
- **Drag-and-drop Builder** — plan your squad across positional sections, reorder rows, assign players to multiple roles
- **Player detail screen** — full snapshot history table, attribute bars, history chart, and evaluation scores per player
- **Home-grown colour coding** — instantly spot club-trained, nation-trained, and contract-expiring players
- **Snapshot management** — delete mid-season snapshots when you're done with them
- **Export / Import JSON** — back up and restore your full database any time
- **Fully offline** — all data lives in your browser's IndexedDB, nothing is sent anywhere

---

## 🚀 Getting Started (using the app)

1. In Football Manager, go to your squad view and set up columns (at minimum: **UID**, **CA**, **PA**)
2. Use FM's **Print to HTML** feature to export the view
3. Open [FMImporter](https://seljenes.no/fmimporter/app) in your browser
4. Click **Import HTML** and select your file
5. Repeat each season to build up your history

---

## 🛠️ Running locally

```bash
git clone https://github.com/tormigit/FMImporter.git
cd your-repo-name/app
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

### Building for production

```bash
npm run build
```

The output is in `app/dist/`. Upload those files to any static web host.

> **Note:** The `base` in `vite.config.ts` is set to `/fmimporter/app/` for the production deployment at seljenes.no. If you host at a different path, update that value before building.

---

## 🧱 Tech stack

| | |
|---|---|
| Framework | React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Storage | Dexie (IndexedDB wrapper) |
| Tables | TanStack React Table |
| Drag & drop | @dnd-kit |
| Charts | Chart.js + react-chartjs-2 |
| Build | Vite |

---

## 📊 Analytics — how it works

The analytics engine is built on FM community research from passion4fm, sortitoutsi, fmstats, and fm-arena.

**Key principles:**
- **Professionalism is king** — it carries 3× the weight of Ambition or Determination in development scoring
- **Age curve** — peak development at ≤18, tapering sharply after 24, near-zero after 28
- **PA is a ceiling, not a promise** — personality determines how much of it a player realises
- **Superstar threshold** — CA ≥ 160. Superstar probability is hard zero if PA < 160

**Recommendation categories:**

| Category | Logic |
|---|---|
| `DEVELOP` | Superstar probability ≥ 40%, or dev potential ≥ 35 + personality ≥ 45 |
| `KEEP` | Keep score ≥ 60 — established quality worth retaining |
| `SELL` | Sell score ≥ 65 — old age, mediocre ceiling, or poor personality on a young player |
| `MONITOR` | Everything else — watch and reassess |

---

## 🎨 Colour coding reference

**Player names:**
- 🟢 Green — Trained at club (0–21)
- 🟠 Light orange — Trained in nation (15–21)
- 🟤 Dark orange — Has a contract due date
- ⬜ Default — No special status

**Attribute cells (when comparing snapshots):**
- 🟩 Green background — attribute increased
- 🟥 Red background — attribute decreased

---

## 💬 Support & Community

Got a bug? Feature idea? Just want to talk Football Manager tactics?

👉 **[Join the Discord](https://discord.gg/9heUABQH)**

---

## 🌐 Live app

**[seljenes.no/fmimporter](https://seljenes.no/fmimporter)**

---

## 📄 License

MIT — do whatever you want with it. A mention is always appreciated.

---

*Built with ☕ and too many late-night FM sessions by [seljeSoft](https://seljenes.no)*

[![Support my caffeine addiction](https://img.shields.io/badge/☕_Support_my_caffeine_addiction-amber?style=for-the-badge)](https://buy.stripe.com/7sY3cvaRy83Xfc5dZ0bQY0k)
