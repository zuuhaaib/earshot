// Regenerates supabase/seed.sql from the seed files in src/seed.
// The generator is TypeScript that leans on the app's module setup, so it runs through the test runner.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['jest', 'seedSql'], { stdio: 'inherit', shell: true, env: { ...process.env, WRITE_SEED: '1' } });
process.exit(result.status ?? 1);
