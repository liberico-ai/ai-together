import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {APP_VERSION} from '../src/server/version';
import {bridgeStatus,bridgeLabels,bridgeVerifiedAt} from '../src/server/integration-status';

test('APP_VERSION equals package.json version',()=>{
 expect(APP_VERSION).toBe(JSON.parse(readFileSync('package.json','utf8')).version);
});
test('no hard-coded release number remains in bridge, health and workspace',()=>{
 for(const f of ['src/server/bridge.ts','src/app/api/health/route.ts','src/components/workspace.tsx']){
  const text=readFileSync(f,'utf8');
  expect(text,f).not.toContain('0.7.1');expect(text,f).not.toContain('0.3.0');
 }
});
test('configuration alone never yields the verified label',()=>{
 expect(bridgeLabels(bridgeStatus({configured:true,verifiedAt:null}))).toEqual(['đã cấu hình','chưa nối luồng ghi']);
});
test('missing configuration shows not-configured and no write flow',()=>{
 expect(bridgeLabels(bridgeStatus({configured:false,verifiedAt:null}))).toEqual(['chưa cấu hình','chưa nối luồng ghi']);
 expect(bridgeStatus({configured:false,verifiedAt:'2026-11-12T00:00:00Z'}).connection).toBe('not-configured');
});
test('a recorded verification shows all three labels',()=>{
 expect(bridgeLabels(bridgeStatus({configured:true,verifiedAt:'2026-11-12T00:00:00Z'}))).toEqual(['đã cấu hình','đã kiểm thực tế','chưa nối luồng ghi']);
});
test('slice 1 has no verification source',async()=>{
 process.env.LIBETECH_BRIDGE_CONFIG='x';
 try{expect(await bridgeVerifiedAt()).toBeNull();}finally{delete process.env.LIBETECH_BRIDGE_CONFIG;}
});
