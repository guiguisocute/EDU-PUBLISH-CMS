/**
 * View counting storage abstraction.
 *
 * Built-in backends:
 * - D1ViewStore: Cloudflare D1 (used when env.DB is bound)
 * - NullViewStore: No-op fallback (site works without any database)
 *
 * To add a new backend (e.g., PostgreSQL via Hyperdrive, Turso, PlanetScale):
 * 1. Implement the ViewStore interface
 * 2. Update createViewStore() to detect your backend from env
 */
/// <reference types="@cloudflare/workers-types" />

export interface ViewStore {
  recordView(guid: string, ipHash: string): Promise<{ ok: boolean; dup?: boolean }>
  getViewCounts(guids: string[]): Promise<Record<string, number>>
}

export class NullViewStore implements ViewStore {
  async recordView(): Promise<{ ok: boolean; dup?: boolean }> {
    return { ok: true }
  }
  async getViewCounts(guids: string[]): Promise<Record<string, number>> {
    return Object.fromEntries(guids.map(g => [g, 0]))
  }
}

const HOUR_S = 3600
const DAY_S = 86400

export class D1ViewStore implements ViewStore {
  private schemaReady: Promise<void> | null = null

  constructor(private db: D1Database) {}

  private ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.db
        .batch([
          this.db.prepare(
            'CREATE TABLE IF NOT EXISTS view_counts (guid TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0)'
          ),
          this.db.prepare(
            'CREATE TABLE IF NOT EXISTS view_logs (ip_hash TEXT NOT NULL, guid TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (ip_hash, guid))'
          ),
          this.db.prepare('CREATE INDEX IF NOT EXISTS idx_view_logs_guid ON view_logs(guid)'),
          this.db.prepare('CREATE INDEX IF NOT EXISTS idx_view_logs_ts ON view_logs(ts)'),
        ])
        .then(() => undefined)
    }

    return this.schemaReady
  }

  async recordView(guid: string, ipHash: string): Promise<{ ok: boolean; dup?: boolean }> {
    await this.ensureSchema()
    const now = Math.floor(Date.now() / 1000)

    const existing = await this.db
      .prepare('SELECT 1 FROM view_logs WHERE ip_hash = ? AND guid = ? AND ts > ?')
      .bind(ipHash, guid, now - HOUR_S)
      .first()

    if (existing) {
      return { ok: true, dup: true }
    }

    await this.db.batch([
      this.db
        .prepare(
          'INSERT INTO view_logs (ip_hash, guid, ts) VALUES (?, ?, ?) ON CONFLICT (ip_hash, guid) DO UPDATE SET ts = excluded.ts'
        )
        .bind(ipHash, guid, now),
      this.db
        .prepare(
          'INSERT INTO view_counts (guid, views) VALUES (?, 1) ON CONFLICT (guid) DO UPDATE SET views = views + 1'
        )
        .bind(guid),
    ])

    return { ok: true }
  }

  async cleanupOldLogs(): Promise<void> {
    await this.ensureSchema()
    const now = Math.floor(Date.now() / 1000)
    await this.db.prepare('DELETE FROM view_logs WHERE ts < ?').bind(now - DAY_S).run()
  }

  async getViewCounts(guids: string[]): Promise<Record<string, number>> {
    if (guids.length === 0) return {}
    await this.ensureSchema()

    const placeholders = guids.map(() => '?').join(',')
    const { results } = await this.db
      .prepare(`SELECT guid, views FROM view_counts WHERE guid IN (${placeholders})`)
      .bind(...guids)
      .all<{ guid: string; views: number }>()

    const counts: Record<string, number> = {}
    for (const row of results) {
      counts[row.guid] = row.views
    }
    return counts
  }
}

export function createViewStore(env: Record<string, unknown>): ViewStore {
  const db = env.DB as D1Database | undefined
  if (db) return new D1ViewStore(db)
  return new NullViewStore()
}
