import { randomBytes } from 'node:crypto';
import { NextResponse,type NextRequest } from 'next/server';

export function proxy(request:NextRequest) {
  const nonce=randomBytes(18).toString('base64');
  const csp=[
    "default-src 'self'",
    "script-src 'self' 'nonce-"+nonce+"' 'strict-dynamic'"+(process.env.NODE_ENV==='development'?" 'unsafe-eval'":""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  const headers=new Headers(request.headers);
  headers.set('Content-Security-Policy',csp);
  const response=NextResponse.next({request:{headers}});
  response.headers.set('Content-Security-Policy',csp);
  return response;
}
export const config={matcher:['/((?!api/|_next/static|_next/image|favicon.ico).*)']};
