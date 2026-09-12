import session from 'express-session';
import { getDb } from '../db';

interface SessionRow {
  sid: string;
  sess: string;
  expired: number;
}

/**
 * SQLite-backed session store (swappable later for Redis/Postgres).
 */
export class SqliteSessionStore extends session.Store {
  get(
    sid: string,
    callback: (err: unknown, session?: session.SessionData | null) => void,
  ): void {
    try {
      const row = getDb()
        .prepare('SELECT sess, expired FROM sessions WHERE sid = ?')
        .get(sid) as SessionRow | undefined;

      if (!row) {
        callback(null, null);
        return;
      }

      if (row.expired < Date.now()) {
        getDb().prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
        callback(null, null);
        return;
      }

      callback(null, JSON.parse(row.sess) as session.SessionData);
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    try {
      const maxAge = sess.cookie?.maxAge ?? 1000 * 60 * 60 * 24 * 7;
      const expired = Date.now() + maxAge;
      getDb()
        .prepare(
          `INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired`,
        )
        .run(sid, JSON.stringify(sess), expired);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      getDb().prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, sess, callback);
  }
}
