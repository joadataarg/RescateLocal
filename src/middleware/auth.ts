import { Context, Next } from 'hono';
import { neon } from '@neondatabase/serverless';
import { validateSession } from '../auth';

function getSql(env: any) {
  return neon(env.DATABASE_URL);
}

export async function authMiddleware(c: Context, next: Next) {
  const cookie = c.req.header('Cookie');
  let token: string | null = null;

  if (cookie) {
    const match = cookie.match(/session_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return c.json({ error: 'No autenticado' }, 401);
  }

  const sql = getSql(c.env);
  const session = await validateSession(sql, token);
  if (!session) {
    return c.json({ error: 'Sesión inválida o expirada' }, 401);
  }

  c.set('user', session);
  await next();
}

export function requireRole(allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as { userId: string; role: string } | undefined;
    if (!user || !allowedRoles.includes(user.role)) {
      return c.json({ error: 'No autorizado' }, 403);
    }
    await next();
  };
}
