import {Client} from 'pg';
import {assertIsolated} from './slice1-db';

// The databases that a test file creates beside the harness database, and their removal (the cases: tests/test-databases.test.ts).
// Not through pooledDatabase: it cancels a statement after 10 s (src/server/db.ts), and DROP DATABASE waits for a checkpoint, which in the shared test container has often taken longer.
// A DROP DATABASE that is cancelled in that wait leaves the database behind, already unusable (pg_database.datconnlimit -2); only another DROP DATABASE removes it.
// So each statement runs on a pg client of its own with no statement timeout, and a connection that ends under one drop does not take the next one with it.

/**
 * The time limit of a hook that calls dropAll: one limit for all the drops of the file, far above what a checkpoint of the test container has made a drop wait. It only bounds a server
 * that does not answer. A drop that was already sent goes on in the server after the limit; the ones not sent yet are not made, and vitest reports the hook as failed.
 */
export const DROP_HOOK_TIMEOUT_MS=600000;

export function testDatabases(serverUrl:string){
  const created:string[]=[];
  let serial=0;
  const urlOf=(db:string)=>{const u=new URL(serverUrl);u.pathname='/'+db;return u.toString();};
  async function onServer(sql:string):Promise<void>{
    const client=new Client({connectionString:urlOf('postgres')});
    // pg raises 'error' on the client when its connection ends; with no listener that stops the process. The statement that was running rejects with the error, so nothing is lost here.
    client.on('error',()=>{});
    await client.connect();
    try{await client.query(sql);}finally{await client.end();}
  }
  return {
    urlOf,
    /** A new empty database whose name the isolation rule of slice1-db.ts accepts; dropAll removes it. */
    async create():Promise<string>{
      const name=`slice1_verify_${Date.now()}${String(++serial).padStart(2,'0')}`;
      assertIsolated(urlOf(name));
      await onServer(`CREATE DATABASE "${name}"`);
      created.push(name);
      return name;
    },
    /** Tries every database that create() made, in order: a drop that fails does not end the loop. Throws at the end and names each database that was not dropped. */
    async dropAll():Promise<void>{
      const left:string[]=[];
      for(const name of created.splice(0)){
        try{await onServer(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);}
        catch(error){left.push(`${name}: ${(error as Error).message}`);}
      }
      if(left.length) throw new Error(`Test databases not dropped (${left.length}), drop each by hand: ${left.join('; ')}`);
    },
  };
}
