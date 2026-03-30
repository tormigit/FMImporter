import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { db } from '../lib/db'
import { computePlayerAnalytics, categorizePlayer, getAllPositionGroups } from '../lib/analytics'
import type { AttributeKey, PlayerSnapshot, PositionGroup, Snapshot } from '../lib/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const POS_BADGE: Record<PositionGroup, string> = {
  GK:  'bg-amber-100 text-amber-800',
  DEF: 'bg-sky-100 text-sky-800',
  WB:  'bg-indigo-100 text-indigo-800',
  DM:  'bg-teal-100 text-teal-800',
  MID: 'bg-emerald-100 text-emerald-800',
  AM:  'bg-violet-100 text-violet-800',
  FWD: 'bg-rose-100 text-rose-800',
}

const CAT_STYLE = {
  KEEP:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  DEVELOP: 'bg-blue-100 text-blue-700 border border-blue-200',
  MONITOR: 'bg-amber-100 text-amber-700 border border-amber-200',
  SELL:    'bg-red-100 text-red-700 border border-red-200',
}

const ATTRIBUTE_GROUPS: { label: string; keys: AttributeKey[] }[] = [
  { label: 'Ability', keys: ['CA', 'PA'] },
  {
    label: 'Mental',
    keys: ['Anticipation', 'Bravery', 'Composure', 'Concentration', 'Decisions',
           'Determination', 'Flair', 'Leadership', 'Off the Ball', 'Positioning',
           'Teamwork', 'Vision', 'Work Rate', 'Aggression'],
  },
  {
    label: 'Technical',
    keys: ['Corners', 'Crossing', 'Dribbling', 'Finishing', 'First Touch',
           'Free Kick Taking', 'Heading', 'Long Shots', 'Long Throws', 'Marking',
           'Passing', 'Penalty Taking', 'Tackling', 'Technique'],
  },
  {
    label: 'Physical',
    keys: ['Acceleration', 'Agility', 'Balance', 'Jumping Reach', 'Natural Fitness',
           'Pace', 'Stamina', 'Strength'],
  },
]

// Abbreviated keys from FM HTML export
const LEGACY_KEYS: AttributeKey[] = ['Cmp', 'Dec', 'Det', 'Nat', 'Pac', 'Wor']

// All abbreviated attribute columns shown in the snapshot table
const SNAP_ATTR_COLS: AttributeKey[] = [
  'Prof', 'Amb', 'Agg', 'Bra', 'Cmp', 'Dec', 'Det', 'Jum', 'Nat', 'Pac', 'Wor',
]

const CHART_COLORS = [
  '#3b82f6', '#dc2626', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#4b5563', '#a21caf',
]

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function deltaBg(current: number | undefined, previous: number | undefined): string | undefined {
  if (current == null || previous == null) return undefined
  if (current > previous) return '#dcfce7'
  if (current < previous) return '#fee2e2'
  return undefined
}

function AbilityBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500 w-16 text-xs shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
      </div>
      <span className="font-semibold text-slate-800 w-8 text-right">{value}</span>
    </div>
  )
}

