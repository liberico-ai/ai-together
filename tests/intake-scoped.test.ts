import {afterEach,beforeEach,expect,test} from 'vitest';
import {openHarness,type Harness} from './slice1-db';
import {seedSlice1} from './slice1-fixtures';
import {ids} from '../src/server/identities';
import {intakeScoped} from '../src/server/bridge-io';
import {intakePrincipalId} from './slice2-fixtures';

let h:Harness;
beforeEach(async()=>{h=await openHarness();await h.reset();await seedSlice1(h);});
afterEach(async()=>{await h.reset();await h.close();});

test('intakeScoped sets app.intake_principal_id for the transaction only',async()=>{
  const p={id:intakePrincipalId,tenantId:ids.tenant,projectIds:[ids.sales]} as never;
  const inside=await intakeScoped(h.operator,p,async tx=>(await tx.query<{v:string}>("SELECT current_setting('app.intake_principal_id',true) v")).rows[0].v);
  expect(inside).toBe(intakePrincipalId);
  const after=(await h.operator.query<{v:string|null}>("SELECT current_setting('app.intake_principal_id',true) v")).rows[0].v;
  expect(after??'').toBe('');
});
