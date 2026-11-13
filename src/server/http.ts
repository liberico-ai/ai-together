import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppError, invariant } from './errors';
import { authenticatedPrincipal, checkOrigin } from './auth';
import type { Database } from './db';
import { WorkService } from './service';
export function success(data:unknown, status=200, requestId:string=randomUUID()) { return Response.json({data,error:null,meta:{requestId}},{status,headers:{'Cache-Control':'no-store'}}); }
export function failure(error:unknown, requestId:string=randomUUID()) {
  if(error instanceof AppError) return Response.json({data:null,error:{code:error.code,message:error.message},meta:{requestId}},{status:error.status,headers:{'Cache-Control':'no-store'}});
  if(error instanceof ZodError || error instanceof SyntaxError) return Response.json({data:null,error:{code:'INVALID_INPUT',message:'Dữ liệu không hợp lệ. Kiểm tra các trường và không gửi trường định danh ngoài biểu mẫu.'},meta:{requestId}},{status:422});
  if((error as {code?:string})?.code === '23505') return Response.json({data:null,error:{code:'DUPLICATE_CODE',message:'Mã việc đã tồn tại trong dự án.'},meta:{requestId}},{status:409});
  console.error(JSON.stringify({level:'error',event:'request_failed',requestId,errorType:error instanceof Error?error.name:'unknown'}));
  return Response.json({data:null,error:{code:'INTERNAL_ERROR',message:'Chưa xử lý được yêu cầu. Dùng mã tham chiếu để kiểm tra.'},meta:{requestId}},{status:500});
}
export async function body(request:Request) {
  const raw=await request.text(); invariant(Buffer.byteLength(raw)<=16384,'PAYLOAD_TOO_LARGE','Nội dung vượt 16 KB.',413); return JSON.parse(raw);
}
export async function handleApi(request:Request, parts:string[], db:Database) {
  try {
    const principal=await authenticatedPrincipal(request), service=new WorkService(db);
    if(request.method==='GET') {
      if(parts.join('/')==='overview') return success(await service.overview(principal));
      if(parts.join('/')==='workspace') return success(await service.workspace(principal));
      if(parts.join('/')==='services') return success((await service.workspace(principal)).services);
      if(parts.join('/')==='work') return success((await service.workspace(principal)).work);
      if(parts[0]==='work' && parts.length===2) return success(await service.detail(principal,parts[1]));
    }
    if(request.method==='POST') {
      checkOrigin(request);
      if(parts.join('/')==='overview/refresh') return success(await service.refresh(principal));
      const key=request.headers.get('idempotency-key')??'';
      if(parts.join('/')==='work') return success(await service.create(principal,await body(request),key),201);
      if(parts[0]==='work' && parts[2]==='commands' && parts.length===3) return success(await service.command(principal,parts[1],await body(request),key));
    }
    throw new AppError('NOT_FOUND','Không có đường dẫn này.',404);
  } catch(error) { return failure(error); }
}
