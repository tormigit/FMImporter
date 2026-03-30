import { useState, useEffect, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AttributeKey, PlayerSnapshot } from '../lib/types'
import {
  loadBuilderLayout,
  saveBuilderLayout,
  loadRecOverrides,
  saveRecOverrides,
  type BuilderLayout,
  type BuilderSectionId,
  type RecCategory,
} from '../lib/builderStore'
import { getPrimaryPositionGroup, computePlayerAnalytics, categorizePlayer } from '../lib/analytics'

const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, WB: 2, DM: 3, MID: 4, AM: 5, FWD: 6 }

const CAT_BADGE: Record<string, string> = {
  SELL:    'bg-red-100 text-red-700 border border-red-200',
  DEVELOP: 'bg-blue-100 text-blue-700 border border-blue-200',
  KEEP:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  MONITOR: 'bg-amber-100 text-amber-700 border border-amber-200',
}

const CAT_BADGE_OVERRIDE: Record<string, string> = {
  SELL:    'bg-red-100 text-red-700 border border-dashed border-red-400',
  DEVELOP: 'bg-blue-100 text-blue-700 border border-dashed border-blue-400',
  KEEP:    'bg-emerald-100 text-emerald-700 border border-dashed border-emerald-400',
  MONITOR: 'bg-amber-100 text-amber-700 border border-dashed border-amber-400',
}

// Single letter abbreviation for compact display
const CAT_SHORT: Record<string, string> = { KEEP: 'K', DEVELOP: 'D', MONITOR: 'M', SELL: 'S' }

type RecInfo = { category: string; isOverride: boolean }

function playerNameColor(homeGrownStatus: string | null | undefined, dueDateRaw: string | null | undefined): string {
  if (dueDateRaw && dueDateRaw !== '-') return 'text-orange-700'
  if (homeGrownStatus === 'Trained at club (0-21)') return 'text-emerald-600'
  if (homeGrownStatus === 'Trained in nation (15-21)') return 'text-orange-400'
  return ''
}

type PoolSort = 'fn' | 'ln' | 'pos'

// ── Constants ────────────────────────────────────────────────────────────────

const SECTIONS: { id: BuilderSectionId; label: string }[] = [
  { id: 'GK',     label: 'Goalkeepers' },
  { id: 'DEF',    label: 'Defenders' },
  { id: 'MID_DM', label: 'Midfielder / DM' },
  { id: 'FWD_AM', label: 'Strikers / AM' },
]

const ATTR_COLS: { label: string; key: AttributeKey }[] = [
  { label: 'Prof', key: 'Prof' },
  { label: 'Amb', key: 'Amb' },
  { label: 'Agg', key: 'Agg' },
  { label: 'Bra', key: 'Bra' },
  { label: 'Cmp', key: 'Cmp' },
  { label: 'Dec', key: 'Dec' },
  { label: 'Det', key: 'Det' },
  { label: 'Jum', key: 'Jum' },
  { label: 'Nat', key: 'Nat' },
  { label: 'Pac', key: 'Pac' },
  { label: 'Wor', key: 'Wor' },
]

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  players: PlayerSnapshot[]
  comparePlayers?: PlayerSnapshot[]
}

/** Returns a background color hex if the value changed vs the comparison snapshot. */
function deltaBg(current: number | undefined, compare: number | undefined): string | undefined {
  if (current == null || compare == null) return undefined
  if (current > compare) return '#dcfce7' // green-100
  if (current < compare) return '#fee2e2' // red-100
  return undefined
}

// ── Pool card (draggable from sidebar) ───────────────────────────────────────

