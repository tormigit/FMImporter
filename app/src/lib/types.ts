import type { AppSettings } from './builderStore'
export type { AppSettings }

// All 36 FM24+ Attributes (0-20 scale for most, 0-200 for CA/PA)
export type AttributeKey =
  // Ability
  | 'CA'
  | 'PA'
  // Abbreviated/legacy keys from FM exports
  | 'Cmp'
  | 'Dec'
  | 'Det'
  | 'Nat'
  | 'Pac'
  | 'Wor'
  | 'Agg'
  | 'Bra'
  | 'Jum'
  | 'Prof'
  | 'Amb'
  // Match stats (informational, not used in ability calculations)
  | 'AT Apps'
  | 'AT Gls'
  // Mental Attributes
  | 'Determination'
  | 'Anticipation'
  | 'Decisions'
  | 'Teamwork'
  | 'Work Rate'
  | 'Bravery'
  | 'Leadership'
  | 'Composure'
  | 'Concentration'
  // Technical - In Possession
  | 'Technique'
  | 'Passing'
  | 'First Touch'
  | 'Dribbling'
  | 'Heading'
  // Technical - Out of Possession
  | 'Tackling'
  | 'Marking'
  // Technical - Attacking
  | 'Finishing'
  | 'Crossing'
  | 'Long Shots'
  // Tactical - Defending
  | 'Positioning'
  | 'Aggression'
  // Tactical - Attacking
  | 'Off the Ball'
  | 'Vision'
  | 'Flair'
  // Set Pieces
  | 'Free Kick Taking'
  | 'Corners'
  | 'Penalty Taking'
  | 'Long Throws'
  // Physical
  | 'Strength'
  | 'Stamina'
  | 'Pace'
  | 'Acceleration'
  | 'Agility'
  | 'Balance'
  | 'Jumping Reach'
  // Extra
  | 'Natural Fitness'

export type PositionCode = string

export type PositionGroup = 'GK' | 'DEF' | 'WB' | 'DM' | 'MID' | 'AM' | 'FWD'

export type SnapshotSource = 'fm_html'

export interface Snapshot {
  id: string
  importDateIso: string
  source: SnapshotSource
  fileName: string
}

export interface PlayerIndex {
  uid: string
  name: string
  createdAtIso: string
  updatedAtIso: string
  lastSeenSnapshotId: string
}

export interface PlayerSnapshot {
  uid: string
  snapshotId: string
  name: string
  positionsRaw: string
  positions: PositionCode[]
  age: number | null
  personality: string | null
  heightCm: number | null
  nationality: string | null
  homeGrownStatus: string | null
  dueDateRaw: string | null
  dueDateIso: string | null
  attributes: Partial<Record<AttributeKey, number>>
  raw: Record<string, string>
}

// Analytics computed fields
export interface PlayerAnalytics {
  uid: string
  developmentPotential: number // 0-100: headroom as % of PA
  superstarProbability: number // 0-100: probability of reaching CA ≥ 160
  personalityScore: number     // 0-100: derived from personality string + Prof/Amb/Det attributes
  ageFactor: number            // 0-100: how favourable age is for development
  sellScore: number // 0-100: likelihood should sell / let go
  keepScore: number // 0-100: likelihood should keep
  roleGrade: Record<string, number> // Grade for each position (0-100)
  trainingFocus: AttributeKey[] // Top 3 attributes to train
  attributeGrade: number // Overall attribute quality (0-100)
  ageGrade: number // 0-100: where in career (100=peak years 23-33)
}

export interface ExportBundle {
  version: 1
  exportedAtIso: string
  snapshots: Snapshot[]
  playerIndex: PlayerIndex[]
  playerSnapshots: PlayerSnapshot[]
  settings?: AppSettings
}
