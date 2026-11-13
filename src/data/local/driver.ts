/**
 * The four things the local store needs from SQLite. The app uses expo-sqlite
 * (expoDriver.ts); the tests use Node's built-in sqlite. Same SQL either way.
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  transaction(task: () => Promise<void>): Promise<void>;
}
