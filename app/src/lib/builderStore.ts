export type BuilderSectionId = 'GK' | 'DEF' | 'MID_DM' | 'FWD_AM'
export type BuilderLayout = Record<BuilderSectionId, string[]>

export const MAX_CA_HISTORY = 5

const BUILDER_KEY = 'fm-builder-global'
const CA_LABELS_KEY = 'ca-history-labels'

export interface AppSettings {
  caLabels: string[]
  builderLayout: BuilderLayout
}

export function emptyLayout(): BuilderLayout {
  return { GK: [], DEF: [], MID_DM: [], FWD_AM: [] }
}

export function loadBuilderLayout(): BuilderLayout {
  try {
    const raw = localStorage.getItem(BUILDER_KEY)
    if (!raw) return emptyLayout()
    const stored = JSON.parse(raw) as BuilderLayout
    return {
      GK: stored.GK ?? [],
      DEF: stored.DEF ?? [],
      MID_DM: stored.MID_DM ?? [],
      FWD_AM: stored.FWD_AM ?? [],
    }
  } catch {
    return emptyLayout()
  }
}

export function saveBuilderLayout(layout: BuilderLayout): void {
  try {
    localStorage.setItem(BUILDER_KEY, JSON.stringify(layout))
  } catch {}
}

export function loadCaLabels(): string[] {
  try {
    const raw = localStorage.getItem(CA_LABELS_KEY)
    if (raw) return JSON.parse(raw) as string[]
  } catch {}
  return Array.from({ length: MAX_CA_HISTORY }, (_, i) => `CA${i + 1}`)
}

export function saveCaLabels(labels: string[]): void {
  try {
    localStorage.setItem(CA_LABELS_KEY, JSON.stringify(labels))
  } catch {}
}

// ── Recommendation overrides ──────────────────────────────────────────────────

const REC_OVERRIDES_KEY = 'fm-rec-overrides'

export type RecCategory = 'KEEP' | 'DEVELOP' | 'MONITOR' | 'SELL'

export function loadRecOverrides(): Record<string, RecCategory> {
  try {
    const raw = localStorage.getItem(REC_OVERRIDES_KEY)
    if (raw) return JSON.parse(raw) as Record<string, RecCategory>
  } catch {}
  return {}
}

export function saveRecOverrides(overrides: Record<string, RecCategory>): void {
  try {
    localStorage.setItem(REC_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch {}
}

export function exportSettings(): AppSettings {
  return {
    caLabels: loadCaLabels(),
    builderLayout: loadBuilderLayout(),
  }
}

export function importSettings(settings: Partial<AppSettings>): void {
  if (settings.caLabels) saveCaLabels(settings.caLabels)
  if (settings.builderLayout) saveBuilderLayout(settings.builderLayout)
}
