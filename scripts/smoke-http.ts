import assert from 'node:assert/strict';
const base='http://127.0.0.1:3147';
async function session(profileKey:string) {
  const r=await fetch(base+'/api/demo/session',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({profileKey})});
  assert.equal(r.status,200);
  return r.headers.get('set-cookie')!.split(';')[0];
}
const health=await (await fetch(base+'/api/health')).json(); assert.equal(health.data.version,'0.1.0'); assert.deepEqual(health.data.schema,['001']);
const manager=await session('manager'),bot=await session('bot');
const fetchAs=(path:string,cookie?:string)=>fetch(base+path,{headers:cookie?{cookie}:{}});
assert.equal((await fetchAs('/api/v1/work')).status,401);
const works=await (await fetchAs('/api/v1/work',manager)).json();
const visible=await (await fetchAs('/api/v1/work',bot)).json(); assert.equal(visible.data.length,1); assert.equal(visible.data[0].code,'LT-DEMO-018');
const denied=await fetchAs('/api/v1/work/13000000-0000-4000-8000-000000000001',bot); assert.equal(denied.status,404); assert.equal((await denied.json()).error.code,'SCOPE_DENIED');
const write=await fetch(base+'/api/v1/work',{method:'POST',headers:{cookie:bot,origin:base,'Content-Type':'application/json'},body:'{}'}); assert.equal(write.status,403); assert.equal((await write.json()).error.code,'READ_ONLY');
for (const cookie of [manager,bot]) assert.equal((await fetch(base+'/api/demo/session',{method:'DELETE',headers:{cookie,origin:base}})).status,200);
console.log(JSON.stringify({at:new Date().toISOString(),application:health.data,managerWorkCount:works.data.length,botWorkCount:visible.data.length,checks:{unauthenticated:401,crossProject:404,crossProjectCode:'SCOPE_DENIED',botWrite:403,botWriteCode:'READ_ONLY'},result:'PASS'},null,2));
