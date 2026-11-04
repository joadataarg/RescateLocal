import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { hashPassword, verifyPassword, createSession, deleteSession, validateSession } from '../auth';

const authRoutes = new Hono();

function getSql(env: any) {
  return neon(env.DATABASE_URL);
}

// CSS compartido para layout split-screen
const splitScreenCSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; height: 100vh; overflow: hidden; }
  .split-container { display: flex; height: 100vh; width: 100vw; }
  .form-side { flex: 1; background: #fff; display: flex; flex-direction: column; justify-content: center; padding: 40px 24px; border-right: 1px solid #e5e7eb; }
  .image-side { flex: 1; background: #f3f4f6; display: flex; align-items: center; justify-content: center; }
  .image-side img { width: 100%; height: 100vh; object-fit: cover; border-radius: 0; box-shadow: none; }
  h1 { color: #0f766e; text-align: center; margin-bottom: 24px; font-size: 28px; }
  form { display: flex; flex-direction: column; gap: 16px; background: #f9fafb; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb; width: 100%; max-width: 400px; margin: 0 auto; }
  label { font-weight: 600; font-size: 14px; color: #374151; }
  input, select { padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; width: 100%; }
  button { background: #0f766e; color: #fff; padding: 12px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px; }
  button:hover { background: #0d5e56; }
  .link-text { text-align: center; margin-top: 16px; color: #4b5563; font-size: 14px; }
  .link-text a { color: #0f766e; text-decoration: none; font-weight: 600; }
  .link-text a:hover { text-decoration: underline; }
  #msg { margin-top: 12px; font-size: 14px; text-align: center; }
  .success { color: #059669; }
  .error { color: #dc2626; }
  @media (max-width: 768px) {
    .split-container { flex-direction: column; }
    .image-side { display: none; }
    .form-side { border-right: none; padding: 20px 16px; }
  }
`;

// Formulario HTML de registro (GET)
authRoutes.get('/register', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registrarse</title>
  <style>${splitScreenCSS}</style>
</head>
<body>
  <div class="split-container">
    <div class="form-side">
      <h1>Registrarse</h1>
      <form id="registerForm">
        <label>Email</label>
        <input type="email" name="email" placeholder="tu@email.com" required>
        <label>Contraseña</label>
        <input type="password" name="password" required>
        <label>Rol</label>
        <select name="role" required>
          <option value="comercio">Comercio (publica lotes)</option>
          <option value="receptor">Receptor (reserva y retira)</option>
        </select>
        <button type="submit">Registrarse</button>
      </form>
      <p class="link-text">¿Ya tiene cuenta? <a href="/auth/login">Inicie Sesión</a></p>
      <div id="msg"></div>
    </div>
    <div class="image-side">
      <img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80" alt="Compartir alimentos">
    </div>
  </div>
  <script>
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const msg = document.getElementById('msg');
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value,
          role: form.role.value,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        msg.innerHTML = '<div class="success">Usuario creado. Redirigiendo a login...</div>';
        setTimeout(() => { window.location.href = '/auth/login'; }, 1000);
        form.reset();
      } else {
        msg.innerHTML = '<div class="error">Error: ' + (data.error || 'desconocido') + '</div>';
      }
    });
  </script>
</body>
</html>`);
});

// Formulario HTML de login (GET)
authRoutes.get('/login', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Iniciar Sesión</title>
  <style>${splitScreenCSS}</style>
</head>
<body>
  <div class="split-container">
    <div class="form-side">
      <a href="/" class="btn-volver" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600; color: #374151; border: 1px solid #d1d5db; background: #fff; margin-bottom: 24px; align-self: flex-start;">← Volver</a>
      <h1>Iniciar Sesión</h1>
      <form id="loginForm">
        <label>Email</label>
        <input type="email" name="email" id="emailInput" placeholder="tu@email.com" required>
        <label>Contraseña</label>
        <input type="password" name="password" id="passwordInput" required>
        <button type="submit">Iniciar sesión</button>
      </form>
      <p class="link-text">¿No tienes cuenta? <a href="/auth/register">Regístrate</a></p>
      <div id="msg"></div>
    </div>
    <div class="image-side" style="flex-direction: column; position: relative;">
      <img src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80" alt="Compartir alimentos" style="width: 100%; height: 100vh; object-fit: cover;">
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.95); padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.15); max-width: 90%;">
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151; font-weight: 600; text-align: center;">Cuentas de prueba:</p>
        <p style="margin: 4px 0; font-size: 13px; color: #4b5563; text-align: center;"><strong>Comercio:</strong> comercio@test.com / 123456</p>
        <p style="margin: 4px 0; font-size: 13px; color: #4b5563; text-align: center;"><strong>Receptor:</strong> receptor@test.com / 123456</p>
        <p style="margin: 4px 0; font-size: 13px; color: #4b5563; text-align: center;"><strong>Admin:</strong> admin@test.com / 123456</p>
      </div>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const msg = document.getElementById('msg');
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        msg.innerHTML = '<div class="success">Sesión iniciada. Redirigiendo...</div>';
        setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
      } else {
        msg.innerHTML = '<div class="error">Error: ' + (data.error || 'desconocido') + '</div>';
      }
    });
  </script>
</body>
</html>`);
});

authRoutes.post('/register', async (c) => {
  const { email, password, role } = await c.req.json();

  if (!email || !password || !role) {
    return c.json({ error: 'Faltan campos' }, 400);
  }

  const sql = getSql(c.env);

  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) {
    return c.json({ error: 'Email ya registrado' }, 409);
  }

  const passwordHash = await hashPassword(password);

  const result = await sql`
    INSERT INTO users (email, password_hash, role)
    VALUES (${email}, ${passwordHash}, ${role})
    RETURNING id, role
  `;

  return c.json({ user: { id: result[0].id, role: result[0].role } }, 201);
});

authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Faltan campos' }, 400);
  }

  const sql = getSql(c.env);

  const result = await sql`
    SELECT id, password_hash, role FROM users WHERE email = ${email}
  `;

  if (result.length === 0) {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const user = result[0];
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return c.json({ error: 'Credenciales inválidas' }, 401);
  }

  const token = await createSession(sql, user.id);

  c.header('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`);

  return c.json({ user: { id: user.id, role: user.role } });
});

authRoutes.post('/logout', async (c) => {
  const cookie = c.req.header('Cookie');
  if (cookie) {
    const match = cookie.match(/session_token=([^;]+)/);
    if (match) {
      const sql = getSql(c.env);
      await deleteSession(sql, match[1]);
    }
  }

  c.header('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');

  return c.json({ ok: true });
});

// Logout vía GET (para enlaces del navegador) — cierra sesión y redirige al login
authRoutes.get('/logout', async (c) => {
  const cookie = c.req.header('Cookie');
  if (cookie) {
    const match = cookie.match(/session_token=([^;]+)/);
    if (match) {
      const sql = getSql(c.env);
      await deleteSession(sql, match[1]);
    }
  }

  c.header('Set-Cookie', 'session_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');

  return c.redirect('/auth/login');
});

// Ruta de prueba para validar sesión (middleware)
authRoutes.get('/me', async (c) => {
  const cookie = c.req.header('Cookie');
  if (!cookie) return c.json({ error: 'No autenticado' }, 401);

  const match = cookie.match(/session_token=([^;]+)/);
  if (!match) return c.json({ error: 'No autenticado' }, 401);

  const sql = getSql(c.env);
  const session = await validateSession(sql, match[1]);
  if (!session) return c.json({ error: 'Sesión inválida o expirada' }, 401);

  return c.json(session);
});

export default authRoutes;
