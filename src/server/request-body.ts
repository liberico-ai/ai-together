import { isUint8Array } from 'node:util/types';
import { AppError } from './errors';

/**
 * A request body as UTF-8 text, read as a stream and given up at `maxBytes` (Codex round 2 P1). Bytes are counted across
 * chunks; once the count passes the cap the reader is cancelled and the body refused with PAYLOAD_TOO_LARGE, 413, and
 * `message`, so a body sent without a length (chunked) is never buffered whole. No body reads as ''. The text is decoded
 * as `request.text()` decodes it: UTF-8, a leading BOM dropped, invalid bytes replaced by U+FFFD.
 */
export async function readBoundedText(request:Request,maxBytes:number,message:string):Promise<string> {
  if(request.body===null) return '';
  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  for(;;) {
    const {done,value}=await reader.read();
    if(done) break;
    // request.text() refuses a chunk that is not bytes too; an unknown chunk is never counted as zero bytes
    if(!isUint8Array(value)) { await cancel(reader); throw new TypeError('Received non-Uint8Array chunk'); }
    total+=value.byteLength;
    if(total>maxBytes) { await cancel(reader); throw new AppError('PAYLOAD_TOO_LARGE',message,413); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Stops the stream. A failed cancel changes nothing for the caller, who refuses the body anyway; it is logged by a fixed code. */
async function cancel(reader:ReadableStreamDefaultReader<Uint8Array>):Promise<void> {
  await reader.cancel().catch((cause:unknown)=>{
    console.error(JSON.stringify({level:'warn',event:'request_body_cancel_failed',errorType:cause instanceof Error?cause.name:'unknown'}));
  });
}
