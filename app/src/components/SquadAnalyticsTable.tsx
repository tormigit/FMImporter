import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { PlayerSnapshot, PositionGroup, Snapshot } from '../lib/types'
import {
  computePlayerAnalytics,
  categorizePlayer,
  getAllPositionGroups,
  getPrimaryPositionGroup,
} from '../lib/analytics'
import { db } from '../lib/db'
import {
  MAX_CA_HISTORY,
  loadRecOverrides,
  saveRecOverrides,
  type RecCategory,
} from '../lib/builderStore'

interface Props {
  players: PlayerSnapshot[]
  comparePlayers?: PlayerSnapshot[]
  onPlayerSelect?: (uid: string) => void
  snapshots: Snapshot[]
  currentSnapshotId: string
  caLabels: string[]
  onCaLabelEdit: (index: number, value: string) => void
}

type Category = 'ALL' | 'SELL' | 'DEVELOP' | 'KEEP' | 'MONITOR'
type PosFilter = 'ALL' | PositionGroup
type SortKey = 'name' | 'pos' | 'age' | 'ca' | 'pa' | 'dev' | 'star' | 'keep' | 'sell' | 'rec'

const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, WB: 2, DM: 3, MID: 4, AM: 5, FWD: 6 }
type SortDir = 'asc' | 'desc'

