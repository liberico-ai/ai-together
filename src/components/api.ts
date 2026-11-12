export async function api<T>(path:string, body?:unknown, method?:string):Promise<T> {
  const response=await fetch(path,{method:method??(body===undefined?'GET':'POST'),cache:'no-store',headers:{'Content-Type':'application/json',...(body!==undefined?{'Idempotency-Key':crypto.randomUUID()}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const result=await response.json();
  if(!response.ok) throw new Error((result.error?.message??'Không xử lý được yêu cầu.')+' ['+(result.error?.code??response.status)+']');
  return result.data;
}
