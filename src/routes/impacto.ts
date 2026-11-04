import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';
import { authMiddleware } from '../middleware/auth';

const impactoRoutes = new Hono();

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

// Reporte mensual de impacto (solo admin)
impactoRoutes.get('/admin/reporte', authMiddleware, requireRole(['admin']), async (c) => {
  const { mes } = c.req.query(); // formato YYYY-MM
  const sql = getSql(c.env);

  if (!mes) {
    return c.json({ error: 'Parámetro mes requerido (formato YYYY-MM)' }, 400);
  }

  const inicio = `${mes}-01`;
  const fin = `${mes}-01`; // se calcula en SQL

  // Recogidas confirmadas en el mes
  const recogidas = await sql`
    SELECT r.unidades, r.peso_kg_estimado, r.confirmed_at
    FROM recogidas r
    JOIN reservas res ON res.id = r.reserva_id
    JOIN lotes l ON l.id = res.lote_id
    WHERE r.confirmed_at >= ${inicio}::timestamptz
      AND r.confirmed_at < ((${inicio}::timestamptz + interval '1 month'))
  `;

  let kgEstimados = 0;
  let unidadesRescatadas = 0;
  let recogidasCompletadas = recogidas.length;
  const receptoresAtendidos = new Set<string>();

  for (const rec of recogidas) {
    unidadesRescatadas += Number(rec.unidades) || 0;
    if (rec.peso_kg_estimado) {
      kgEstimados += Number(rec.peso_kg_estimado);
    }
  }

  // Receptores únicos que tuvieron recogidas confirmadas en el mes
  const receptores = await sql`
    SELECT DISTINCT res.receptor_id
    FROM recogidas r
    JOIN reservas res ON res.id = r.reserva_id
    WHERE r.confirmed_at >= ${inicio}::timestamptz
      AND r.confirmed_at < ((${inicio}::timestamptz + interval '1 month'))
  `;
  const receptoresAtendidosCount = receptores.length;

  // Lotes publicados en el mes
  const lotesPublicados = await sql`
    SELECT COUNT(*) as total FROM lotes
    WHERE created_at >= ${inicio}::timestamptz
      AND created_at < ((${inicio}::timestamptz + interval '1 month'))
  `;
  const totalLotesPublicados = Number(lotesPublicados[0].total) || 0;

  // Total de reservas creadas en el mes (para calcular %)
  const reservasMes = await sql`
    SELECT COUNT(*) as total FROM reservas
    WHERE created_at >= ${inicio}::timestamptz
      AND created_at < ((${inicio}::timestamptz + interval '1 month'))
  `;
  const totalReservasMes = Number(reservasMes[0].total) || 0;

  const porcentajeCompletadas = totalReservasMes > 0
    ? Math.round((recogidasCompletadas / totalReservasMes) * 100)
    : 0;

  const tasaNoCompletadas = totalReservasMes > 0
    ? Math.round(((totalReservasMes - recogidasCompletadas) / totalReservasMes) * 100)
    : 0;

  const reporte = {
    mes,
    kg_estimados_rescatados: kgEstimados,
    unidades_rescatadas: unidadesRescatadas,
    recogidas_completadas: recogidasCompletadas,
    porcentaje_completadas: porcentajeCompletadas,
    receptores_atendidos: receptoresAtendidosCount,
    lotes_publicados: totalLotesPublicados,
    tasa_recogidas_no_completadas: tasaNoCompletadas,
  };

  // Exportar como CSV si se pide
  if (c.req.query('export') === 'csv') {
    const csv = [
      'Métrica,Valor',
      `kg_estimados_rescatados,${kgEstimados}`,
      `unidades_rescatadas,${unidadesRescatadas}`,
      `recogidas_completadas,${recogidasCompletadas}`,
      `porcentaje_completadas,${porcentajeCompletadas}`,
      `receptores_atendidos,${receptoresAtendidosCount}`,
      `lotes_publicados,${totalLotesPublicados}`,
      `tasa_recogidas_no_completadas,${tasaNoCompletadas}`,
    ].join('\n');

    return c.body(csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=reporte_impacto_${mes}.csv`,
    });
  }

  return c.json(reporte);
});

// Contadores públicos de impacto (página pública)
impactoRoutes.get('/impacto', async (c) => {
  const sql = getSql(c.env);

  // Kg estimados totales rescatados
  const kgResult = await sql`
    SELECT COALESCE(SUM(peso_kg_estimado), 0) as total_kg FROM recogidas WHERE peso_kg_estimado IS NOT NULL
  `;

  // Recogidas completadas totales
  const recogidasResult = await sql`SELECT COUNT(*) as total FROM recogidas`;

  // Receptores atendidos (únicos con al menos una recogida confirmada)
  const receptoresResult = await sql`
    SELECT COUNT(DISTINCT receptor_id) as total FROM reservas
    WHERE id IN (SELECT reserva_id FROM recogidas)
  `;

  return c.json({
    kg_estimados_rescatados: Number(kgResult[0].total_kg) || 0,
    recogidas_completadas: Number(recogidasResult[0].total) || 0,
    receptores_atendidos: Number(receptoresResult[0].total) || 0,
  });
});

export default impactoRoutes;
