import { getDb } from './index';

export interface ActivityLogInput {
  guildId: string;
  action: string;
  userId?: string | null;
  userTag?: string | null;
  details?: string | null;
}

export interface ActivityLogRecord {
  id: number;
  guild_id: string;
  action: string;
  user_id: string | null;
  user_tag: string | null;
  details: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  guildId: string;
  action: string;
  userId: string | null;
  userTag: string | null;
  details: string | null;
  createdAt: string;
}

function mapRow(row: ActivityLogRecord): ActivityLog {
  return {
    id: row.id,
    guildId: row.guild_id,
    action: row.action,
    userId: row.user_id,
    userTag: row.user_tag,
    details: row.details,
    createdAt: row.created_at,
  };
}

export function recordActivity(input: ActivityLogInput): ActivityLog {
  const createdAt = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO activity_logs (guild_id, action, user_id, user_tag, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.guildId,
      input.action,
      input.userId ?? null,
      input.userTag ?? null,
      input.details ?? null,
      createdAt,
    );

  return {
    id: Number(result.lastInsertRowid),
    guildId: input.guildId,
    action: input.action,
    userId: input.userId ?? null,
    userTag: input.userTag ?? null,
    details: input.details ?? null,
    createdAt,
  };
}

export function listActivity(guildId: string, limit = 25): ActivityLog[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM activity_logs
       WHERE guild_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
    )
    .all(guildId, limit) as ActivityLogRecord[];

  return rows.map(mapRow);
}
