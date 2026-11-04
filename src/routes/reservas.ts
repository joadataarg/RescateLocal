import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { authMiddleware } from '../middleware/auth';

const reservasRoutes = new Hono();

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

// Reservar un lote (solo receptor)
reservasRoutes.post('/lotes/:id/reservar', authMiddleware, requireRole(['receptor']), async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const loteId = c.req.param('id');
  const sql = getSql(c.env);

  // Verificar que el lote exista y esté disponible
  const lote = await sql`
    SELECT id, estado, direccion_retiro, instrucciones_retiro, cantidad_unidades, descripcion
    FROM lotes WHERE id = ${loteId}
  `;

  if (lote.length === 0) {
    return c.json({ error: 'Lote no encontrado' }, 404);
  }

  if (lote[0].estado !== 'disponible') {
    return c.json({ error: 'El lote no está disponible para reservar' }, 400);
  }

  // Crear reserva y marcar lote como tomado en una transacción
  try {
    await sql`BEGIN`;

    // Verificar de nuevo que esté disponible (race condition)
    const loteCheck = await sql`
      SELECT id, estado FROM lotes WHERE id = ${loteId} FOR UPDATE
    `;
    if (loteCheck.length === 0 || loteCheck[0].estado !== 'disponible') {
      await sql`ROLLBACK`;
      return c.json({ error: 'El lote ya no está disponible' }, 400);
    }

    // Crear reserva
    const reserva = await sql`
      INSERT INTO reservas (lote_id, receptor_id)
      VALUES (${loteId}, ${user.userId})
      RETURNING id
    `;

    // Marcar lote como tomado
    await sql`
      UPDATE lotes SET estado = 'tomado', updated_at = NOW() WHERE id = ${loteId}
    `;

    await sql`COMMIT`;

    return c.json({
      reservaId: reserva[0].id,
      direccion_retiro: lote[0].direccion_retiro,
      instrucciones_retiro: lote[0].instrucciones_retiro,
      mensaje: 'Lote reservado. Dirección revelada.',
    }, 201);
  } catch (e: any) {
    await sql`ROLLBACK`;
    return c.json({ error: 'No se pudo reservar el lote' }, 400);
  }
});

// Ver detalles de una reserva (solo el receptor dueño)
reservasRoutes.get('/reservas/:id', authMiddleware, requireRole(['receptor']), async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const reservaId = c.req.param('id');
  const sql = getSql(c.env);

  const reserva = await sql`
    SELECT r.id, r.lote_id, r.created_at,
           l.descripcion, l.cantidad_unidades, l.peso_kg_estimado, l.ventana_inicio, l.ventana_fin,
           l.direccion_retiro, l.instrucciones_retiro, l.estado
    FROM reservas r
    JOIN lotes l ON l.id = r.lote_id
    WHERE r.id = ${reservaId} AND r.receptor_id = ${user.userId}
  `;

  if (reserva.length === 0) {
    return c.json({ error: 'Reserva no encontrada' }, 404);
  }

  return c.json({ reserva: reserva[0] });
});

// Confirmar recogida (solo receptor dueño de la reserva)
reservasRoutes.post('/reservas/:id/recoger', authMiddleware, requireRole(['receptor']), async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const reservaId = c.req.param('id');
  const { unidades, peso_kg_estimado } = await c.req.json();

  if (!unidades) {
    return c.json({ error: 'Falta cantidad de unidades' }, 400);
  }

  const sql = getSql(c.env);

  try {
    await sql`BEGIN`;

    // Obtener la reserva y verificar que pertenece al usuario
    const reserva = await sql`
      SELECT r.id, r.lote_id, l.cantidad_unidades, l.estado as lote_estado
      FROM reservas r
      JOIN lotes l ON l.id = r.lote_id
      WHERE r.id = ${reservaId} AND r.receptor_id = ${user.userId}
      FOR UPDATE
    `;

    if (reserva.length === 0) {
      await sql`ROLLBACK`;
      return c.json({ error: 'Reserva no encontrada' }, 404);
    }

    const lote = reserva[0];

    // Verificar que el lote esté tomado (no ya rescatado ni liberado)
    if (lote.lote_estado !== 'tomado') {
      await sql`ROLLBACK`;
      return c.json({ error: 'El lote no está en estado tomado' }, 400);
    }

    // Verificar que las unidades coincidan con lo publicado
    if (parseInt(unidades) !== lote.cantidad_unidades) {
      await sql`ROLLBACK`;
      return c.json({ error: `Las unidades deben coincidir con lo publicado (${lote.cantidad_unidades})` }, 400);
    }

    // Crear recogida
    await sql`
      INSERT INTO recogidas (reserva_id, unidades, peso_kg_estimado)
      VALUES (${reservaId}, ${unidades}, ${peso_kg_estimado || null})
    `;

    // Marcar lote como rescatado
    await sql`
      UPDATE lotes SET estado = 'rescatado', updated_at = NOW() WHERE id = ${lote.lote_id}
    `;

    await sql`COMMIT`;

    return c.json({
      mensaje: 'Recogida confirmada',
      unidades,
      peso_kg_estimado: peso_kg_estimado || null,
    });
  } catch (e: any) {
    await sql`ROLLBACK`;
    return c.json({ error: 'No se pudo confirmar la recogida' }, 400);
  }
});

export default reservasRoutes;
