import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { authMiddleware } from '../middleware/auth';

const lotesRoutes = new Hono();

function getSql(env: any) {
  return neon(env.DATABASE_URL);
}

function requireRole(allowedRoles: string[]) {
  return async (c: any, next: any) => {
    const user = c.get('user') as { userId: string; role: string } | undefined;
    if (!user || !allowedRoles.includes(user.role)) {
      return c.json({ error: 'No autorizado' }, 403);
    }
    await next();
  };
}

// Crear lote (solo comercio)
lotesRoutes.post('/nuevo', authMiddleware, requireRole(['comercio']), async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const { descripcion, cantidad_unidades, peso_kg_estimado, ventana_inicio, ventana_fin, direccion_retiro, instrucciones_retiro } = await c.req.json();

  if (!descripcion || !cantidad_unidades || !ventana_inicio || !ventana_fin || !direccion_retiro) {
    return c.json({ error: 'Faltan campos obligatorios' }, 400);
  }

  const sql = getSql(c.env);

  const result = await sql`
    INSERT INTO lotes (comercio_id, descripcion, cantidad_unidades, peso_kg_estimado, ventana_inicio, ventana_fin, direccion_retiro, instrucciones_retiro)
    VALUES (${user.userId}, ${descripcion}, ${cantidad_unidades}, ${peso_kg_estimado || null}, ${ventana_inicio}, ${ventana_fin}, ${direccion_retiro}, ${instrucciones_retiro || null})
    RETURNING id
  `;

  return c.json({ loteId: result[0].id }, 201);
});

// Formulario HTML para crear lote
lotesRoutes.get('/nuevo', authMiddleware, requireRole(['comercio']), (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Publicar lote — RescateLocal</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 500px; margin: 40px auto; padding: 0 16px; line-height: 1.6; color: #1a1a1a; }
    h1 { color: #0f766e; }
    form { display: flex; flex-direction: column; gap: 12px; background: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; }
    label { font-weight: 600; font-size: 14px; color: #374151; }
    input, textarea, select { padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
    button { background: #0f766e; color: #fff; padding: 12px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
    button:hover { background: #0d5e56; }
    .btn-secondary { background: #6b7280; text-decoration: none; display: inline-block; padding: 10px 16px; border-radius: 6px; }
    .btn-secondary:hover { background: #4b5563; }
  </style>
</head>
<body>
  <h1>Publicar lote de excedentes</h1>
  <a href="/" class="btn-secondary">← Volver al inicio</a>
  <form id="loteForm">
    <label>Descripción</label>
    <input type="text" name="descripcion" placeholder="Ej: Panes del día, 20 unidades" required>
    <label>Cantidad (unidades)</label>
    <input type="number" name="cantidad_unidades" min="1" required>
    <label>Peso estimado (kg, opcional)</label>
    <input type="number" name="peso_kg_estimado" step="0.01" min="0" placeholder="0.00">
    <label>Ventana de retiro — Inicio</label>
    <input type="datetime-local" name="ventana_inicio" required>
    <label>Ventana de retiro — Fin</label>
    <input type="datetime-local" name="ventana_fin" required>
    <label>Dirección de retiro</label>
    <input type="text" name="direccion_retiro" placeholder="Ej: Calle Falsa 123, local 3" required>
    <label>Instrucciones de retiro (opcional)</label>
    <textarea name="instrucciones_retiro" rows="3" placeholder="Ej: Timbrar al departamento 2B"></textarea>
    <button type="submit">Publicar lote</button>
  </form>
  <script>
    document.getElementById('loteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        descripcion: form.descripcion.value,
        cantidad_unidades: parseInt(form.cantidad_unidades.value),
        peso_kg_estimado: form.peso_kg_estimado.value ? parseFloat(form.peso_kg_estimado.value) : null,
        ventana_inicio: form.ventana_inicio.value,
        ventana_fin: form.ventana_fin.value,
        direccion_retiro: form.direccion_retiro.value,
        instrucciones_retiro: form.instrucciones_retiro.value || null,
      };
      const res = await fetch('/lotes/nuevo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        alert('Lote publicado con ID: ' + result.loteId);
        window.location.href = '/lotes/disponibles';
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    });
  </script>
</body>
</html>`);
});

// Listar lotes disponibles (público)
lotesRoutes.get('/disponibles', async (c) => {
  const sql = getSql(c.env);
  const lotes = await sql`
    SELECT l.id, l.descripcion, l.cantidad_unidades, l.peso_kg_estimado, l.ventana_inicio, l.ventana_fin, l.direccion_retiro, l.instrucciones_retiro, l.estado, l.created_at,
           u.email as comercio_email
    FROM lotes l
    JOIN users u ON u.id = l.comercio_id
    WHERE l.estado = 'disponible' AND l.ventana_fin > NOW()
    ORDER BY l.ventana_fin ASC
  `;
  return c.json({ lotes });
});

// Cancelar lote (solo comercio dueño)
lotesRoutes.post('/:id/cancelar', authMiddleware, requireRole(['comercio']), async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const loteId = c.req.param('id');
  const sql = getSql(c.env);

  const lote = await sql`SELECT id, comercio_id, estado FROM lotes WHERE id = ${loteId}`;
  if (lote.length === 0) {
    return c.json({ error: 'Lote no encontrado' }, 404);
  }
  if (lote[0].comercio_id !== user.userId) {
    return c.json({ error: 'No eres el dueño de este lote' }, 403);
  }
  if (lote[0].estado !== 'disponible') {
    return c.json({ error: 'Solo se puede cancelar un lote disponible' }, 400);
  }

  await sql`UPDATE lotes SET estado = 'cancelado', updated_at = NOW() WHERE id = ${loteId}`;
  return c.json({ ok: true });
});

export default lotesRoutes;