const CATEGORY_BADGE: Record<string, string> = {
  SELL:    'bg-red-100 text-red-700 border border-red-200',
  DEVELOP: 'bg-blue-100 text-blue-700 border border-blue-200',
  KEEP:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  MONITOR: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const CATEGORY_BADGE_OVERRIDE: Record<string, string> = {
  SELL:    'bg-red-100 text-red-700 border border-dashed border-red-400',
  DEVELOP: 'bg-blue-100 text-blue-700 border border-dashed border-blue-400',
  KEEP:    'bg-emerald-100 text-emerald-700 border border-dashed border-emerald-400',
  MONITOR: 'bg-amber-100 text-amber-700 border border-dashed border-amber-400',
}

const POS_BADGE: Record<PositionGroup, string> = {
  GK:  'bg-amber-100 text-amber-800',
  DEF: 'bg-sky-100 text-sky-800',
  WB:  'bg-indigo-100 text-indigo-800',
  DM:  'bg-teal-100 text-teal-800',
  MID: 'bg-emerald-100 text-emerald-800',
  AM:  'bg-violet-100 text-violet-800',
  FWD: 'bg-rose-100 text-rose-800',
}

const POS_GROUPS: PositionGroup[] = ['GK', 'DEF', 'WB', 'DM', 'MID', 'AM', 'FWD']


/** Returns a Tailwind text-color class based on home-grown / due-date status. */
function playerNameColor(homeGrownStatus: string | null | undefined, dueDateRaw: string | null | undefined): string {
  if (dueDateRaw && dueDateRaw !== '-') return 'text-orange-700'
  if (homeGrownStatus === 'Trained at club (0-21)') return 'text-emerald-600'
  if (homeGrownStatus === 'Trained in nation (15-21)') return 'text-orange-400'
  return 'text-slate-900'
}

/** Returns inline background style for a numeric delta cell. */
function deltaBg(current: number | undefined, compare: number | undefined): string | undefined {
  if (current == null || compare == null) return undefined
  if (current > compare) return '#dcfce7' // green-100
  if (current < compare) return '#fee2e2' // red-100
  return undefined
}

function AbilityBar({ value, max = 200, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-sm font-semibold text-slate-800 w-8 shrink-0 text-right">{value}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}

function Delta({ current, compare }: { current: number | undefined; compare: number | undefined }) {
  if (compare == null || current == null) return null
  const diff = current - compare
  if (diff === 0) return <span className="text-xs text-slate-400 ml-1">–</span>
  return (
    <span className={`text-xs font-medium ml-1 ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
      {diff > 0 ? '+' : ''}{diff}
    </span>
  )
}

export function SquadAnalyticsTable({ players, comparePlayers = [], onPlayerSelect, snapshots, currentSnapshotId, caLabels, onCaLabelEdit }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<Category>('ALL')
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL')
  const [nameSearch, setNameSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('ca')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [recOverrides, setRecOverrides] = useState<Record<string, RecCategory>>(() => loadRecOverrides())
  const [editingRecUid, setEditingRecUid] = useState<string | null>(null)

  useEffect(() => {
    if (!editingRecUid) return
    function handleOutside() { setEditingRecUid(null) }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [editingRecUid])

  function setRecOverride(uid: string, cat: RecCategory | null) {
    setRecOverrides((prev) => {
      const next = { ...prev }
      if (cat === null) delete next[uid]
      else next[uid] = cat
      saveRecOverrides(next)
      return next
    })
    setEditingRecUid(null)
  }

  // ── CA history label editing (labels + persistence owned by App) ──────────
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null)
  const [editingLabelValue, setEditingLabelValue] = useState('')

  function commitLabelEdit() {
    if (editingLabelIdx == null) return
    onCaLabelEdit(editingLabelIdx, editingLabelValue.trim() || `CA${editingLabelIdx + 1}`)
    setEditingLabelIdx(null)
  }

  // ── Historical snapshots (older than current) ─────────────────────────────
  const historicalSnapshots = useMemo(() => {
    const idx = snapshots.findIndex((s) => s.id === currentSnapshotId)
    if (idx < 0) return []
    return snapshots.slice(idx + 1, idx + 1 + MAX_CA_HISTORY)
  }, [snapshots, currentSnapshotId])

  const histIdsKey = historicalSnapshots.map((s) => s.id).join(',')

  const historicalPlayerSnapshotsRaw = useLiveQuery(
    async () => {
      const ids = historicalSnapshots.map((s) => s.id)
      if (ids.length === 0) return []
      return db.playerSnapshots.where('snapshotId').anyOf(ids).toArray()
    },
    [histIdsKey],
    [] as PlayerSnapshot[],
  )

  // snapshotId → uid → CA
  const historicalCaMap = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    for (const ps of historicalPlayerSnapshotsRaw) {
      if (!m.has(ps.snapshotId)) m.set(ps.snapshotId, new Map())
      if (ps.attributes.CA != null) m.get(ps.snapshotId)!.set(ps.uid, ps.attributes.CA)
    }
    return m
  }, [historicalPlayerSnapshotsRaw])

  // ── Compare map ───────────────────────────────────────────────────────────
  const compareMap = useMemo(() => {
    const m = new Map<string, PlayerSnapshot>()
    comparePlayers.forEach((p) => m.set(p.uid, p))
    return m
  }, [comparePlayers])

  const hasCompare = compareMap.size > 0

  // ── Analytics rows ────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    return players.map((player) => {
      const analytics = computePlayerAnalytics(player)
      const category = (recOverrides[player.uid] ?? categorizePlayer(analytics)) as Category
      const posGroups = getAllPositionGroups(player.positions)
      const primaryGroup = getPrimaryPositionGroup(player.positions)
      return { player, analytics, category, posGroups, primaryGroup }
    })
  }, [players, recOverrides])

  const categoryStats = useMemo(() => {
    const s = { SELL: 0, DEVELOP: 0, KEEP: 0, MONITOR: 0 }
    rows.forEach(({ category }) => s[category as keyof typeof s]++)
    return s
  }, [rows])

  const filtered = useMemo(() => {
    let result = rows

    if (categoryFilter !== 'ALL') {
      result = result.filter((r) => r.category === categoryFilter)
    }
    if (posFilter !== 'ALL') {
      result = result.filter((r) => r.posGroups.includes(posFilter))
    }
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase()
      result = result.filter((r) => r.player.name.toLowerCase().includes(q))
    }

    const dir = sortDir === 'asc' ? 1 : -1
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.player.name.localeCompare(b.player.name)
        case 'pos': {
          const ap = POS_ORDER[a.primaryGroup ?? ''] ?? 99
          const bp = POS_ORDER[b.primaryGroup ?? ''] ?? 99
          return dir * (ap - bp)
        }
        case 'age':  return dir * ((a.player.age ?? 0) - (b.player.age ?? 0))
        case 'ca':   return dir * ((a.player.attributes.CA ?? 0) - (b.player.attributes.CA ?? 0))
        case 'pa':   return dir * ((a.player.attributes.PA ?? 0) - (b.player.attributes.PA ?? 0))
        case 'dev':  return dir * (a.analytics.developmentPotential - b.analytics.developmentPotential)
        case 'star': return dir * (a.analytics.superstarProbability - b.analytics.superstarProbability)
        case 'keep': return dir * (a.analytics.keepScore - b.analytics.keepScore)
        case 'sell': return dir * (a.analytics.sellScore - b.analytics.sellScore)
        case 'rec': {
          const order = { KEEP: 0, DEVELOP: 1, MONITOR: 2, SELL: 3 }
          return dir * ((order[a.category as keyof typeof order] ?? 2) - (order[b.category as keyof typeof order] ?? 2))
        }
        default: return 0
      }
    })

    return result
  }, [rows, categoryFilter, posFilter, nameSearch, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div>
      {/* ── Summary chips ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-200">
        {(['KEEP', 'DEVELOP', 'MONITOR', 'SELL'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? 'ALL' : cat)}
            className={`flex items-center justify-between px-4 py-3 transition-colors text-left ${
              categoryFilter === cat ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-50'
            }`}
          >
            <span className="text-xs font-semibold uppercase tracking-wide">{cat}</span>
            <span className={`text-xl font-bold ${categoryFilter === cat ? 'text-white' : (
              cat === 'KEEP' ? 'text-emerald-600' :
              cat === 'DEVELOP' ? 'text-blue-600' :
              cat === 'SELL' ? 'text-red-600' : 'text-amber-600'
            )}`}>
              {categoryStats[cat]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search player…"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 w-44"
        />

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setPosFilter('ALL')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              posFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          {POS_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setPosFilter(posFilter === g ? 'ALL' : g)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                posFilter === g ? 'bg-slate-800 text-white' : `${POS_BADGE[g]} hover:opacity-80`
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="ml-auto text-xs text-slate-400">
          {filtered.length} / {players.length} players
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <Th label="Player" col="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} left />
              <Th label="Position" col="pos" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Age" col="age" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap text-left">Personality</th>
              <Th label="CA" col="ca" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />

              {/* CA history columns */}
              {historicalSnapshots.map((_, i) => (
                <th
                  key={i}
                  className="px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap text-center cursor-pointer select-none"
                  title="Double-click to rename"
                  onDoubleClick={() => {
                    setEditingLabelIdx(i)
                    setEditingLabelValue(caLabels[i] ?? `CA${i + 1}`)
                  }}
                >
                  {editingLabelIdx === i ? (
                    <input
                      autoFocus
                      className="w-14 text-center border border-slate-300 rounded px-1 text-xs font-semibold text-slate-700 bg-white"
                      value={editingLabelValue}
                      onChange={(e) => setEditingLabelValue(e.target.value)}
                      onBlur={commitLabelEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitLabelEdit()
                        if (e.key === 'Escape') setEditingLabelIdx(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="border-b border-dashed border-slate-300">{caLabels[i] ?? `CA${i + 1}`}</span>
                  )}
                </th>
              ))}

              <Th label="PA" col="pa" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Dev %" col="dev" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="⭐%" col="star" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Keep" col="keep" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Sell" col="sell" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <Th label="Rec." col="rec" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(({ player, analytics, category, posGroups }) => {
              const cmp = compareMap.get(player.uid)
              const caBg = deltaBg(player.attributes.CA, cmp?.attributes.CA)
              const paBg = deltaBg(player.attributes.PA, cmp?.attributes.PA)
              const ageBg = deltaBg(player.age ?? undefined, cmp?.age ?? undefined)

              return (
                <tr
                  key={player.uid}
                  onClick={() => onPlayerSelect?.(player.uid)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  {/* Name */}
                  <td className={`px-4 py-3 font-semibold whitespace-nowrap ${playerNameColor(player.homeGrownStatus, player.dueDateRaw)}`}>
                    {player.name}
                    {player.nationality && (
                      <span className="ml-2 text-xs font-normal text-slate-400">{player.nationality}</span>
                    )}
                  </td>

                  {/* Positions */}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {posGroups.map((g) => (
                        <span
                          key={g}
                          className={`px-1.5 py-0.5 rounded text-xs font-semibold ${POS_BADGE[g]}`}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Age */}
                  <td
                    className="px-3 py-3 text-center text-slate-600 whitespace-nowrap"
                    style={{ backgroundColor: ageBg }}
                  >
                    {player.age ?? '–'}
                    {cmp && <Delta current={player.age ?? undefined} compare={cmp.age ?? undefined} />}
                  </td>

                  {/* Personality */}
                  <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {player.personality || '–'}
                  </td>

                  {/* CA */}
                  <td className="px-3 py-3 min-w-[110px]" style={{ backgroundColor: caBg }}>
                    <AbilityBar value={player.attributes.CA ?? 0} max={200} color="bg-blue-500" />
                    {hasCompare && <Delta current={player.attributes.CA} compare={cmp?.attributes.CA} />}
                  </td>

                  {/* CA history columns */}
                  {historicalSnapshots.map((snap, i) => {
                    const histCa = historicalCaMap.get(snap.id)?.get(player.uid)
                    return (
                      <td
                        key={i}
                        className="px-3 py-3 text-center text-slate-500 text-sm whitespace-nowrap"
                      >
                        {histCa ?? '–'}
                      </td>
                    )
                  })}

                  {/* PA */}
                  <td className="px-3 py-3 min-w-[110px]" style={{ backgroundColor: paBg }}>
                    <AbilityBar value={player.attributes.PA ?? 0} max={200} color="bg-violet-500" />
                    {hasCompare && <Delta current={player.attributes.PA} compare={cmp?.attributes.PA} />}
                  </td>

                  {/* Dev % */}
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      analytics.developmentPotential >= 30
                        ? 'bg-blue-100 text-blue-700'
                        : analytics.developmentPotential >= 15
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-50 text-slate-400'
                    }`}>
                      {analytics.developmentPotential.toFixed(0)}%
                    </span>
                  </td>

                  {/* Superstar % */}
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      analytics.superstarProbability >= 60
                        ? 'bg-amber-100 text-amber-700'
                        : analytics.superstarProbability >= 30
                        ? 'bg-slate-100 text-slate-600'
                        : analytics.superstarProbability > 0
                        ? 'bg-slate-50 text-slate-400'
                        : 'text-slate-300'
                    }`}>
                      {analytics.superstarProbability > 0 ? `${analytics.superstarProbability}%` : '–'}
                    </span>
                  </td>

                  {/* Keep */}
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-semibold text-emerald-600">
                      {analytics.keepScore.toFixed(0)}
                    </span>
                  </td>

                  {/* Sell */}
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-semibold text-red-500">
                      {analytics.sellScore.toFixed(0)}
                    </span>
                  </td>

                  {/* Recommendation */}
                  <td className="px-4 py-3 text-center relative" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <button
                        onClick={() => setEditingRecUid(editingRecUid === player.uid ? null : player.uid)}
                        className={`px-2 py-0.5 rounded-full text-xs font-bold cursor-pointer ${
                          recOverrides[player.uid] ? CATEGORY_BADGE_OVERRIDE[category] : CATEGORY_BADGE[category]
                        }`}
                      >
                        {category}
                        {recOverrides[player.uid] && <span className="ml-1 opacity-60">✎</span>}
                      </button>
                      {editingRecUid === player.uid && (
                        <div
                          className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-xl p-1.5 flex flex-col gap-1 min-w-[130px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(['KEEP', 'DEVELOP', 'MONITOR', 'SELL'] as const).map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setRecOverride(player.uid, cat)}
                              className={`px-2.5 py-1.5 rounded text-xs font-bold text-left transition-opacity ${CATEGORY_BADGE[cat]} ${category === cat ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
                            >
                              {category === cat && <span className="mr-1">✓</span>}{cat}
                            </button>
                          ))}
                          {recOverrides[player.uid] && (
                            <button
                              onClick={() => setRecOverride(player.uid, null)}
                              className="px-2.5 py-1.5 rounded text-xs font-medium text-slate-500 hover:bg-slate-100 text-left border-t border-slate-100 mt-0.5 pt-1.5"
                            >
                              ↺ Reset to auto
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">
            No players match the current filters.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Small helper component for column headers ─────────────────────────────

function Th({
  label, col, sortKey, sortDir, onSort, left = false, sortable = true,
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (col: SortKey) => void
  left?: boolean
  sortable?: boolean
}) {
  return (
    <th
      onClick={sortable ? () => onSort(col) : undefined}
      className={`px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap select-none ${
        left ? 'text-left' : 'text-center'
      } ${sortable ? 'cursor-pointer hover:text-slate-900' : ''}`}
    >
      {label}
      {sortable && col === sortKey && (
        <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  )
}
