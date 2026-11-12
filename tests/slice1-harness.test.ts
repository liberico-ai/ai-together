import {describe,expect,test} from 'vitest';
import {assertIsolated,native,openHarness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';

test('assertIsolated rejects non-loopback host, wrong port and unexpected database name',()=>{
  for(const url of ['postgresql://u@10.0.0.5:55471/slice1_verify','postgresql://u@127.0.0.1:5432/slice1_verify','postgresql://u@127.0.0.1:55471/libetech'])
    expect(()=>assertIsolated(url)).toThrow('Use an isolated loopback slice-1 database.');
  expect(()=>assertIsolated('postgresql://u@127.0.0.1:55471/slice1_verify_17')).not.toThrow();
  expect(()=>assertIsolated('postgresql://u@127.0.0.1:55471/slice1_verify_17','postgresql://w@127.0.0.1:55471/slice1_verify_18'))
    .toThrow('Web must use the same isolated test database.');
});

test('harness applies every forward migration and seeds synthetic projects',async()=>{
  const h=await openHarness();
  try {
    await seedSlice1(h);
    const versions=(await h.operator.query<{version:string}>('SELECT version FROM schema_migrations')).rows.map(r=>r.version);
    expect(versions).toContain('012');
    expect((await h.operator.query('SELECT id FROM projects')).rows).toHaveLength(4);
  } finally { await h.reset(); await h.close(); }
});

describe.skipIf(!native)('native',()=>{
  test('runtime login is not superuser and cannot bypass RLS',async()=>{
    const h=await openHarness();
    try {
      const r=(await h.db.query<{rolsuper:boolean;rolbypassrls:boolean}>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
      expect(r).toEqual({rolsuper:false,rolbypassrls:false});
      const rows=await h.db.transaction(async tx=>{await tx.query('SET LOCAL ROLE libetech_runtime');return (await tx.query('SELECT * FROM work_items')).rows;});
      expect(rows).toHaveLength(0);
    } finally { await h.reset(); await h.close(); }
  });
});
