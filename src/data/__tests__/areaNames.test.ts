// The server names areas in "songs that found each other" notifications from its own list
// (app.area_name in supabase/schema.sql). It must stay the same as the app's.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { areas } from '../areas';

it('the server knows every area by the same name as the app', () => {
  const sql = readFileSync(join(__dirname, '../../../supabase/schema.sql'), 'utf8');
  const block = sql.split('create or replace function app.area_name')[1].split(') v(id, name)')[0];
  const listed = [...block.matchAll(/\('([a-z-]+)', '((?:[^']|'')+)'\)/g)].map((m) => `${m[1]}=${m[2].split("''").join("'")}`);
  expect(listed.sort()).toEqual(areas.map((a) => `${a.id}=${a.name}`).sort());
});