function PoolCard({ player, sectionCount, recInfo }: { player: PlayerSnapshot; sectionCount: number; recInfo: RecInfo }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool:${player.uid}`,
    data: { uid: player.uid },
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing select-none transition-opacity border ${
        isDragging
          ? 'opacity-30 bg-white border-transparent'
          : sectionCount >= 2
          ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 shadow-sm'
          : sectionCount === 1
          ? 'bg-amber-50 border-amber-200 hover:bg-amber-100 shadow-sm'
          : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold truncate ${playerNameColor(player.homeGrownStatus, player.dueDateRaw) || 'text-slate-800'}`}>{player.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[10px] font-bold px-1 py-0.5 rounded leading-none ${CAT_BADGE[recInfo.category]}`}>
            {CAT_SHORT[recInfo.category]}
          </span>
          <span className="text-xs text-slate-400 font-medium">{player.attributes.CA ?? '–'}</span>
        </div>
      </div>
      <div className="text-xs text-slate-400 truncate mt-0.5">{player.positionsRaw || '–'}</div>
    </div>
  )
}

function PoolCardOverlay({ player }: { player: PlayerSnapshot }) {
  return (
    <div className="px-2 py-1.5 rounded-md bg-white shadow-xl border border-blue-300 select-none w-52 rotate-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold truncate ${playerNameColor(player.homeGrownStatus, player.dueDateRaw) || 'text-slate-800'}`}>{player.name}</span>
        <span className="text-xs text-slate-400 shrink-0 font-medium">
          {player.attributes.CA ?? '–'}
        </span>
      </div>
      <div className="text-xs text-slate-400 truncate mt-0.5">{player.positionsRaw || '–'}</div>
    </div>
  )
}

// ── Sortable row inside a section ─────────────────────────────────────────────

