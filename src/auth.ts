import { neon } from '@neondatabase/serverless';

export async function sha256(data: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string): Promise<string> {
  return sha256(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await sha256(password);
  return computed === hash;
}

export async function createSession(sql: any, userId: string): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await sql`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (gen_random_uuid(), ${userId}, ${tokenHash}, ${expiresAt.toISOString()})`;

  return token;
}

export async function validateSession(sql: any, token: string): Promise<{ userId: string; role: string } | null> {
  const tokenHash = await sha256(token);
  const result = await sql`
    SELECT s.user_id, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
    AND s.expires_at > NOW()
  `;

  if (result.length === 0) return null;
  return { userId: result[0].user_id, role: result[0].role };
}

export async function deleteSession(sql: any, token: string): Promise<void> {
  const tokenHash = await sha256(token);
  await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
}
