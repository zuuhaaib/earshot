/** The same SqlDriver the app uses, backed by Node's built-in SQLite. Tests only. */
import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver } from '../../local/driver';

export function memoryDriver(): SqlDriver {
  const db = new DatabaseSync(':memory:');
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      db.prepare(sql).run(...params);
    },
    all: async <T,>(sql: string, params: (string | number | null)[] = []) => db.prepare(sql).all(...params) as T[],
    transaction: async (task) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
