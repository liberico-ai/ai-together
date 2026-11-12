import { COOKIE, sessionPrincipal, localHost } from './auth';
import { identityService, SESSION_COOKIE } from './identity';
import type { Principal } from './types';

type SessionSource = { session(cookie: string | undefined): Promise<Principal> };

/** Same resolution as src/app/page.tsx: demo cookie only when LIBETECH_DEMO=1 AND loopback host; otherwise the org session. Throws when there is no session. */
export async function resolvePagePrincipal(
  input: { host: string; cookie: (name: string) => string | undefined },
  identity: () => SessionSource = identityService,
): Promise<Principal> {
  const demo = process.env.LIBETECH_DEMO === '1' && localHost(input.host);
  return demo ? sessionPrincipal(input.cookie(COOKIE), input.host) : identity().session(input.cookie(SESSION_COOKIE));
}

/** For server pages: reads the request headers and cookies. */
export async function pagePrincipal(): Promise<Principal> {
  const { cookies, headers } = await import('next/headers');
  const host = (await headers()).get('host') ?? '';
  const jar = await cookies();
  return resolvePagePrincipal({ host, cookie: name => jar.get(name)?.value });
}
