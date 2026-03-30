import type { AttributeKey, PlayerSnapshot, Snapshot } from './types'

const ATTRIBUTE_KEYS: AttributeKey[] = [
  'CA',
  'PA',
  'Agg',
  'Bra',
  'Cmp',
  'Dec',
  'Det',
  'Jum',
  'Nat',
  'Pac',
  'Wor',
  'Prof',
  'Amb',
  'AT Apps',
  'AT Gls',
]

function cleanPlayerName(name: string): string {
  return name.replace(/\s*-\s*Pick Player\s*$/i, '').trim()
}

function parseNullableInt(value: string): number | null {
  const v = value.trim()
  if (!v) return null
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function parseHeightCm(value: string): number | null {
  const m = value.trim().match(/(\d+)\s*cm/i)
  if (!m) return null
  const n = Number.parseInt(m[1] ?? '', 10)
  return Number.isFinite(n) ? n : null
}

function parsePositions(value: string): string[] {
  const results: string[] = []
  for (const chunk of value.split(',')) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const lateralMatch = trimmed.match(/\(([RLCM]+)\)\s*$/)
    const lateral = lateralMatch ? ` (${lateralMatch[1]})` : ''
    const base = trimmed.replace(/\s*\([RLCM]+\)\s*$/, '').trim()
    for (const part of base.split('/')) {
      const p = part.trim()
      if (p) results.push(p + lateral)
    }
  }
  return results
}

function parseDueDateIso(raw: string): string | null {
  const v = raw.trim()
  if (!v || v === '-') return null

  const datePart = v.split('(')[0]?.trim() ?? v
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null

  const dd = Number.parseInt(m[1] ?? '', 10)
  const mm = Number.parseInt(m[2] ?? '', 10)
  const yyyy = Number.parseInt(m[3] ?? '', 10)
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null

  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  return d.toISOString()
}

function toSnapshotIdFromFile(file: File): string {
  const dt = new Date(file.lastModified)
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = dt.getFullYear()
  const mo = pad(dt.getMonth() + 1)
  const da = pad(dt.getDate())
  const h = pad(dt.getHours())
  const mi = pad(dt.getMinutes())
  const s = pad(dt.getSeconds())
  return `${y}${mo}${da}-${h}${mi}${s}`
}

export async function parseFmHtmlExport(file: File): Promise<{ snapshot: Snapshot; playerSnapshots: PlayerSnapshot[] }> {
  const htmlText = await file.text()
  const doc = new DOMParser().parseFromString(htmlText, 'text/html')

  const table = doc.querySelector('table')
  if (!table) throw new Error('No <table> found in HTML export')

  const headerRow = table.querySelector('tr')
  if (!headerRow) throw new Error('No header row found in HTML export table')

  const headers = Array.from(headerRow.querySelectorAll('th')).map((th) => (th.textContent ?? '').trim())
  if (headers.length === 0) throw new Error('No headers found in HTML export table')

  const uidHeaderIndex = headers.findIndex((h) => h.toLowerCase() === 'uid')
  if (uidHeaderIndex < 0) throw new Error('HTML export is missing required UID column')

  const snapshotId = toSnapshotIdFromFile(file)
  const snapshot: Snapshot = {
    id: snapshotId,
    importDateIso: new Date().toISOString(),
    source: 'fm_html',
    fileName: file.name,
  }

  const rows = Array.from(table.querySelectorAll('tr')).slice(1)
  const byUid = new Map<string, PlayerSnapshot>()

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td'))
    if (cells.length === 0) continue

    const raw: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i] ?? `col_${i}`
      const val = (cells[i]?.textContent ?? '').trim()
      raw[key] = val
    }

    const uid = (raw['UID'] ?? raw['Uid'] ?? raw['uid'] ?? '').trim()
    if (!uid) continue

    const name = cleanPlayerName(raw['Player'] ?? '')

    const attributes: Partial<Record<AttributeKey, number>> = {}
    for (const k of ATTRIBUTE_KEYS) {
      const v = raw[k]
      if (!v) continue
      const n = Number.parseInt(v, 10)
      if (Number.isFinite(n)) attributes[k] = n
    }

    const dueDateRaw = (raw['Due Date'] ?? '').trim() || null

    const ps: PlayerSnapshot = {
      uid,
      snapshotId,
      name,
      positionsRaw: (raw['Position'] ?? '').trim(),
      positions: parsePositions(raw['Position'] ?? ''),
      age: parseNullableInt(raw['Age'] ?? ''),
      personality: (raw['Personality'] ?? '').trim() || null,
      heightCm: parseHeightCm(raw['Height'] ?? ''),
      nationality: (raw['NoB'] ?? '').trim() || null,
      homeGrownStatus: (raw['Home-Grown Status'] ?? '').trim() || null,
      dueDateRaw,
      dueDateIso: dueDateRaw ? parseDueDateIso(dueDateRaw) : null,
      attributes,
      raw,
    }

    byUid.set(uid, ps)
  }

  return {
    snapshot,
    playerSnapshots: Array.from(byUid.values()),
  }
}