/** Compact attribute bars — replaces the radar chart. */
function AttributeBars({ player }: { player: PlayerSnapshot }) {
  const cols = SNAP_ATTR_COLS.filter((k) => player.attributes[k] != null)
  if (cols.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Attributes</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {cols.map((k) => {
          const v = player.attributes[k] ?? 0
          const pct = Math.min((v / 20) * 100, 100)
          const barColor = v >= 15 ? 'bg-emerald-500' : v >= 10 ? 'bg-blue-400' : 'bg-slate-300'
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-8 shrink-0">{k}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-5 text-right">{v}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PlayerDetail({ uid, onBack }: { uid: string; onBack: () => void }) {
  const [selectedKeys, setSelectedKeys] = useState<AttributeKey[]>(['CA', 'PA'])

  const playerIndex = useLiveQuery(
    async () => db.playerIndex.get(uid),
    [uid],
  )

  const snapshotsForPlayer = useLiveQuery(
    async (): Promise<{ snapshot: Snapshot; ps: PlayerSnapshot }[]> => {
      const ps = await db.playerSnapshots.where('uid').equals(uid).toArray()
      if (ps.length === 0) return []
      const ids = [...new Set(ps.map((x) => x.snapshotId))]
      const snaps = await db.snapshots.bulkGet(ids)
      const byId = new Map<string, Snapshot>()
      for (const s of snaps) if (s) byId.set(s.id, s)
      return ps
        .map((p) => {
          const snapshot = byId.get(p.snapshotId)
          return snapshot ? { snapshot, ps: p } : null
        })
        .filter((x): x is { snapshot: Snapshot; ps: PlayerSnapshot } => x != null)
        .sort((a, b) => a.snapshot.importDateIso.localeCompare(b.snapshot.importDateIso))
    },
    [uid],
    [],
  )

  const latest = snapshotsForPlayer[snapshotsForPlayer.length - 1]?.ps
  const analytics = useMemo(() => (latest ? computePlayerAnalytics(latest) : null), [latest])
  const category = analytics ? categorizePlayer(analytics) : null
  const posGroups = useMemo(() => (latest ? getAllPositionGroups(latest.positions) : []), [latest])

  const availableKeys = useMemo(() => {
    if (!latest) return [] as AttributeKey[]
    const allKeys: AttributeKey[] = [
      ...LEGACY_KEYS,
      ...ATTRIBUTE_GROUPS.flatMap((g) => g.keys),
    ]
    return allKeys.filter((k) => latest.attributes[k] != null)
  }, [latest])

  // Which abbreviated cols actually have data across any snapshot
  const snapAttrCols = useMemo(
    () => SNAP_ATTR_COLS.filter((k) => snapshotsForPlayer.some((x) => x.ps.attributes[k] != null)),
    [snapshotsForPlayer],
  )

  const chartData = useMemo(() => {
    const labels = snapshotsForPlayer.map((x) => fmtDate(x.snapshot.importDateIso))
    const datasets = selectedKeys
      .filter((k) => snapshotsForPlayer.some((x) => x.ps.attributes[k] != null))
      .map((k, idx) => ({
        label: k,
        data: snapshotsForPlayer.map((x) => x.ps.attributes[k] ?? null),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length]!,
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]!,
        tension: 0.25,
        spanGaps: true,
      }))
    return { labels, datasets }
  }, [selectedKeys, snapshotsForPlayer])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const } },
    scales: { y: { beginAtZero: false, min: 0 } },
  }), [])

  function toggleKey(k: AttributeKey) {
    setSelectedKeys((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    )
  }

  const name = latest?.name ?? playerIndex?.name ?? 'Player'

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="mt-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              {category && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${CAT_STYLE[category]}`}>
                  {category}
                </span>
              )}
              {posGroups.map((g) => (
                <span key={g} className={`px-2 py-0.5 rounded text-xs font-bold ${POS_BADGE[g]}`}>
                  {g}
                </span>
              ))}
            </div>
            <div className="text-slate-400 text-xs mt-1">UID {uid}</div>
          </div>
        </div>

        {/* Meta grid */}
        {latest && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mt-4">
            {[
              { label: 'Age', value: latest.age ?? '–' },
              { label: 'Height', value: latest.heightCm ? `${latest.heightCm} cm` : '–' },
              { label: 'Nationality', value: latest.nationality ?? '–' },
              { label: 'Positions', value: latest.positionsRaw || '–' },
              { label: 'AT Apps', value: latest.attributes['AT Apps'] ?? '–' },
              { label: 'AT Gls', value: latest.attributes['AT Gls'] ?? '–' },
              { label: 'Home-grown', value: latest.homeGrownStatus ?? '–' },
              { label: 'Due Date', value: latest.dueDateRaw ?? '–' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-0.5">{label}</div>
                <div className="text-sm font-semibold text-slate-800 truncate" title={String(value)}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── All Snapshots ───────────────────────────────────────────── */}
      {snapshotsForPlayer.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">All Snapshots</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Snapshot', 'Age', 'CA', 'PA', ...snapAttrCols].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {snapshotsForPlayer.map((x, i) => {
                  const prev = snapshotsForPlayer[i - 1]?.ps
                  return (
                    <tr key={x.snapshot.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap text-xs">
                        {new Date(x.snapshot.importDateIso).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center">{x.ps.age ?? '–'}</td>
                      <td className="px-3 py-2 font-semibold text-blue-600" style={{ backgroundColor: deltaBg(x.ps.attributes.CA, prev?.attributes.CA) }}>
                        {x.ps.attributes.CA ?? '–'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-violet-600" style={{ backgroundColor: deltaBg(x.ps.attributes.PA, prev?.attributes.PA) }}>
                        {x.ps.attributes.PA ?? '–'}
                      </td>
                      {snapAttrCols.map((k) => (
                        <td key={k} className="px-3 py-2 text-center text-slate-600" style={{ backgroundColor: deltaBg(x.ps.attributes[k], prev?.attributes[k]) }}>
                          {x.ps.attributes[k] ?? '–'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Analytics + Attributes ──────────────────────────────────── */}
      {latest && analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Scores */}
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Player Evaluation</h2>
            <AbilityBar label="CA" value={latest.attributes.CA ?? 0} max={200} color="bg-blue-500" />
            <AbilityBar label="PA" value={latest.attributes.PA ?? 0} max={200} color="bg-violet-500" />
            <div className="pt-2 space-y-2">
              {[
                { label: 'Keep score',   value: analytics.keepScore,           color: 'bg-emerald-500' },
                { label: 'Sell score',   value: analytics.sellScore,           color: 'bg-red-500' },
                { label: 'Dev potential',value: analytics.developmentPotential, color: 'bg-blue-400' },
                { label: 'Attr. grade',  value: analytics.attributeGrade,      color: 'bg-amber-400' },
              ].map(({ label, value, color }) => (
                <AbilityBar key={label} label={label} value={Math.round(value)} max={100} color={color} />
              ))}
            </div>
            {analytics.trainingFocus.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-400 mb-1.5">Training focus</div>
                <div className="flex flex-wrap gap-1.5">
                  {analytics.trainingFocus.map((k) => (
                    <span key={k} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Compact attribute bars */}
          <AttributeBars player={latest} />
        </div>
      )}

      {/* ── Attribute history chart ──────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Attribute History</h2>

        <div className="space-y-3 mb-4">
          {ATTRIBUTE_GROUPS.map((group) => {
            const keysWithData = group.keys.filter((k) => availableKeys.includes(k))
            if (keysWithData.length === 0) return null
            return (
              <div key={group.label}>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  {group.label}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {keysWithData.map((k) => (
                    <button
                      key={k}
                      onClick={() => toggleKey(k)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        selectedKeys.includes(k)
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {LEGACY_KEYS.some((k) => availableKeys.includes(k)) && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                Abbreviated
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LEGACY_KEYS.filter((k) => availableKeys.includes(k)).map((k) => (
                  <button
                    key={k}
                    onClick={() => toggleKey(k)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      selectedKeys.includes(k)
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedKeys.length > 0 && snapshotsForPlayer.length > 0 ? (
          <div style={{ height: 300 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <p className="text-slate-400 text-sm text-center py-8">
            Select attributes above to see history.
          </p>
        )}
      </div>
    </div>
  )
}
