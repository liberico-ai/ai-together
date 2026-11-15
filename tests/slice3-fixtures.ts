import type {Database,Queryable} from '../src/server/db';
import {ids} from '../src/server/identities';
import type {Harness} from './slice1-db';
import {pm} from './slice1-fixtures';

/** Wraps a database so every row any query returns to the service is kept; tests then assert what the service was ever handed. */
export function recordingDb(db:Database):{db:Database;rows():unknown[]} {
 const seen:unknown[]=[];
 const wrap=(q:Queryable):Queryable=>({query:async<T=Record<string,unknown>>(sql:string,params?:unknown[])=>{const r=await q.query<T>(sql,params);seen.push(...r.rows);return r;}});
 return {rows:()=>seen,db:{...wrap(db),transaction:fn=>db.transaction(tx=>fn(wrap(tx))),close:()=>db.close()}};
}

/** Adds one project-to-domain mapping row (synthetic source), as tests/inbox-service.test.ts does. */
export async function mapDomain(h:Harness,projectId:string,code:'LIBERICO_BU'|'XECA'|'IBS_HI',version=1):Promise<void> {
 await h.operator.query("INSERT INTO project_domain_mappings(tenant_id,project_id,domain_code,confirmed_by,source,mapping_version) VALUES($1,$2,$3,$4,'synthetic-source',$5)",[ids.tenant,projectId,code,pm.id,version]);
}
