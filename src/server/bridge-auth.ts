import {createHmac,timingSafeEqual} from 'node:crypto';
import type {IdentityService} from './identity';
import {invariant} from './errors';

export const signingText=(timestamp:string,nonce:string,raw:string,path='/api/bridge')=>`${timestamp}\n${nonce}\nPOST\n${path}\n${raw}`;

/** Shared HMAC check for every bridge route. Returns the authenticated raw body. */
export async function verifySigned(request:Request,o:{key:string;path:string;maxBytes:number;identity:IdentityService;throttleBucket:string;throttleLimit:number}):Promise<string> {
 invariant(o.key.length>=43,'BRIDGE_UNCONFIGURED','Cầu nối chưa được cấu hình.',503);
 const raw=await request.text(); invariant(Buffer.byteLength(raw)<=o.maxBytes,'PAYLOAD_TOO_LARGE','Yêu cầu quá lớn.',413);
 const timestamp=request.headers.get('x-libetech-timestamp')??'',nonce=request.headers.get('x-libetech-nonce')??'',signature=request.headers.get('x-libetech-signature')??'';
 invariant(/^\d{13}$/.test(timestamp)&&Math.abs(Date.now()-Number(timestamp))<60000&&/^[A-Za-z0-9_-]{20,80}$/.test(nonce)&&/^[a-f0-9]{64}$/.test(signature),'BRIDGE_AUTH_DENIED','Không xác thực được cầu nối.',401);
 const expected=createHmac('sha256',o.key).update(signingText(timestamp,nonce,raw,o.path)).digest();
 invariant(timingSafeEqual(expected,Buffer.from(signature,'hex')),'BRIDGE_AUTH_DENIED','Không xác thực được cầu nối.',401);
 const used=await o.identity.scope(async tx=>(await tx.query(`INSERT INTO identity.bridge_nonces(tenant_id,nonce,expires_at) VALUES($1,$2,now()+interval '2 minutes') ON CONFLICT(tenant_id,nonce) DO NOTHING RETURNING id`,[o.identity.tenantId,nonce])).rows.length);
 invariant(used,'BRIDGE_REPLAY','Yêu cầu cầu nối đã được sử dụng.',409);
 await o.identity.throttle(o.throttleBucket,o.throttleLimit,60);
 return raw;
}
