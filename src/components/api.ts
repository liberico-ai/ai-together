/** An error the server answered: its Vietnamese message with the code appended, exactly as before (screens may show `message`). */
export class ApiError extends Error {
  constructor(message:string, readonly code:string, readonly status:number) { super(message); this.name='ApiError'; }
}
const TIMED_OUT=(seconds:number)=>`Quá ${seconds} giây chưa có phản hồi nên màn hình dừng chờ. Nếu đây là lệnh ghi thì có thể đã ghi xong: bấm lại là an toàn vì dùng cùng mã thao tác. Xem trước thì không ghi gì.`;
/** `timeoutMs`: stop waiting after this long and say so, instead of leaving the screen busy forever. Without it the call waits as before. */
export async function api<T>(path:string, body?:unknown, method?:string, options?:{timeoutMs:number}):Promise<T> {
  const signal=options?AbortSignal.timeout(options.timeoutMs):undefined;
  const timedOut=(error:unknown)=>signal?.aborted?new ApiError(TIMED_OUT(Math.ceil(options!.timeoutMs/1000))+' [CLIENT_TIMEOUT]','CLIENT_TIMEOUT',0):error;
  let response:Response,result:{data:T;error?:{code?:string;message?:string}};
  try {
    response=await fetch(path,{method:method??(body===undefined?'GET':'POST'),cache:'no-store',headers:{'Content-Type':'application/json',...(body!==undefined?{'Idempotency-Key':crypto.randomUUID()}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),...(signal?{signal}:{})});
    result=await response.json();
  } catch(error) { throw timedOut(error); }
  if(!response.ok) {
    const code=String(result.error?.code??response.status);
    throw new ApiError((result.error?.message??'Không xử lý được yêu cầu.')+' ['+code+']',code,response.status);
  }
  return result.data;
}
