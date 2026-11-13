import {createHmac,randomBytes} from 'node:crypto';
import {createHash} from 'node:crypto';
import {ids} from '../src/server/identities';
import {sameBuProject} from './slice1-fixtures';

import type {BridgeConfig} from '../src/server/bridge-config';
type IntakeEventInput=any; // thay ở Task 3/4

export const chatSales='-1000000000001';
export const chatTransport='-1000000000002';
export const chatMulti='-1000000000003';
export const chatUnknown='-1000000000009';
export const chatNotIntake='-1000000000004';
export const botKey:string=randomBytes(48).toString('base64url');
export const intakeKey:string=randomBytes(48).toString('base64url');
export const intakePrincipalId='22000000-0000-4000-8000-000000000001';

export const bridgeConfig:BridgeConfig={
  key:botKey,
  chatScopes:{[chatSales]:[ids.sales],[chatTransport]:[ids.transport],[chatMulti]:[ids.sales,sameBuProject],[chatNotIntake]:[ids.sales]},
  intake:{key:intakeKey,principalId:intakePrincipalId,chats:[chatSales,chatTransport,chatMulti]},
};

const BASE='http://127.0.0.1:3148';
export function signedRequest(path:string,body:unknown,opts:{key?:string;timestamp?:string;nonce?:string;signPath?:string}={}):Request{
  const raw=typeof body==='string'?body:JSON.stringify(body);
  const timestamp=opts.timestamp??String(Date.now());
  const nonce=opts.nonce??randomBytes(24).toString('base64url');
  const signature=createHmac('sha256',opts.key??intakeKey).update(`${timestamp}\n${nonce}\nPOST\n${opts.signPath??path}\n${raw}`).digest('hex');
  return new Request(BASE+path,{method:'POST',body:raw,headers:{'content-type':'application/json','x-libetech-timestamp':timestamp,'x-libetech-nonce':nonce,'x-libetech-signature':signature}});
}

let seq=0;
export function messageEvent(over:Partial<IntakeEventInput>={}):IntakeEventInput{
  seq+=1;
  const text=over.text??`Tin mẫu số ${seq}`;
  return {chatId:chatSales,messageId:String(seq),text,contentHash:createHash('sha256').update(text).digest('hex'),...over};
}
