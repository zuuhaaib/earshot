import * as SQLite from 'expo-sqlite';
import type { SqlDriver } from './driver';

export async function openExpoDriver(name = 'earshot.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => {
      await db.runAsync(sql, params);
    },
    all: <T,>(sql: string, params: (string | number | null)[] = []) => db.getAllAsync<T>(sql, params),
    transaction: (task) => db.withTransactionAsync(task),
  };
}
