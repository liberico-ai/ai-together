import {afterEach,beforeEach,describe,expect,test,vi} from 'vitest';
import {COOKIE,createSession} from '../src/server/auth';
import {resolvePagePrincipal} from '../src/server/page-session';
import {pm} from './slice1-fixtures';

const url='http://127.0.0.1:3147';
const demoToken=()=>createSession(new Request(url+'/api/demo/session',{method:'POST',headers:{host:'127.0.0.1:3147',origin:url}}),{profileKey:'manager'}).token;
const identity=()=>{const session=vi.fn(async(_c?:string)=>pm);return {session};};
const saved=process.env.LIBETECH_DEMO;
beforeEach(()=>{process.env.LIBETECH_DEMO='1';});
afterEach(()=>{if(saved===undefined) delete process.env.LIBETECH_DEMO; else process.env.LIBETECH_DEMO=saved;});

describe('documents page principal (C1)',()=>{
  test('demo on + loopback host + valid demo cookie resolves the demo principal',async()=>{
    const id=identity();
    const p=await resolvePagePrincipal({host:'127.0.0.1:3147',cookie:n=>n===COOKIE?demoToken():undefined},()=>id);
    expect(p.role).toBe('manager');
    expect(id.session).not.toHaveBeenCalled();
  });
  test('demo on + loopback host + no/invalid cookie throws (page redirects to /login)',async()=>{
    const id=identity();
    await expect(resolvePagePrincipal({host:'localhost:3147',cookie:()=>undefined},()=>id)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
    await expect(resolvePagePrincipal({host:'localhost:3147',cookie:()=>'nope'},()=>id)).rejects.toMatchObject({code:'UNAUTHENTICATED'});
    expect(id.session).not.toHaveBeenCalled();
  });
  test('demo on + non-loopback host does not take the demo path',async()=>{
    const id=identity();
    const p=await resolvePagePrincipal({host:'ai.example.com',cookie:n=>n==='libetech_session'?'real-token':demoToken()},()=>id);
    expect(p).toBe(pm);
    expect(id.session).toHaveBeenCalledWith('real-token');
  });
  test('demo off takes the identity path even on a loopback host',async()=>{
    process.env.LIBETECH_DEMO='0';
    const id=identity();
    const p=await resolvePagePrincipal({host:'127.0.0.1:3147',cookie:n=>n==='libetech_session'?'real-token':demoToken()},()=>id);
    expect(p).toBe(pm);
    expect(id.session).toHaveBeenCalledWith('real-token');
  });
  test('identity failure propagates',async()=>{
    process.env.LIBETECH_DEMO='0';
    const id={session:vi.fn(async()=>{throw new Error('no session');})};
    await expect(resolvePagePrincipal({host:'ai.example.com',cookie:()=>undefined},()=>id)).rejects.toThrow('no session');
  });
});
