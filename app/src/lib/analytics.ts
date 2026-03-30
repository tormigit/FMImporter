import type { PlayerSnapshot, PlayerAnalytics, AttributeKey, PositionGroup } from './types'

// ─── Position helpers ──────────────────────────────────────────────────────

export function getPositionGroup(pos: string): PositionGroup | null {
  const p = pos.trim().toUpperCase()
  if (/^GK/.test(p)) return 'GK'
  if (/^WB/.test(p)) return 'WB'
  if (/^DM/.test(p)) return 'DM'
  if (/^D[\s(]/.test(p) || p === 'D') return 'DEF'
  if (/^AM/.test(p)) return 'AM'
  if (/^M[\s(]/.test(p) || p === 'M') return 'MID'
  if (/^ST/.test(p) || /^F[\s(]/.test(p) || p === 'F') return 'FWD'
  return null
}

export function getAllPositionGroups(positions: string[]): PositionGroup[] {
  const seen = new Set<PositionGroup>()
  for (const p of positions) {
    const g = getPositionGroup(p)
    if (g) seen.add(g)
  }
  return Array.from(seen)
}

export function getPrimaryPositionGroup(positions: string[]): PositionGroup | null {
  for (const p of positions) {
    const g = getPositionGroup(p)
    if (g) return g
  }
  return null
}

// ─── Position-specific attribute weights ──────────────────────────────────

const POSITION_WEIGHTS: Record<string, Record<string, number>> = {
  GK: {
    Positioning: 0.15, Composure: 0.15, Concentration: 0.12, Decisions: 0.12,
    Anticipation: 0.1, 'Jumping Reach': 0.08, Strength: 0.08, Balance: 0.05,
    Agility: 0.05, Pace: 0.05, 'Penalty Taking': 0.04, Bra: 0.03, Teamwork: 0.02,
  },
  DEF: {
    Positioning: 0.15, Marking: 0.12, Tackling: 0.12, Decisions: 0.1, Anticipation: 0.1,
    Concentration: 0.09, Strength: 0.08, Pace: 0.06, Stamina: 0.06,
    'Jumping Reach': 0.05, Balance: 0.04, Agg: 0.04, Bra: 0.03, 'Work Rate': 0.03,
  },
  WB: {
    Pace: 0.12, Stamina: 0.1, Tackling: 0.09, Marking: 0.09, Crossing: 0.09,
    Dribbling: 0.08, Positioning: 0.08, Decisions: 0.07, Anticipation: 0.07,
    'First Touch': 0.05, Technique: 0.04, Acceleration: 0.04, Agg: 0.03, 'Work Rate': 0.03,
  },
  DM: {
    Positioning: 0.11, Tackling: 0.11, Marking: 0.1, Passing: 0.09, Decisions: 0.09,
    Anticipation: 0.08, Stamina: 0.08, Concentration: 0.07, 'First Touch': 0.05,
    Agg: 0.05, Teamwork: 0.04,
  },
  MID: {
    Passing: 0.12, Decisions: 0.1, Stamina: 0.09, Positioning: 0.08, Vision: 0.08,
    'First Touch': 0.08, Technique: 0.07, Anticipation: 0.07, Tackling: 0.06,
    Pace: 0.05, 'Work Rate': 0.04,
  },
  AM: {
    Passing: 0.12, Vision: 0.1, 'Off the Ball': 0.09, Decisions: 0.09, Dribbling: 0.08,
    Composure: 0.08, 'First Touch': 0.08, Technique: 0.07, Finishing: 0.06,
    Acceleration: 0.04, Flair: 0.02,
  },
  FWD: {
    Finishing: 0.15, Composure: 0.09, 'Off the Ball': 0.09, Pace: 0.08, Strength: 0.08,
    Heading: 0.08, 'Jumping Reach': 0.07, Dribbling: 0.06, 'First Touch': 0.06,
    Decisions: 0.06, Acceleration: 0.04, Balance: 0.04, Bra: 0.03,
  },
}

// ─── Personality scoring ───────────────────────────────────────────────────
//
// Research basis:
//   Professionalism is the dominant driver (~2× weight of Amb+Det combined).
//   Prof × 3 + Det × 1 + Amb × 1, normalised to 0–100.
//   Personality string is used as a fallback when numeric Prof/Amb are absent,
//   mapped to approximate midpoint Prof values from the personality tier table.

const PERSONALITY_PROF_MAP: Record<string, number> = {
  // S-tier — Prof 15–20
  'model citizen':       19,
  'model professional':  20,
  'perfectionist':       17,
  'resilient':           18,
  // A-tier — Prof 15–19
  'professional':        18,
  'resolute':            17,
  'driven':              14,
  'determined':          13,
  'born leader':         15,
  'iron willed':         14,
  'spirited':            13,
  'ambitious':           12,
  // B-tier — Prof 10–14
  'balanced':            10,
  'light-hearted':       10,
  'fairly professional': 13,
  'fairly determined':   11,
  'jovial':              10,
  // C-tier — Prof 5–9
  'unambitious':          8,
  'low self-belief':      7,
  'spineless':            6,
  // D/F-tier — Prof 1–4
  'temperamental':        5,
  'casual':               3,
  'slack':                1,
  'unprofessional':       2,
}

const PERSONALITY_AMB_MAP: Record<string, number> = {
  'model citizen': 16, 'model professional': 12, 'perfectionist': 16,
  'resilient': 14, 'professional': 12, 'resolute': 12,
  'driven': 16, 'determined': 8, 'born leader': 14,
  'iron willed': 10, 'spirited': 10, 'ambitious': 18,
  'balanced': 8, 'light-hearted': 8, 'fairly professional': 10,
  'fairly determined': 8, 'jovial': 8,
  'unambitious': 4, 'low self-belief': 6, 'spineless': 6,
  'temperamental': 6, 'casual': 6, 'slack': 4, 'unprofessional': 4,
}

function derivePersonalityScore(player: PlayerSnapshot): number {
  // Use numeric Prof/Amb/Det if available — most accurate
  const profNum = player.attributes.Prof
  const ambNum  = player.attributes.Amb
  const detNum  = player.attributes.Det

  if (profNum != null) {
    const prof = profNum
    const amb  = ambNum  ?? 10
    const det  = detNum  ?? 10
    // Weighted: Prof×3 + Det×1 + Amb×1, max = 20×5 = 100, scaled to 0–100
    return Math.min(100, ((prof * 3 + det + amb) / 100) * 100)
  }

  // Fall back to personality string
  const key = (player.personality ?? '').toLowerCase().trim()
  if (!key) return 50 // unknown → neutral

  const prof = PERSONALITY_PROF_MAP[key] ?? 10
  const amb  = PERSONALITY_AMB_MAP[key]  ?? 10
  const det  = detNum ?? 10
  return Math.min(100, ((prof * 3 + det + amb) / 100) * 100)
}

// ─── Age factor ────────────────────────────────────────────────────────────
//
// Based on FM-Arena research:
//   Ages 15–18: peak development window (multiplier 1.0)
//   Ages 19–21: strong but slowing (0.75)
//   Ages 22–24: moderate, match experience dominates (0.55)
//   Ages 25–27: slowing (0.30)
//   Ages 28+:   minimal (0.10)
// Returned as 0–100.

function deriveAgeFactor(age: number): number {
  if (age <= 18) return 100
  if (age <= 21) return 75
  if (age <= 24) return 55
  if (age <= 27) return 30
  return 10
}

// ─── Superstar probability ─────────────────────────────────────────────────
//
// "Superstar" = reaching CA ≥ 160.
// We model this as:
//   1. PA must support it — if PA < 160, probability is 0 by definition.
//   2. Headroom: how far is current CA below 160?  Closer = harder.
//   3. Age factor: older players have less time to develop.
//   4. Personality: low Prof → PA realisation is poor.
//
// Base probability = (PA_factor × age_factor × personality_factor)
// where each factor is 0–1.

function calculateSuperstarProbability(player: PlayerSnapshot): number {
  const ca  = player.attributes.CA ?? 0
  const pa  = player.attributes.PA ?? 0
  const age = player.age ?? 30

  // Already a superstar
  if (ca >= 160) return 100

  // PA ceiling is hard limit
  if (pa < 160) return 0

  // How much headroom does PA give above the 160 bar?
  // e.g. PA=200 gives 40 pts above bar → more buffer → higher chance of realising
  const paBuffer = Math.min((pa - 160) / 40, 1) // 0–1 (maxes out at PA=200)

  // How far has the player already come? (CA vs 160 target)
  // Higher current CA = closer to target = higher probability
  const caProgress = Math.min(ca / 160, 1) // 0–1

  // Age factor — after 24, increasingly unlikely to develop 30+ CA points
  const ageF = deriveAgeFactor(age) / 100 // 0–1

  // Personality factor (0–1)
  const personalityF = derivePersonalityScore(player) / 100 // 0–1

  // Combine: weighted product
  //   caProgress  weight 0.35 — already close is the strongest signal
  //   paBuffer    weight 0.25 — headroom above the bar
  //   ageF        weight 0.25 — time to develop
  //   personalityF weight 0.15 — will they put in the work
  const raw = caProgress * 0.35 + paBuffer * 0.25 + ageF * 0.25 + personalityF * 0.15

  return Math.round(Math.min(100, raw * 100))
}

// ─── Development potential ─────────────────────────────────────────────────
//
// Combines PA headroom with age and personality — represents how much a
// player can realistically still grow, not just the raw gap.

function calculateDevelopmentPotential(player: PlayerSnapshot): number {
  const ca  = player.attributes.CA ?? 0
  const pa  = player.attributes.PA ?? 0
  if (pa === 0) return 0

  const gap         = Math.max(0, pa - ca)
  const gapPct      = gap / pa                          // 0–1 raw headroom
  const ageF        = deriveAgeFactor(player.age ?? 30) / 100
  const personalityF = derivePersonalityScore(player) / 100

  // Weighted combination — gap is primary, age and personality scale it
  const raw = gapPct * 0.55 + ageF * 0.25 + personalityF * 0.20
  return Math.round(Math.min(100, raw * 100))
}

// ─── Sell score ────────────────────────────────────────────────────────────

function calculateSellScore(player: PlayerSnapshot): number {
  const age = player.age ?? 25
  const ca  = player.attributes.CA ?? 0
  const pa  = player.attributes.PA ?? 0

  if (ca === 0 && pa === 0) return 40

  let score = 30

  // Age — rapid increase beyond 30
  if (age <= 22)      score -= 15
  else if (age <= 26) score -= 8
  else if (age <= 29) score -= 3
  else if (age <= 31) score += 12
  else if (age <= 33) score += 28
  else                score += 50

  // PA ceiling
  const paRatio = pa / 200
  if (paRatio >= 0.85)      score -= 25
  else if (paRatio >= 0.70) score -= 12
  else if (paRatio >= 0.55) score += 5
  else                      score += 22

  // Near PA ceiling with mediocre ceiling
  const devGap = pa > 0 ? (pa - ca) / pa : 0
  if (devGap < 0.08 && paRatio < 0.75) score += 10

  // Lots of room to grow → keep
  if (devGap >= 0.3) score -= 10

  // Poor personality on young player → not worth developing
  const personalityF = derivePersonalityScore(player) / 100
  if (age <= 24 && personalityF < 0.35) score += 12

  return Math.max(0, Math.min(100, score))
}

// ─── Keep score ────────────────────────────────────────────────────────────

function calculateKeepScore(player: PlayerSnapshot): number {
  const age = player.age ?? 25
  const ca  = player.attributes.CA ?? 0
  const pa  = player.attributes.PA ?? 0

  if (ca === 0 && pa === 0) return 20

  let score = 20

  // PA ceiling
  const paRatio = pa / 200
  if (paRatio >= 0.85)      score += 30
  else if (paRatio >= 0.70) score += 20
  else if (paRatio >= 0.55) score += 10

  // Age
  if (age <= 22)      score += 15
  else if (age <= 26) score += 25
  else if (age <= 29) score += 20
  else if (age <= 31) score += 10
  else if (age > 33)  score -= 20

  // Current ability
  if (ca >= 160)      score += 20
  else if (ca >= 130) score += 12
  else if (ca >= 100) score += 5

  // Development upside
  const devGap = pa > 0 ? (pa - ca) / pa : 0
  if (devGap >= 0.3 && age <= 25) score += 15
  else if (devGap >= 0.2 && age <= 27) score += 8

  // Great personality on young player → invest
  const personalityF = derivePersonalityScore(player) / 100
  if (age <= 24 && personalityF >= 0.70) score += 10
  else if (age <= 24 && personalityF < 0.35) score -= 8

  // Superstar candidate → strongly keep
  const superstar = calculateSuperstarProbability(player)
  if (superstar >= 70) score += 15
  else if (superstar >= 40) score += 8

  return Math.max(0, Math.min(100, score))
}

// ─── Attribute grade + age grade (unchanged) ──────────────────────────────

function calculateAttributeGrade(player: PlayerSnapshot): number {
  const EXCLUDED = new Set(['CA', 'PA', 'AT Apps', 'AT Gls'])
  const attrs = Object.entries(player.attributes)
    .filter(([k, v]) => !EXCLUDED.has(k) && v != null)
    .map(([, v]) => v as number)
  if (attrs.length === 0) return 0
  const avg = attrs.reduce((a, b) => a + b, 0) / attrs.length
  return (avg / 20) * 100
}

function calculateAgeGrade(player: PlayerSnapshot): number {
  const age = player.age ?? 25
  if (age < 18) return age * (20 / 18)
  if (age >= 20 && age <= 33) return 100
  if (age > 33) return Math.max(0, 100 - (age - 33) * 15)
  return 80 + (age - 18) * 10
}

function calculateRoleGrades(player: PlayerSnapshot): Record<string, number> {
  const grades: Record<string, number> = {}
  for (const [position, weights] of Object.entries(POSITION_WEIGHTS)) {
    let score = 0
    let weightSum = 0
    for (const [attrKey, weight] of Object.entries(weights)) {
      const value = player.attributes[attrKey as AttributeKey]
      if (value != null) {
        const normalized = Math.min(value, 20)
        score += (normalized / 20) * weight * 100
        weightSum += weight
      }
    }
    grades[position] = weightSum > 0 ? score / weightSum : 0
  }
  return grades
}

function calculateTrainingFocus(player: PlayerSnapshot, positionGroup: PositionGroup | null): AttributeKey[] {
  const weights = POSITION_WEIGHTS[positionGroup ?? 'MID'] ?? POSITION_WEIGHTS['MID']!
  return Object.entries(weights)
    .map(([attr, weight]) => {
      const value = Math.min(player.attributes[attr as AttributeKey] ?? 0, 20)
      return { attr, deficit: (1 - value / 20) * weight }
    })
    .sort((a, b) => b.deficit - a.deficit)
    .slice(0, 3)
    .map((d) => d.attr as AttributeKey)
}

// ─── Public API ────────────────────────────────────────────────────────────

export function computePlayerAnalytics(player: PlayerSnapshot): PlayerAnalytics {
  const primaryGroup = getPrimaryPositionGroup(player.positions)
  return {
    uid: player.uid,
    developmentPotential:  calculateDevelopmentPotential(player),
    superstarProbability:  calculateSuperstarProbability(player),
    personalityScore:      derivePersonalityScore(player),
    ageFactor:             deriveAgeFactor(player.age ?? 30),
    sellScore:             calculateSellScore(player),
    keepScore:             calculateKeepScore(player),
    roleGrade:             calculateRoleGrades(player),
    trainingFocus:         calculateTrainingFocus(player, primaryGroup),
    attributeGrade:        calculateAttributeGrade(player),
    ageGrade:              calculateAgeGrade(player),
  }
}

/**
 * Categorisation logic — development-first for young players.
 *
 * DEVELOP  = young player (≤24) with meaningful headroom AND personality to realise it
 *            OR any player with superstar probability ≥ 40%
 * KEEP     = established quality player worth retaining
 * SELL     = high sell score, near ceiling with poor ceiling, or old age
 * MONITOR  = everything else — watch and reassess
 */
export function categorizePlayer(analytics: PlayerAnalytics): 'SELL' | 'DEVELOP' | 'KEEP' | 'MONITOR' {
  if (analytics.sellScore >= 65) return 'SELL'
  if (analytics.superstarProbability >= 40) return 'DEVELOP'
  if (analytics.developmentPotential >= 35 && analytics.personalityScore >= 45) return 'DEVELOP'
  if (analytics.keepScore >= 60) return 'KEEP'
  return 'MONITOR'
}

// ─── Squad-level summary ───────────────────────────────────────────────────

export interface SquadSummary {
  totalPlayers: number
  avgAge: number
  avgCA: number
  avgPA: number
  byCategory: Record<'SELL' | 'DEVELOP' | 'KEEP' | 'MONITOR', number>
  byPositionGroup: Partial<Record<PositionGroup, { count: number; avgCA: number }>>
  ageBrackets: { u21: number; u26: number; u31: number; over30: number }
  topPerformers: PlayerSnapshot[]
  topDevelopers: PlayerSnapshot[]
  sellCandidates: PlayerSnapshot[]
}

export function computeSquadSummary(
  players: PlayerSnapshot[],
  analyticsMap: Map<string, { analytics: PlayerAnalytics; category: string }>,
): SquadSummary {
  if (players.length === 0) {
    return {
      totalPlayers: 0, avgAge: 0, avgCA: 0, avgPA: 0,
      byCategory: { SELL: 0, DEVELOP: 0, KEEP: 0, MONITOR: 0 },
      byPositionGroup: {},
      ageBrackets: { u21: 0, u26: 0, u31: 0, over30: 0 },
      topPerformers: [], topDevelopers: [], sellCandidates: [],
    }
  }

  const totalPlayers = players.length
  const avgAge = players.reduce((s, p) => s + (p.age ?? 0), 0) / totalPlayers
  const avgCA  = players.reduce((s, p) => s + (p.attributes.CA ?? 0), 0) / totalPlayers
  const avgPA  = players.reduce((s, p) => s + (p.attributes.PA ?? 0), 0) / totalPlayers

  const byCategory: Record<string, number> = { SELL: 0, DEVELOP: 0, KEEP: 0, MONITOR: 0 }
  const posGroupTotals: Partial<Record<PositionGroup, { count: number; totalCA: number }>> = {}

  for (const p of players) {
    const cat = analyticsMap.get(p.uid)?.category ?? 'MONITOR'
    byCategory[cat] = (byCategory[cat] ?? 0) + 1

    const group = getPrimaryPositionGroup(p.positions)
    if (group) {
      if (!posGroupTotals[group]) posGroupTotals[group] = { count: 0, totalCA: 0 }
      posGroupTotals[group]!.count++
      posGroupTotals[group]!.totalCA += p.attributes.CA ?? 0
    }
  }

  const byPositionGroup: Partial<Record<PositionGroup, { count: number; avgCA: number }>> = {}
  for (const [g, { count, totalCA }] of Object.entries(posGroupTotals) as [PositionGroup, { count: number; totalCA: number }][]) {
    byPositionGroup[g] = { count, avgCA: count > 0 ? Math.round(totalCA / count) : 0 }
  }

  const ageBrackets = { u21: 0, u26: 0, u31: 0, over30: 0 }
  for (const p of players) {
    const age = p.age ?? 0
    if (age <= 20)      ageBrackets.u21++
    else if (age <= 25) ageBrackets.u26++
    else if (age <= 30) ageBrackets.u31++
    else                ageBrackets.over30++
  }

  const topPerformers = [...players]
    .sort((a, b) => (b.attributes.CA ?? 0) - (a.attributes.CA ?? 0))
    .slice(0, 5)

  // Top developers: sorted by superstar probability, then development potential
  const topDevelopers = [...players]
    .filter((p) => {
      const a = analyticsMap.get(p.uid)?.analytics
      return a && (a.superstarProbability >= 20 || a.developmentPotential >= 25) && (p.age ?? 99) <= 27
    })
    .sort((a, b) => {
      const aa = analyticsMap.get(a.uid)?.analytics
      const ba = analyticsMap.get(b.uid)?.analytics
      const aScore = (aa?.superstarProbability ?? 0) * 0.6 + (aa?.developmentPotential ?? 0) * 0.4
      const bScore = (ba?.superstarProbability ?? 0) * 0.6 + (ba?.developmentPotential ?? 0) * 0.4
      return bScore - aScore
    })
    .slice(0, 5)

  const sellCandidates = [...players]
    .filter((p) => (analyticsMap.get(p.uid)?.analytics.sellScore ?? 0) >= 50)
    .sort((a, b) => (analyticsMap.get(b.uid)?.analytics.sellScore ?? 0) - (analyticsMap.get(a.uid)?.analytics.sellScore ?? 0))
    .slice(0, 5)

  return {
    totalPlayers, avgAge, avgCA, avgPA,
    byCategory: byCategory as Record<'SELL' | 'DEVELOP' | 'KEEP' | 'MONITOR', number>,
    byPositionGroup, ageBrackets,
    topPerformers, topDevelopers, sellCandidates,
  }
}
