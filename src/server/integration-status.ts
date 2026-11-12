// Pure and client-safe: no server imports.
export type BridgeConnection='not-configured'|'configured'|'verified';
export type BridgeStatus={connection:BridgeConnection;writeFlow:'not-connected';verifiedAt:string|null};
export function bridgeStatus(input:{configured:boolean;verifiedAt:string|null}):BridgeStatus {
  const connection:BridgeConnection=!input.configured?'not-configured':input.verifiedAt?'verified':'configured';
  return {connection,writeFlow:'not-connected',verifiedAt:connection==='verified'?input.verifiedAt:null};
}
export function bridgeLabels(s:BridgeStatus):string[] {
  const labels:string[]=[s.connection==='not-configured'?'chưa cấu hình':'đã cấu hình'];
  if(s.connection==='verified') labels.push('đã kiểm thực tế');
  labels.push('chưa nối luồng ghi');
  return labels;
}
// Slice 1: no verification source exists (OQ-23 (a) decided: bridge verification stays off in this slice). Configuration never counts as verification.
export async function bridgeVerifiedAt():Promise<string|null> { return null; }
