/** An error the server answered: its Vietnamese message with the code appended, exactly as before (screens may show `message`). */
export class ApiError extends Error {
  constructor(message:string, readonly code:string, readonly status:number) { super(message); this.name='ApiError'; }
}
export async function api<T>(path:string, body?:unknown, method?:string):Promise<T> {
  const response=await fetch(path,{method:method??(body===undefined?'GET':'POST'),cache:'no-store',headers:{'Content-Type':'application/json',...(body!==undefined?{'Idempotency-Key':crypto.randomUUID()}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok) {
    const code=String(result.error?.code??response.status);
    throw new ApiError((result.error?.message??'Không xử lý được yêu cầu.')+' ['+code+']',code,response.status);
  }
  return result.data;
}
