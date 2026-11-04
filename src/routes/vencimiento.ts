import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { authMiddleware } from '../middleware/auth';

const vencimientoRoutes = new Hono();

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

// Ejecutar vencimiento de lotes (endpoint manual protegido + cron)
vencimientoRoutes.post('/cron/vencer-lotes', authMiddleware, requireRole(['admin']), async (c) => {
  const sql = getSql(c.env);
  const ahora = new Date().toISOString();

  try {
    await sql`BEGIN`;

    // 1. Lotes disponibles cuyo ventana_fin ya pasó → vencido
    const vencidos = await sql`
      UPDATE lotes
      SET estado = 'vencido', updated_at = NOW()
      WHERE estado = 'disponible' AND ventana_fin < ${ahora}
      RETURNING id
    `;

    // 2. Lotes tomados cuyo ventana_fin ya pasó → liberado
    const liberados = await sql`
      UPDATE lotes
      SET estado = 'liberado', updated_at = NOW()
      WHERE estado = 'tomado' AND ventana_fin < ${ahora}
      RETURNING id
    `;

    await sql`COMMIT`;

    return c.json({
      vencidos: vencidos.length,
      liberados: liberados.length,
      ejecutado_en: ahora,
    });
  } catch (e: any) {
    await sql`ROLLBACK`;
    return c.json({ error: 'Error ejecutando vencimiento' }, 500);
  }
});

// Corrección manual de estado por admin (con auditoría)
vencimientoRoutes.post('/admin/lotes/:id/correccion', authMiddleware, requireRole(['admin']), async (c) => {
  const admin = c.get('user') as { userId: string; role: string };
  const loteId = c.req.param('id');
  const { estado, motivo } = await c.req.json();

  const estadosValidos = ['disponible', 'tomado', 'rescatado', 'vencido', 'liberado', 'cancelado'];
  if (!estado || !estadosValidos.includes(estado)) {
    return c.json({ error: 'Estado inválido' }, 400);
  }
  if (!motivo) {
    return c.json({ error: 'Motivo requerido' }, 400);
  }

  const sql = getSql(c.env);

  try {
    await sql`BEGIN`;

    // Obtener estado anterior
    const anterior = await sql`SELECT estado FROM lotes WHERE id = ${loteId}`;
    if (anterior.length === 0) {
      await sql`ROLLBACK`;
      return c.json({ error: 'Lote no encontrado' }, 404);
    }

    const estadoAnterior = anterior[0].estado;

    // Actualizar estado
    await sql`
      UPDATE lotes SET estado = ${estado}, updated_at = NOW() WHERE id = ${loteId}
    `;

    // Registrar en auditoría
    await sql`
      INSERT INTO auditoria (admin_id, tabla_afectada, registro_id, accion, motivo, valores_anteriores, valores_nuevos)
      VALUES (${admin.userId}, 'lotes', ${loteId}, 'correccion_estado', ${motivo},
        ${JSON.stringify({ estado: estadoAnterior })},
        ${JSON.stringify({ estado })}
      )
    `;

    await sql`COMMIT`;

    return c.json({
      lote_id: loteId,
      estado_anterior: estadoAnterior,
      estado_nuevo: estado,
      motivo,
    });
  } catch (e: any) {
    await sql`ROLLBACK`;
    return c.json({ error: 'Error corrigiendo estado' }, 500);
  }
});

export default vencimientoRoutes;
