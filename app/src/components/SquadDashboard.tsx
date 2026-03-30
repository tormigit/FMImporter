import { useMemo } from 'react'
import type { PlayerSnapshot, PositionGroup } from '../lib/types'
import {
  computePlayerAnalytics,
  categorizePlayer,
  computeSquadSummary,
  getPrimaryPositionGroup,
} from '../lib/analytics'

interface Props {
  players: PlayerSnapshot[]
  onPlayerSelect: (uid: string) => void
}

const POS_ORDER: PositionGroup[] = ['GK', 'DEF', 'WB', 'DM', 'MID', 'AM', 'FWD']

const POS_COLORS: Record<PositionGroup, string> = {
  GK:  'bg-amber-400',
  DEF: 'bg-sky-500',
  WB:  'bg-indigo-500',
  DM:  'bg-teal-500',
  MID: 'bg-emerald-500',
  AM:  'bg-violet-500',
  FWD: 'bg-rose-500',
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

function playerNameColor(homeGrownStatus: string | null | undefined, dueDateRaw: string | null | undefined): string {
  if (dueDateRaw && dueDateRaw !== '-') return 'text-orange-700'
  if (homeGrownStatus === 'Trained at club (0-21)') return 'text-emerald-600'
  if (homeGrownStatus === 'Trained in nation (15-21)') return 'text-orange-400'
  return 'text-slate-800'
}

const CAT_COLORS = {
  KEEP:    { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  DEVELOP: { bar: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50' },
  MONITOR: { bar: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  SELL:    { bar: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50' },
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1 leading-none">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function PlayerRow({
  player,
  badge,
  sub,
  onClick,
}: {
  player: PlayerSnapshot
  badge: React.ReactNode
  sub: string
  onClick: () => void
}) {
  const posGroup = getPrimaryPositionGroup(player.positions)
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
    >
      {posGroup && (
        <span className={`px-1.5 py-0.5 rounded text-xs font-bold shrink-0 ${POS_BADGE[posGroup]}`}>
          {posGroup}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold truncate ${playerNameColor(player.homeGrownStatus, player.dueDateRaw)}`}>{player.name}</div>
        <div className="text-xs text-slate-400">{sub}</div>
      </div>
      {badge}
    </button>
  )
}

export function SquadDashboard({ players, onPlayerSelect }: Props) {
  const analyticsMap = useMemo(() => {
    const m = new Map<string, { analytics: ReturnType<typeof computePlayerAnalytics>; category: string }>()
    players.forEach((p) => {
      const analytics = computePlayerAnalytics(p)
      m.set(p.uid, { analytics, category: categorizePlayer(analytics) })
    })
    return m
  }, [players])

  const summary = useMemo(
    () => computeSquadSummary(players, analyticsMap),
    [players, analyticsMap],
  )

  if (players.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-400 text-sm">
        No players in this snapshot.
      </div>
    )
  }

  const maxCatCount = Math.max(...Object.values(summary.byCategory))
  const maxPosCount = Math.max(...POS_ORDER.map((g) => summary.byPositionGroup[g]?.count ?? 0))

  return (
    <div className="space-y-4">
      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Squad Size" value={String(summary.totalPlayers)} />
        <StatCard label="Average Age" value={summary.avgAge.toFixed(1)} />
        <StatCard
          label="Average CA"
          value={Math.round(summary.avgCA).toString()}
          sub={`${((summary.avgCA / 200) * 100).toFixed(0)}% of max`}
        />
        <StatCard
          label="Average PA"
          value={Math.round(summary.avgPA).toString()}
          sub={`${((summary.avgPA / 200) * 100).toFixed(0)}% of max`}
        />
      </div>

      {/* ── Category + Position ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Category breakdown */}
        <SectionCard title="Squad Breakdown">
          <div className="space-y-3">
            {(['KEEP', 'DEVELOP', 'MONITOR', 'SELL'] as const).map((cat) => {
              const count = summary.byCategory[cat]
              const pct = maxCatCount > 0 ? (count / maxCatCount) * 100 : 0
              const c = CAT_COLORS[cat]
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold uppercase tracking-wide ${c.text}`}>{cat}</span>
                    <span className="text-sm font-semibold text-slate-700">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${c.bar} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Position coverage */}
        <SectionCard title="Position Coverage">
          <div className="space-y-2">
            {POS_ORDER.map((g) => {
              const info = summary.byPositionGroup[g]
              if (!info) return null
              const pct = maxPosCount > 0 ? (info.count / maxPosCount) * 100 : 0
              return (
                <div key={g} className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-bold w-10 text-center ${POS_BADGE[g]}`}>
                    {g}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${POS_COLORS[g]} rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-slate-700 w-5 inline-block">{info.count}</span>
                    <span className="text-xs text-slate-400 ml-1">CA {info.avgCA}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      {/* ── Age distribution ──────────────────────────────────────── */}
      <SectionCard title="Age Distribution">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'U-21', value: summary.ageBrackets.u21, color: 'bg-blue-500' },
            { label: '21–25', value: summary.ageBrackets.u26, color: 'bg-emerald-500' },
            { label: '26–30', value: summary.ageBrackets.u31, color: 'bg-amber-400' },
            { label: '31+', value: summary.ageBrackets.over30, color: 'bg-red-400' },
          ].map(({ label, value, color }) => {
            const pct = summary.totalPlayers > 0 ? (value / summary.totalPlayers) * 100 : 0
            return (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-slate-800">{value}</div>
                <div className="text-xs text-slate-400 mb-2">{label}</div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* ── Player lists ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Top performers */}
        <SectionCard title="Top Performers (CA)">
          <div className="space-y-1">
            {summary.topPerformers.map((p) => (
              <PlayerRow
                key={p.uid}
                player={p}
                sub={`Age ${p.age ?? '?'} · CA ${p.attributes.CA ?? '?'} / PA ${p.attributes.PA ?? '?'}`}
                badge={
                  <span className="text-xs font-bold text-blue-600 shrink-0">
                    CA {p.attributes.CA ?? '?'}
                  </span>
                }
                onClick={() => onPlayerSelect(p.uid)}
              />
            ))}
          </div>
        </SectionCard>

        {/* Top developers */}
        <SectionCard title="Development Pipeline">
          {summary.topDevelopers.length === 0 ? (
            <p className="text-sm text-slate-400">No clear development candidates.</p>
          ) : (
            <div className="space-y-1">
              {summary.topDevelopers.map((p) => {
                const dev = analyticsMap.get(p.uid)?.analytics.developmentPotential ?? 0
                return (
                  <PlayerRow
                    key={p.uid}
                    player={p}
                    sub={`Age ${p.age ?? '?'} · CA ${p.attributes.CA ?? '?'} → PA ${p.attributes.PA ?? '?'}`}
                    badge={
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                        {dev.toFixed(0)}%
                      </span>
                    }
                    onClick={() => onPlayerSelect(p.uid)}
                  />
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Sell candidates */}
        <SectionCard title="Sell Candidates">
          {summary.sellCandidates.length === 0 ? (
            <p className="text-sm text-slate-400">No obvious sell candidates.</p>
          ) : (
            <div className="space-y-1">
              {summary.sellCandidates.map((p) => {
                const sell = analyticsMap.get(p.uid)?.analytics.sellScore ?? 0
                return (
                  <PlayerRow
                    key={p.uid}
                    player={p}
                    sub={`Age ${p.age ?? '?'} · CA ${p.attributes.CA ?? '?'} / PA ${p.attributes.PA ?? '?'}`}
                    badge={
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                        {sell.toFixed(0)}
                      </span>
                    }
                    onClick={() => onPlayerSelect(p.uid)}
                  />
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
