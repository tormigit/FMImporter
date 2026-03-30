import Dexie, { type Table } from 'dexie'
import type { ExportBundle, PlayerIndex, PlayerSnapshot, Snapshot } from './types'
import { exportSettings, importSettings } from './builderStore'

export class AppDb extends Dexie {
  snapshots!: Table<Snapshot, string>
  playerIndex!: Table<PlayerIndex, string>
  playerSnapshots!: Table<PlayerSnapshot, [string, string]>

  constructor() {
    super('fm-squad-overview')

    this.version(1).stores({
      snapshots: 'id, importDateIso, source, fileName',
      playerIndex: 'uid, updatedAtIso, lastSeenSnapshotId',
      playerSnapshots: '[uid+snapshotId], uid, snapshotId',
    })
  }
}

export const db = new AppDb()

export async function listSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy('importDateIso').reverse().toArray()
}

export async function getLatestSnapshot(): Promise<Snapshot | undefined> {
  return db.snapshots.orderBy('importDateIso').last()
}

export async function saveSnapshotImport(args: {
  snapshot: Snapshot
  playerSnapshots: PlayerSnapshot[]
}): Promise<void> {
  const nowIso = new Date().toISOString()

  await db.transaction('rw', db.snapshots, db.playerIndex, db.playerSnapshots, async () => {
    await db.snapshots.put(args.snapshot)

    await db.playerSnapshots.where('snapshotId').equals(args.snapshot.id).delete()

    const seenUids = new Set<string>()
    for (const ps of args.playerSnapshots) {
      seenUids.add(ps.uid)
      const existing = await db.playerIndex.get(ps.uid)

      const next: PlayerIndex = {
        uid: ps.uid,
        name: ps.name,
        createdAtIso: existing?.createdAtIso ?? nowIso,
        updatedAtIso: nowIso,
        lastSeenSnapshotId: args.snapshot.id,
      }
      await db.playerIndex.put(next)
    }

    await db.playerSnapshots.bulkPut(args.playerSnapshots)
  })
}

export async function exportBundle(): Promise<ExportBundle> {
  const [snapshots, playerIndex, playerSnapshots] = await Promise.all([
    db.snapshots.toArray(),
    db.playerIndex.toArray(),
    db.playerSnapshots.toArray(),
  ])

  return {
    version: 1,
    exportedAtIso: new Date().toISOString(),
    snapshots,
    playerIndex,
    playerSnapshots,
    settings: exportSettings(),
  }
}

export async function importBundle(bundle: ExportBundle): Promise<void> {
  if (bundle.version !== 1) {
    throw new Error(`Unsupported bundle version: ${bundle.version}`)
  }

  await db.transaction('rw', db.snapshots, db.playerIndex, db.playerSnapshots, async () => {
    await Promise.all([db.snapshots.clear(), db.playerIndex.clear(), db.playerSnapshots.clear()])
    await db.snapshots.bulkPut(bundle.snapshots)
    await db.playerIndex.bulkPut(bundle.playerIndex)
    await db.playerSnapshots.bulkPut(bundle.playerSnapshots)
  })
  if (bundle.settings) importSettings(bundle.settings)
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  await db.transaction('rw', db.snapshots, db.playerIndex, db.playerSnapshots, async () => {
    // Delete snapshot and its player data
    await db.snapshots.delete(snapshotId)
    await db.playerSnapshots.where('snapshotId').equals(snapshotId).delete()

    // Rebuild lastSeenSnapshotId for affected players
    const affectedPlayers = await db.playerIndex
      .where('lastSeenSnapshotId').equals(snapshotId).toArray()

    for (const pi of affectedPlayers) {
      // Find their most recent remaining snapshot
      const remaining = await db.playerSnapshots
        .where('uid').equals(pi.uid).toArray()
      if (remaining.length === 0) {
        await db.playerIndex.delete(pi.uid)
      } else {
        // Get the dates for remaining snapshots to find the most recent
        const snapIds = [...new Set(remaining.map((r) => r.snapshotId))]
        const snaps = (await db.snapshots.bulkGet(snapIds)).filter(Boolean)
        snaps.sort((a, b) => b!.importDateIso.localeCompare(a!.importDateIso))
        const latestId = snaps[0]!.id
        await db.playerIndex.update(pi.uid, { lastSeenSnapshotId: latestId })
      }
    }
  })
}

export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.snapshots, db.playerIndex, db.playerSnapshots, async () => {
    await Promise.all([db.snapshots.clear(), db.playerIndex.clear(), db.playerSnapshots.clear()])
  })
}
