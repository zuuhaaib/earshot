import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { starterRoom } from '@/seed/rooms';
import { buildSeedSql } from '../seedSql';

const root = join(__dirname, '..', '..', '..');
const seedPath = join(root, 'supabase', 'seed.sql');

describe('the backend seed script', () => {
  it('is up to date with the seed files (run `npm run seed:sql` if this fails)', () => {
    const sql = buildSeedSql();
    if (process.env.WRITE_SEED) writeFileSync(seedPath, sql);
    expect(existsSync(seedPath)).toBe(true);
    expect(readFileSync(seedPath, 'utf8')).toBe(sql);
  });

  it('never contains anything that would break out of its own quoting', () => {
    const sql = buildSeedSql();
    expect(sql).not.toContain('$seed$;\n\ndo'); // one block only
    expect(sql.match(/\$seed\$/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\\'/);
  });

  it('gives new accounts the same starter room on the server as on the phone', () => {
    const schema = readFileSync(join(root, 'supabase', 'schema.sql'), 'utf8');
    const match = schema.match(/\$json\$(.*?)\$json\$/s);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(starterRoom(''));
  });
});