function SortableRow({
  id,
  player,
  comparePlayer,
  onRemove,
  missing,
  recInfo,
  isEditingRec,
  onRecEdit,
  onRecSet,
}: {
  id: string
  player: PlayerSnapshot | null
  comparePlayer?: PlayerSnapshot | null
  onRemove: () => void
  missing?: boolean
  recInfo?: RecInfo
  isEditingRec?: boolean
  onRecEdit?: () => void
  onRecSet?: (cat: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  function attr(key: AttributeKey): string {
    if (!player) return '–'
    const v = player.attributes[key]
    return v != null ? String(v) : '–'
  }

  if (missing || !player) {
    return (
      <tr ref={setNodeRef} style={style} className="opacity-40 bg-slate-50">
        <td className="px-1 py-1.5" style={{ width: 28 }} />
        <td className="px-3 py-1.5 text-sm text-slate-400 italic" colSpan={22}>
          {player?.name ?? id.split(':')[1]} — not in current snapshot
        </td>
        <td className="px-2 py-1.5 text-center" style={{ width: 28 }}>
          <button onClick={onRemove} className="text-slate-300 hover:text-red-400 text-sm">✕</button>
        </td>
      </tr>
    )
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-slate-50 group">
      {/* Drag handle */}
      <td className="px-1 py-1.5 text-center" style={{ width: 28 }}>
        <button
          {...listeners}
          {...attributes}
          className="text-slate-200 group-hover:text-slate-400 cursor-grab active:cursor-grabbing text-base leading-none"
          tabIndex={-1}
        >
          ⠿
        </button>
      </td>
      {/* Name + nationality */}
      <td className={`px-3 py-1.5 font-semibold whitespace-nowrap text-sm overflow-hidden text-ellipsis ${playerNameColor(player.homeGrownStatus, player.dueDateRaw) || 'text-slate-900'}`} style={{ width: 176 }}>
        {player.name}
        {player.nationality && (
          <span className="ml-1.5 text-xs font-normal text-slate-400">{player.nationality}</span>
        )}
      </td>
      {/* Position */}
      <td className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: 144 }}>
        {player.positionsRaw || '–'}
      </td>
      {/* Age */}
      <td className="px-2 py-1.5 text-center text-sm text-slate-700" style={{ width: 40 }}>{player.age ?? '–'}</td>
      {/* Personality */}
      <td className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: 120 }}>{player.personality || '–'}</td>
      {/* Height */}
      <td className="px-2 py-1.5 text-center text-xs text-slate-600 whitespace-nowrap" style={{ width: 64 }}>
        {player.heightCm != null ? `${player.heightCm} cm` : '–'}
      </td>
      {/* CA — separator before */}
      <td className="px-2 py-1.5 text-center text-sm font-bold text-blue-600 border-l border-slate-300" style={{ width: 48, backgroundColor: deltaBg(player.attributes.CA, comparePlayer?.attributes.CA) }}>
        {player.attributes.CA ?? '–'}
      </td>
      {/* PA */}
      <td className="px-2 py-1.5 text-center text-sm font-bold text-violet-600" style={{ width: 48, backgroundColor: deltaBg(player.attributes.PA, comparePlayer?.attributes.PA) }}>
        {player.attributes.PA ?? '–'}
      </td>
      {/* Attribute cols — separator before first */}
      {ATTR_COLS.map(({ key }, i) => (
        <td key={key} className={`px-2 py-1.5 text-center text-sm text-slate-700 ${i === 0 ? 'border-l border-slate-300' : ''}`} style={{ width: 40, backgroundColor: deltaBg(player.attributes[key], comparePlayer?.attributes[key]) }}>
          {attr(key)}
        </td>
      ))}
      {/* Nation — separator before */}
      <td className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap text-center border-l border-slate-300" style={{ width: 44 }}>
        {player.nationality || '–'}
      </td>
      {/* Home-grown status */}
      <td className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: 160 }}>
        {player.homeGrownStatus || '–'}
      </td>
      {/* Due date */}
      <td className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap" style={{ width: 152 }}>
        {player.dueDateRaw || '–'}
      </td>
      {/* Recommendation — separator before */}
      <td className="px-2 py-1.5 text-center relative border-l border-slate-300" style={{ width: 96 }} onClick={(e) => e.stopPropagation()}>
        {recInfo && (
          <div className="relative inline-block">
            <button
              onClick={onRecEdit}
              className={`px-1.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer ${recInfo.isOverride ? CAT_BADGE_OVERRIDE[recInfo.category] : CAT_BADGE[recInfo.category]}`}
            >
              {recInfo.category}
              {recInfo.isOverride && <span className="ml-1 opacity-60">✎</span>}
            </button>
            {isEditingRec && (
              <div
                className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-xl p-1.5 flex flex-col gap-1 min-w-[130px]"
                onClick={(e) => e.stopPropagation()}
              >
                {(['KEEP', 'DEVELOP', 'MONITOR', 'SELL'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onRecSet?.(cat)}
                    className={`px-2.5 py-1.5 rounded text-xs font-bold text-left transition-opacity ${CAT_BADGE[cat]} ${recInfo.category === cat ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
                  >
                    {recInfo.category === cat && <span className="mr-1">✓</span>}{cat}
                  </button>
                ))}
                {recInfo.isOverride && (
                  <button
                    onClick={() => onRecSet?.(null)}
                    className="px-2.5 py-1.5 rounded text-xs font-medium text-slate-500 hover:bg-slate-100 text-left border-t border-slate-100 mt-0.5 pt-1.5"
                  >
                    ↺ Reset to auto
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </td>
      {/* Remove */}
      <td className="px-2 py-1.5 text-center">
        <button
          onClick={onRemove}
          className="text-slate-200 group-hover:text-slate-400 hover:!text-red-400 transition-colors text-sm leading-none"
          title="Remove from section"
        >
          ✕
        </button>
      </td>
    </tr>
  )
}

// ── Section (droppable + sortable container) ─────────────────────────────────

function BuilderSection({
  sectionId,
  label,
  playerUids,
  playerMap,
  compareMap,
  onRemove,
  recCategoryMap,
  editingRecUid,
  onRecEdit,
  onRecSet,
}: {
  sectionId: BuilderSectionId
  label: string
  playerUids: string[]
  playerMap: Map<string, PlayerSnapshot>
  compareMap: Map<string, PlayerSnapshot>
  onRemove: (uid: string) => void
  recCategoryMap: Map<string, RecInfo>
  editingRecUid: string | null
  onRecEdit: (uid: string) => void
  onRecSet: (uid: string, cat: string | null) => void
}) {
  const sortableIds = playerUids.map((uid) => `${sectionId}:${uid}`)
  const { setNodeRef, isOver } = useDroppable({ id: `section:${sectionId}` })

  return (
    <div
      className={`bg-white rounded-xl shadow-sm overflow-hidden mb-4 transition-all w-fit ${
        isOver ? 'ring-2 ring-blue-400 shadow-blue-100' : ''
      }`}
    >
      {/* Section header */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between" style={{ width: 1588 }}>
        <h3 className="font-semibold text-slate-700 text-sm tracking-tight">{label}</h3>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {playerUids.length} players
        </span>
      </div>

      {/* Drop zone wrapper */}
      <div ref={setNodeRef}>
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse table-fixed" style={{ width: 1588 }}>
            <thead>
              <tr className="border-b border-slate-100">
                <th style={{ width: 28 }} />
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap overflow-hidden" style={{ width: 176 }}>Player</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap overflow-hidden" style={{ width: 144 }}>Position</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ width: 40 }}>Age</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap" style={{ width: 120 }}>Personality</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide" style={{ width: 64 }}>Hgt</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-blue-400 uppercase tracking-wide border-l border-slate-300" style={{ width: 48 }}>CA</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-violet-400 uppercase tracking-wide" style={{ width: 48 }}>PA</th>
                {ATTR_COLS.map(({ label: l }, i) => (
                  <th key={l} className={`px-2 py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide ${i === 0 ? 'border-l border-slate-300' : ''}`} style={{ width: 40 }}>{l}</th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide border-l border-slate-300" style={{ width: 44 }}>Nat</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap" style={{ width: 160 }}>HG Status</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap" style={{ width: 152 }}>Due Date</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap border-l border-slate-300" style={{ width: 96 }}>Rec.</th>
                <th style={{ width: 28 }} />
              </tr>
            </thead>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-slate-50">
                {playerUids.map((uid) => {
                  const player = playerMap.get(uid) ?? null
                  return (
                    <SortableRow
                      key={`${sectionId}:${uid}`}
                      id={`${sectionId}:${uid}`}
                      player={player}
                      comparePlayer={compareMap.get(uid) ?? null}
                      missing={!player}
                      onRemove={() => onRemove(uid)}
                      recInfo={recCategoryMap.get(uid)}
                      isEditingRec={editingRecUid === uid}
                      onRecEdit={() => onRecEdit(uid)}
                      onRecSet={(cat) => onRecSet(uid, cat)}
                    />
                  )
                })}
              </tbody>
            </SortableContext>
          </table>
        </div>

        {/* Empty drop hint */}
        {playerUids.length === 0 && (
          <div
            className={`py-7 text-center text-sm transition-colors ${
              isOver ? 'text-blue-400 bg-blue-50' : 'text-slate-300'
            }`}
          >
            {isOver ? '↓ Drop to add' : 'Drag players here from the pool'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main BuilderView ──────────────────────────────────────────────────────────

export function BuilderView({ players, comparePlayers = [] }: Props) {
  const [assignments, setAssignments] = useState<BuilderLayout>(() => loadBuilderLayout())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [poolSearch, setPoolSearch] = useState('')
  const [poolSort, setPoolSort] = useState<PoolSort>('fn')
  const [recOverrides, setRecOverrides] = useState<Record<string, string>>(() => loadRecOverrides())
  const [editingRecUid, setEditingRecUid] = useState<string | null>(null)

  useEffect(() => {
    saveBuilderLayout(assignments)
  }, [assignments])

  useEffect(() => {
    if (!editingRecUid) return
    function handleOutside() { setEditingRecUid(null) }
    document.addEventListener('click', handleOutside)
    return () => document.removeEventListener('click', handleOutside)
  }, [editingRecUid])

  function handleRecEdit(uid: string) {
    setEditingRecUid((prev) => (prev === uid ? null : uid))
  }

  function handleRecSet(uid: string, cat: string | null) {
    setRecOverrides((prev) => {
      const next = { ...prev }
      if (cat === null) delete next[uid]
      else next[uid] = cat
      saveRecOverrides(next as Record<string, RecCategory>)
      return next
    })
    setEditingRecUid(null)
  }

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerSnapshot>()
    players.forEach((p) => m.set(p.uid, p))
    return m
  }, [players])

  const compareMap = useMemo(() => {
    const m = new Map<string, PlayerSnapshot>()
    comparePlayers.forEach((p) => m.set(p.uid, p))
    return m
  }, [comparePlayers])

  const recCategoryMap = useMemo(() => {
    const m = new Map<string, RecInfo>()
    for (const p of players) {
      const analytics = computePlayerAnalytics(p)
      const auto = categorizePlayer(analytics)
      const override = recOverrides[p.uid]
      m.set(p.uid, { category: override ?? auto, isOverride: !!override })
    }
    return m
  }, [players, recOverrides])

  const assignmentCount = useMemo(() => {
    const count = new Map<string, number>()
    for (const { id } of SECTIONS) {
      for (const uid of assignments[id]) {
        count.set(uid, (count.get(uid) ?? 0) + 1)
      }
    }
    return count
  }, [assignments])

  const filteredPool = useMemo(() => {
    const q = poolSearch.toLowerCase()
    const filtered = players.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.positionsRaw.toLowerCase().includes(q),
    )
    return filtered.sort((a, b) => {
      if (poolSort === 'fn') {
        const fa = a.name.split(' ')[0] ?? ''
        const fb = b.name.split(' ')[0] ?? ''
        return fa.localeCompare(fb)
      }
      if (poolSort === 'ln') {
        const la = a.name.split(' ').at(-1) ?? ''
        const lb = b.name.split(' ').at(-1) ?? ''
        return la.localeCompare(lb)
      }
      // pos
      const pa = POS_ORDER[getPrimaryPositionGroup(a.positions) ?? ''] ?? 99
      const pb = POS_ORDER[getPrimaryPositionGroup(b.positions) ?? ''] ?? 99
      return pa - pb
    })
  }, [players, poolSearch, poolSort])

  const activePlayer = useMemo(() => {
    if (!activeId?.startsWith('pool:')) return null
    return playerMap.get(activeId.slice(5)) ?? null
  }, [activeId, playerMap])

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const aId = String(active.id)
    const oId = String(over.id)

    // ── Pool card dropped onto a section ──────────────────────────────────
    if (aId.startsWith('pool:')) {
      const uid = aId.slice(5)

      let target: BuilderSectionId | null = null
      if (oId.startsWith('section:')) {
        target = oId.slice(8) as BuilderSectionId
      } else if (oId.includes(':')) {
        target = oId.split(':')[0] as BuilderSectionId
      }

      if (target && target in assignments) {
        setAssignments((prev) => {
          if (prev[target!].includes(uid)) return prev
          return { ...prev, [target!]: [...prev[target!], uid] }
        })
      }
      return
    }

    // ── Within-section reorder ────────────────────────────────────────────
    if (aId.includes(':') && oId.includes(':')) {
      const [aSec, aUid] = aId.split(':') as [BuilderSectionId, string]
      const [oSec, oUid] = oId.split(':') as [BuilderSectionId, string]

      if (aSec === oSec) {
        setAssignments((prev) => {
          const items = [...prev[aSec]]
          const oldIdx = items.indexOf(aUid)
          const newIdx = items.indexOf(oUid)
          if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return prev
          return { ...prev, [aSec]: arrayMove(items, oldIdx, newIdx) }
        })
      }
    }
  }

  function removeFromSection(sectionId: BuilderSectionId, uid: string) {
    setAssignments((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId].filter((u) => u !== uid),
    }))
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 items-start">
        {/* ── Player pool sidebar ────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 bg-white rounded-xl shadow-sm overflow-hidden sticky top-4">
          <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Player Pool
            </div>
            <input
              type="text"
              placeholder="Search name or position…"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-300 bg-white mb-2"
            />
            <div className="flex gap-1">
              {(['fn', 'ln', 'pos'] as PoolSort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setPoolSort(s)}
                  className={`flex-1 text-xs py-0.5 rounded font-semibold transition-colors ${
                    poolSort === s
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div
            className="overflow-y-auto p-2 space-y-1"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          >
            {filteredPool.length === 0 ? (
              <p className="text-xs text-slate-400 px-1 py-2">No players match.</p>
            ) : (
              filteredPool.map((p) => (
              <PoolCard key={p.uid} player={p} sectionCount={assignmentCount.get(p.uid) ?? 0} recInfo={recCategoryMap.get(p.uid) ?? { category: 'MONITOR', isOverride: false }} />
            ))
            )}
          </div>
        </div>

        {/* ── Four sections ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {SECTIONS.map(({ id, label }) => (
            <BuilderSection
              key={id}
              sectionId={id}
              label={label}
              playerUids={assignments[id]}
              playerMap={playerMap}
              compareMap={compareMap}
              onRemove={(uid) => removeFromSection(id, uid)}
              recCategoryMap={recCategoryMap}
              editingRecUid={editingRecUid}
              onRecEdit={handleRecEdit}
              onRecSet={handleRecSet}
            />
          ))}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activePlayer ? <PoolCardOverlay player={activePlayer} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
