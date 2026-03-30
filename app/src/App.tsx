import React, { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import './App.css'
import { db, deleteSnapshot, exportBundle, importBundle, resetDatabase, saveSnapshotImport } from './lib/db'
import { parseFmHtmlExport } from './lib/fmHtmlImport'
import type { PlayerIndex, PlayerSnapshot, Snapshot } from './lib/types'
import { loadCaLabels, saveCaLabels } from './lib/builderStore'
import { SquadAnalyticsTable } from './components/SquadAnalyticsTable'
import { PlayerDetail } from './components/PlayerDetail'
import { SquadDashboard } from './components/SquadDashboard'
import { BuilderView } from './components/BuilderView'

function downloadJson(filename: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type ActiveTab = 'squad' | 'dashboard' | 'builder' | 'guide' | 'support'

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">{title}</h2>
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  )
}

function ColorSwatch({ bg, text, label, desc }: { bg: string; text: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${bg} ${text}`}>{label}</span>
      <span>{desc}</span>
    </div>
  )
}

function GuideView() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="bg-slate-800 text-white rounded-xl p-6">
        <h1 className="text-xl font-bold mb-1">FMImporter — User Guide</h1>
        <p className="text-slate-300 text-sm">Everything you need to know to get started and get the most out of the app.</p>
      </div>

      <GuideSection title="Getting Started">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="font-semibold text-blue-800">Step 1 — Install the FM view file</p>
          <p>FMImporter requires a specific set of columns in Football Manager. A ready-made view file is available to download from the GitHub repository:</p>
          <a
            href="https://github.com/tormigit/FMImporter/raw/main/demofiles/FMimporterSquadView.fmf"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            ⬇ Download FMimporterSquadView.fmf
          </a>
          <p className="text-xs text-blue-700">Place the file in your FM views folder:</p>
          <ul className="list-disc list-inside text-xs text-blue-700 space-y-0.5 ml-1">
            <li><strong>Windows:</strong> Documents/Sports Interactive/Football Manager 20XX/views/</li>
            <li><strong>Mac:</strong> ~/Documents/Sports Interactive/Football Manager 20XX/views/</li>
          </ul>
          <p className="text-xs text-blue-700">Then in FM open your squad screen, click <strong>Views</strong> (top right) and select <strong>FMimporterSquadView</strong>.</p>
        </div>
        <p><strong>2. Export from FM.</strong> With the view active, right-click the squad list (or use the game menu) and choose <em>Print to HTML</em> to save the file.</p>
        <p><strong>3. Import into FMImporter.</strong> Click <strong>Import HTML</strong> in the top bar and select your exported file. The app reads the file locally — nothing is sent to a server.</p>
        <p><strong>4. Import again each season.</strong> Every time you import a new file, it is stored as a separate <em>snapshot</em>. The app links snapshots by the player's UID, so you can track changes over time.</p>
        <p><strong>5. Your data stays in your browser.</strong> All data is stored in your browser's IndexedDB. Use <strong>Export JSON</strong> to back it up and <strong>Import JSON</strong> to restore it.</p>
        <p className="text-xs text-slate-400">Full documentation and source code: <a href="https://github.com/tormigit/FMImporter" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">github.com/tormigit/FMImporter</a></p>
      </GuideSection>

      <GuideSection title="Views">
        <p><strong>Builder</strong> — Your main working view. Drag players from the pool on the left into positional sections (GK, Defenders, Midfield, Attack). Use this to plan your squad for the coming season.</p>
        <p><strong>Squad</strong> — A full table of all players in the current snapshot with analytics scores, recommendation categories, and attribute change highlighting when a comparison snapshot is selected.</p>
        <p><strong>Dashboard</strong> — A high-level summary of squad composition: age brackets, position group averages, top performers, top developers, and sell candidates.</p>
        <p><strong>Player screen</strong> — Click any player name to open their detail view. Shows meta info, all snapshot history with change colours, analytics scores, compact attribute bars, and a configurable history chart.</p>
      </GuideSection>

      <GuideSection title="Snapshots">
        <p>Each HTML import creates a snapshot tied to the date you imported it. The most recent snapshot is always shown by default.</p>
        <p><strong>Selecting a snapshot:</strong> Click any snapshot in the left sidebar to view that point in time.</p>
        <p><strong>Comparing snapshots:</strong> On the Squad view, tick <em>Compare to snapshot</em> to select an older snapshot. Changed attributes are highlighted green (improved) or red (declined).</p>
        <p><strong>Deleting a snapshot:</strong> Hover over a snapshot in the sidebar — a ✕ button appears. Use this to remove mid-season snapshots once you have imported the full end-of-season file.</p>
        <p><strong>Former players:</strong> Players who appeared in a past snapshot but not the latest one are listed under <em>Former Players</em>. You can still open their detail screen.</p>
      </GuideSection>

      <GuideSection title="Player Name Colour Coding">
        <p>Player names are colour coded by home-grown status and contract due dates across all views.</p>
        <div className="space-y-2 mt-1">
          <ColorSwatch bg="bg-white border border-slate-200" text="text-emerald-600" label="John Smith" desc="Trained at club (0–21) — fully home-grown, counts for both home-grown slots." />
          <ColorSwatch bg="bg-white border border-slate-200" text="text-orange-400" label="John Smith" desc="Trained in nation (15–21) — nationally home-grown, counts for one slot." />
          <ColorSwatch bg="bg-white border border-slate-200" text="text-orange-700" label="John Smith" desc="Has a contract due date — approaching the end of their contract." />
          <ColorSwatch bg="bg-white border border-slate-200" text="text-slate-800" label="John Smith" desc="No special status." />
        </div>
      </GuideSection>

      <GuideSection title="Recommendation (Rec.) Categories">
        <p>Each player is automatically assigned a recommendation based on their analytics. You can override this by clicking the badge in the Squad or Builder view.</p>
        <div className="space-y-2 mt-1">
          <ColorSwatch bg="bg-blue-100" text="text-blue-700" label="DEVELOP" desc="Young player with meaningful PA headroom and the personality to reach it, or anyone with ≥40% superstar probability." />
          <ColorSwatch bg="bg-emerald-100" text="text-emerald-700" label="KEEP" desc="Established quality player worth retaining — high CA, good PA ceiling, or superstar confirmed." />
          <ColorSwatch bg="bg-amber-100" text="text-amber-700" label="MONITOR" desc="Watch and reassess — not ready to sell but not a clear development candidate either." />
          <ColorSwatch bg="bg-red-100" text="text-red-700" label="SELL" desc="High sell score — typically older players near or past their ceiling, or young players with poor personality." />
        </div>
        <p className="mt-2">An overridden badge has a <strong>dashed border</strong> and a ✎ icon. The override is saved in your browser and persists across sessions. Use <em>↺ Reset to auto</em> in the popover to revert.</p>
      </GuideSection>

      <GuideSection title="Analytics Scores">
        <p>All scores are 0–100. They are calculated from the player's CA, PA, age, and personality (Prof/Amb/Det attributes).</p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li><strong>Dev potential</strong> — How much the player can realistically still grow: PA headroom × age factor × personality factor.</li>
          <li><strong>⭐% (Superstar probability)</strong> — Probability of reaching CA ≥ 160. Hard zero if PA &lt; 160. Driven by CA progress toward 160, PA buffer above 160, age, and personality.</li>
          <li><strong>Keep score</strong> — How valuable this player is to retain right now.</li>
          <li><strong>Sell score</strong> — How strong the case is to sell. Rises sharply after age 30 and for players near a mediocre ceiling.</li>
          <li><strong>Attr. grade</strong> — Average of all available numeric attributes (except CA/PA) scaled to 0–100. A rough "how good are their skills right now" measure.</li>
        </ul>
        <p className="mt-2"><strong>Personality tiers</strong> heavily influence development scores. Model Professional and Model Citizen are the strongest; Slack and Casual are the weakest. Prof (Professionalism) carries 3× the weight of Amb or Det.</p>
      </GuideSection>

      <GuideSection title="Builder View">
        <p><strong>Pool sidebar</strong> — All players in the current snapshot. Search by name or position. Sort by first name (FN), last name (LN), or position (POS). Drag any card into a section.</p>
        <p><strong>Sections</strong> — Four positional groups: Goalkeepers, Defenders, Midfielder/DM, Strikers/AM. Players can appear in multiple sections. Within a section, drag rows to reorder.</p>
        <p><strong>Attribute change colours</strong> — When a comparison snapshot is active, attribute cells are highlighted green (improved) or red (declined), the same as the Squad view.</p>
        <p><strong>Pool card colours</strong> — Cards with a green background appear in 2+ sections; amber = 1 section; white = not yet assigned.</p>
        <p>Your section assignments and Rec. overrides are saved automatically in your browser.</p>
      </GuideSection>

      <GuideSection title="Attribute Change Colours (Squad &amp; Builder)">
        <p>When comparing two snapshots, individual attribute cells are highlighted:</p>
        <div className="flex gap-4 mt-1">
          <span className="px-3 py-1 rounded text-xs font-semibold" style={{ backgroundColor: '#dcfce7' }}>Increased</span>
          <span className="px-3 py-1 rounded text-xs font-semibold" style={{ backgroundColor: '#fee2e2' }}>Decreased</span>
          <span className="px-3 py-1 rounded text-xs font-semibold bg-slate-100">Unchanged / no data</span>
        </div>
        <p className="mt-2">In the <strong>Player screen → All Snapshots</strong> table, each row is compared to the one above it (the previous snapshot), so you can see season-by-season progression at a glance.</p>
      </GuideSection>
    </div>
  )
}

function SupportView() {
  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-slate-800 text-white rounded-xl p-6">
        <h1 className="text-xl font-bold mb-1">Support</h1>
        <p className="text-slate-300 text-sm">Get help, report issues, or share feedback with the developer.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>
          FMImporter is developed and maintained by <strong>seljeSoft</strong>. If you run into a bug,
          have a feature request, or just want to share how you use the app, the best place to reach out
          is the Discord community.
        </p>
        <p>
          In the server you can find dedicated channels for bug reports, feature ideas, and general
          discussion. The developer monitors it regularly and aims to respond quickly.
        </p>
        <a
          href="https://discord.gg/9heUABQH"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Join the Discord
        </a>
        <p className="text-slate-400 text-xs pt-2 border-t border-slate-100">
          You can also visit <a href="https://seljenes.no" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">seljenes.no</a> for more projects from seljeSoft.
        </p>
      </div>
    </div>
  )
}

function App() {
  const snapshots = useLiveQuery(
    async (): Promise<Snapshot[]> => db.snapshots.orderBy('importDateIso').reverse().toArray(),
    [],
    [] as Snapshot[],
  )

  const latestSnapshot = useLiveQuery(
    async (): Promise<Snapshot | undefined> => db.snapshots.orderBy('importDateIso').last(),
    [],
    undefined as Snapshot | undefined,
  )

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [selectedPlayerUid, setSelectedPlayerUid] = useState<string | null>(null)
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('builder')
  const [caLabels, setCaLabels] = useState<string[]>(loadCaLabels)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  function updateCaLabel(index: number, value: string) {
    setCaLabels((prev) => {
      const next = [...prev]
      next[index] = value
      saveCaLabels(next)
      return next
    })
  }

  const effectiveSnapshotId = selectedSnapshotId ?? (snapshots[0]?.id ?? null)

  useEffect(() => {
    if (!effectiveSnapshotId) {
      setCompareSnapshotId(null)
      setCompareEnabled(false)
      return
    }
    const idx = snapshots.findIndex((s) => s.id === effectiveSnapshotId)
    const next = idx >= 0 ? (snapshots[idx + 1]?.id ?? null) : null
    setCompareSnapshotId(next)
    setCompareEnabled(Boolean(next))
  }, [effectiveSnapshotId, snapshots])

  const players = useLiveQuery(
    async (): Promise<PlayerSnapshot[]> => {
      if (!effectiveSnapshotId) return []
      return db.playerSnapshots.where('snapshotId').equals(effectiveSnapshotId).toArray()
    },
    [effectiveSnapshotId],
    [] as PlayerSnapshot[],
  )

  const comparePlayers = useLiveQuery(
    async (): Promise<PlayerSnapshot[]> => {
      if (!compareEnabled || !compareSnapshotId) return []
      return db.playerSnapshots.where('snapshotId').equals(compareSnapshotId).toArray()
    },
    [compareEnabled, compareSnapshotId],
    [] as PlayerSnapshot[],
  )

  const formerPlayers = useLiveQuery(
    async (): Promise<PlayerIndex[]> => {
      if (!latestSnapshot) return []
      const all = await db.playerIndex.toArray()
      return all
        .filter((p) => p.lastSeenSnapshotId !== latestSnapshot.id)
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    [latestSnapshot?.id],
    [] as PlayerIndex[],
  )

  function showStatus(text: string, ok = true) {
    setStatus({ text, ok })
    setTimeout(() => setStatus(null), 4000)
  }

  async function onImportHtml(file: File | null) {
    if (!file) return
    showStatus('Importing…', true)
    try {
      const parsed = await parseFmHtmlExport(file)
      await saveSnapshotImport(parsed)
      setSelectedSnapshotId(parsed.snapshot.id)
      setSelectedPlayerUid(null)
      showStatus(`Imported ${parsed.playerSnapshots.length} players from ${file.name}`)
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), false)
    }
  }

  async function onDeleteSnapshot(snapshotId: string, fileName: string) {
    if (!window.confirm(`Delete snapshot "${fileName}"? This cannot be undone.`)) return
    await deleteSnapshot(snapshotId)
    if (selectedSnapshotId === snapshotId) setSelectedSnapshotId(null)
    if (compareSnapshotId === snapshotId) setCompareSnapshotId(null)
    setSelectedPlayerUid(null)
    showStatus(`Deleted snapshot: ${fileName}`)
  }

  async function onResetDatabase() {
    if (!window.confirm('Permanently delete all stored data? This cannot be undone.')) return
    await resetDatabase()
    setSelectedSnapshotId(null)
    setSelectedPlayerUid(null)
    setCompareEnabled(false)
    setCompareSnapshotId(null)
    showStatus('Database reset')
  }

  async function onExport() {
    try {
      const bundle = await exportBundle()
      const ts = bundle.exportedAtIso.replace(/[:.]/g, '-')
      downloadJson(`fm-squad-overview-${ts}.json`, bundle)
      showStatus('Exported JSON')
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), false)
    }
  }

  async function onImportBackup(file: File | null) {
    if (!file) return
    showStatus('Importing backup…', true)
    try {
      const text = await file.text()
      const bundle = JSON.parse(text)
      await importBundle(bundle)
      setSelectedSnapshotId(null)
      setSelectedPlayerUid(null)
      setCaLabels(loadCaLabels())
      showStatus('Backup imported')
    } catch (e) {
      showStatus(e instanceof Error ? e.message : String(e), false)
    }
  }

  const currentSnapshot = snapshots.find((s) => s.id === effectiveSnapshotId)

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white px-5 py-3 flex items-center gap-4 flex-shrink-0 shadow-lg">
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold tracking-tight leading-none">FMImporter</div>
          <div className="text-slate-400 text-xs mt-0.5">Client-side · IndexedDB · UID tracking · <span className="text-slate-500">v0.6.0</span></div>
        </div>

        {status && (
          <div
            className={`text-sm px-3 py-1 rounded-md flex-1 text-center ${
              status.ok ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {status.text}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors select-none">
            Import HTML
            <input
              type="file"
              accept="text/html,.html"
              onChange={(e) => onImportHtml(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <button
            onClick={onExport}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            Export JSON
          </button>
          <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors select-none">
            Import JSON
            <input
              type="file"
              accept="application/json"
              onChange={(e) => onImportBackup(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          <a
            href="https://buy.stripe.com/7sY3cvaRy83Xfc5dZ0bQY0k"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center bg-amber-500 hover:bg-amber-400 text-white px-2 py-1.5 rounded-md text-center transition-colors select-none"
          >
            <span className="text-[10px] font-semibold leading-tight">☕ Buy me</span>
            <span className="text-[10px] font-semibold leading-tight">a coffee</span>
          </a>
          <button
            onClick={onResetDatabase}
            className="bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className={`bg-slate-800 flex-shrink-0 flex flex-col transition-all duration-200 overflow-hidden ${sidebarOpen ? 'w-64' : 'w-8'}`}>
          {/* Toggle button */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="flex items-center justify-center h-8 w-8 flex-shrink-0 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors self-end"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '◂' : '▸'}
          </button>
          <div className={`flex flex-col flex-1 overflow-y-auto ${sidebarOpen ? '' : 'hidden'}`}>
          {/* Snapshots */}
          <div className="p-4 border-b border-slate-700">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Snapshots
            </div>
            {snapshots.length === 0 ? (
              <p className="text-slate-500 text-xs leading-relaxed">
                No snapshots yet. Import an HTML export to get started.
              </p>
            ) : (
              <div className="space-y-1">
                {snapshots.map((s) => (
                  <div key={s.id} className="group relative">
                    <button
                      onClick={() => {
                        setSelectedSnapshotId(s.id)
                        setSelectedPlayerUid(null)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors pr-7 ${
                        effectiveSnapshotId === s.id
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="font-medium truncate">{s.fileName}</div>
                      <div className="text-xs opacity-70 mt-0.5">
                        {new Date(s.importDateIso).toLocaleString()}
                      </div>
                    </button>
                    <button
                      onClick={() => onDeleteSnapshot(s.id, s.fileName)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all text-xs px-1 py-0.5 rounded"
                      title="Delete snapshot"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guide + Support */}
          <div className="px-4 pb-2 space-y-1">
            <button
              onClick={() => { setActiveTab('guide'); setSelectedPlayerUid(null) }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'guide' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              📖 Guide
            </button>
            <button
              onClick={() => { setActiveTab('support'); setSelectedPlayerUid(null) }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'support' ? 'bg-slate-600 text-white' : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              💬 Support
            </button>
          </div>

          {/* Former players */}
          <div className="p-4 flex-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              Former Players
              {formerPlayers.length > 0 && (
                <span className="bg-slate-600 text-slate-300 rounded-full px-1.5 py-0.5 text-xs leading-none">
                  {formerPlayers.length}
                </span>
              )}
            </div>
            {!latestSnapshot ? (
              <p className="text-slate-500 text-xs">Import a snapshot first.</p>
            ) : formerPlayers.length === 0 ? (
              <p className="text-slate-500 text-xs">None yet.</p>
            ) : (
              <div className="space-y-1">
                {formerPlayers.map((p) => (
                  <button
                    key={p.uid}
                    onClick={() => setSelectedPlayerUid(p.uid)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs opacity-60 mt-0.5">UID {p.uid}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          <div className="px-4 py-3 border-t border-slate-700 shrink-0">
            <p className="text-xs text-slate-500">
              FMImporter by{' '}
              <a
                href="https://seljenes.no"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-white transition-colors underline"
              >
                seljeSoft
              </a>
            </p>
          </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-slate-100">
          <div className="p-6">
            {/* Tab bar — always visible */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-1 bg-white rounded-lg p-1 shadow-sm">
                {(['squad', 'dashboard', 'builder'] as ActiveTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSelectedPlayerUid(null) }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      activeTab === tab && !selectedPlayerUid
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                    {tab === 'squad' && players.length > 0 && (
                      <span
                        className={`ml-1.5 text-xs ${
                          activeTab === tab && !selectedPlayerUid ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {players.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

                {currentSnapshot && (
                  <div className="text-sm text-slate-500">
                    {currentSnapshot.fileName} ·{' '}
                    {new Date(currentSnapshot.importDateIso).toLocaleDateString()}
                  </div>
                )}
              </div>

              {activeTab === 'guide' ? (
                <GuideView />
              ) : activeTab === 'support' ? (
                <SupportView />
              ) : selectedPlayerUid ? (
                <PlayerDetail uid={selectedPlayerUid} onBack={() => setSelectedPlayerUid(null)} />
              ) : !effectiveSnapshotId ? (
                /* Empty state */
                <div className="bg-white rounded-xl shadow-sm p-16 text-center">
                  <div className="text-5xl mb-4">⚽</div>
                  <h2 className="text-slate-700 text-xl font-semibold mb-2">No data yet</h2>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">
                    Import an FM HTML export using the button in the top bar to get started.
                  </p>
                </div>
              ) : activeTab === 'squad' ? (
                <>
                  {/* Compare bar */}
                  {snapshots.length > 1 && (
                    <div className="bg-white rounded-xl shadow-sm px-4 py-3 mb-4 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={compareEnabled}
                          onChange={(e) => {
                            const next = e.target.checked
                            setCompareEnabled(next)
                            if (next && !compareSnapshotId) {
                              const first =
                                snapshots.find((s) => s.id !== effectiveSnapshotId)?.id ?? null
                              setCompareSnapshotId(first)
                            }
                          }}
                          className="rounded"
                        />
                        <span className="font-medium">Compare to snapshot</span>
                      </label>
                      {compareEnabled && (
                        <select
                          value={compareSnapshotId ?? ''}
                          onChange={(e) => setCompareSnapshotId(e.target.value || null)}
                          className="text-sm border border-slate-200 rounded-md px-2 py-1 text-slate-700 bg-white"
                        >
                          {snapshots
                            .filter((s) => s.id !== effectiveSnapshotId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.fileName} · {new Date(s.importDateIso).toLocaleString()}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  )}
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <SquadAnalyticsTable
                      players={players}
                      comparePlayers={compareEnabled ? comparePlayers : []}
                      onPlayerSelect={(uid) => setSelectedPlayerUid(uid)}
                      snapshots={snapshots}
                      currentSnapshotId={effectiveSnapshotId ?? ''}
                      caLabels={caLabels}
                      onCaLabelEdit={updateCaLabel}
                    />
                  </div>
                </>
              ) : activeTab === 'builder' ? (
                <BuilderView players={players} comparePlayers={comparePlayers} />
              ) : (
                <SquadDashboard
                  players={players}
                  onPlayerSelect={(uid) => setSelectedPlayerUid(uid)}
                />
              )}
            </div>
        </main>
      </div>
    </div>
  )
}

export default App
