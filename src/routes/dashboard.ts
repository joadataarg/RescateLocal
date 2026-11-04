import { Hono } from 'hono';
import { neon } from '@neondatabase/serverless';

const dashboardRoutes = new Hono();

function getSql(env: any) {
  return neon(env.DATABASE_URL);
}

// Middleware: verifica sesión, redirige a login si no autenticado
async function requireAuth(c: any, next: any) {
  const cookie = c.req.header('Cookie');
  let token: string | null = null;
  if (cookie) {
    const match = cookie.match(/session_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) {
    return c.redirect('/auth/login');
  }

  const sql = getSql(c.env);
  const tokenHash = await (await import('../auth')).sha256(token);
  const result = await sql`
    SELECT s.user_id, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
    AND s.expires_at > NOW()
  `;

  if (result.length === 0) {
    return c.redirect('/auth/login');
  }

  c.set('user', { userId: result[0].user_id, role: result[0].role });
  await next();
}

// Redirige al dashboard según el rol
dashboardRoutes.get('/dashboard', requireAuth, async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  return c.redirect(`/dashboard/${user.role}`);
});

// ============================
// DASHBOARD COMERCIO
// ============================
dashboardRoutes.get('/dashboard/comercio', requireAuth, async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const sql = getSql(c.env);

  const lotes = await sql`
    SELECT id, descripcion, cantidad_unidades, peso_kg_estimado,
           ventana_inicio, ventana_fin, direccion_retiro, estado, created_at
    FROM lotes
    WHERE comercio_id = ${user.userId}
    ORDER BY created_at DESC
  `;

  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Comercio — RescateLocal</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px 16px; line-height: 1.6; color: #1a1a1a; background: #f3f4f6; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { color: #0f766e; margin: 0; }
    .btn { display: inline-block; background: #0f766e; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .btn.secondary { background: #6b7280; }
    .btn.danger { background: #dc2626; }
    .btn:hover { opacity: 0.9; }
    .card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; border: 1px solid #e5e7eb; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .badge.disponible { background: #dcfce7; color: #166534; }
    .badge.tomado { background: #fef3c7; color: #92400e; }
    .badge.rescatado { background: #dbeafe; color: #1e40af; }
    .badge.vencido { background: #fee2e2; color: #991b1b; }
    .badge.liberado { background: #e5e7eb; color: #374151; }
    .badge.cancelado { background: #f3f4f6; color: #4b5563; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    th { background: #f9fafb; font-weight: 700; color: #374151; }
    .empty { color: #6b7280; font-style: italic; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .user-role { background: #0f766e; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <div class="user-info">
      <span class="user-role">COMERCIO</span>
      <span>👋 ${user.userId}</span>
    </div>
    <a href="/auth/logout" class="btn secondary">Cerrar sesión</a>
  </header>

  <h1>Mis lotes</h1>

  <div class="card">
    <h2 style="margin-top:0">Publicar nuevo lote</h2>
    <form id="nuevoLote" style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <label>Descripción</label>
      <input type="text" name="descripcion" placeholder="Ej: Pan fresco del día" required style="grid-column: span 2; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <label>Cantidad (unidades)</label>
      <input type="number" name="cantidad_unidades" min="1" required value="10" style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <label>Peso estimado (kg, opcional)</label>
      <input type="number" name="peso_kg_estimado" step="0.01" min="0" placeholder="0.00" style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <label>Ventana de retiro — Inicio</label>
      <input type="datetime-local" name="ventana_inicio" required style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <label>Ventana de retiro — Fin</label>
      <input type="datetime-local" name="ventana_fin" required style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <label>Dirección de retiro</label>
      <input type="text" name="direccion_retiro" placeholder="Ej: Calle Falsa 123" required style="grid-column: span 2; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <label>Instrucciones (opcional)</label>
      <textarea name="instrucciones_retiro" rows="2" placeholder="Ej: Timbrar al 2B" style="grid-column: span 2; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;"></textarea>
      <button type="submit" class="btn" style="grid-column: span 2;">Publicar lote</button>
    </form>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Mis lotes publicados</h2>
    <table>
      <thead>
        <tr>
          <th>Descripción</th>
          <th>Unidades</th>
          <th>Kg est.</th>
          <th>Ventana fin</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${lotes.length === 0
          ? '<tr><td colspan="6" class="empty">No tienes lotes publicados aún.</td></tr>'
          : lotes.map(l => `
            <tr>
              <td>${l.descripcion}</td>
              <td>${l.cantidad_unidades}</td>
              <td>${l.peso_kg_estimado || '—'}</td>
              <td>${new Date(l.ventana_fin).toLocaleString()}</td>
              <td><span class="badge ${l.estado}">${l.estado}</span></td>
              <td>${l.estado === 'disponible'
                ? `<button class="btn danger btn-sm" onclick="cancelar('${l.id}')">Cancelar</button>`
                : '—'
              }</td>
            </tr>
          `).join('')}
      </tbody>
    </table>
  </div>

  <script>
    async function cancelar(loteId) {
      if (!confirm('¿Cancelar este lote?')) return;
      const res = await fetch('/lotes/' + loteId + '/cancelar', { method: 'POST' });
      if (res.ok) location.reload();
      else alert('No se pudo cancelar');
    }
  </script>
</body>
</html>`);
});

// ============================
// DASHBOARD RECEPTOR
// ============================
dashboardRoutes.get('/dashboard/receptor', requireAuth, async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const sql = getSql(c.env);

  const reservas = await sql`
    SELECT r.id, r.created_at,
           l.descripcion, l.cantidad_unidades, l.peso_kg_estimado,
           l.ventana_inicio, l.ventana_fin, l.direccion_retiro, l.instrucciones_retiro, l.estado
    FROM reservas r
    JOIN lotes l ON l.id = r.lote_id
    WHERE r.receptor_id = ${user.userId}
    ORDER BY r.created_at DESC
  `;

  const disponibles = await sql`
    SELECT l.id, l.descripcion, l.cantidad_unidades, l.peso_kg_estimado,
           l.ventana_inicio, l.ventana_fin, l.comercio_id
    FROM lotes l
    WHERE l.estado = 'disponible' AND l.ventana_fin > NOW()
    ORDER BY l.ventana_fin ASC
  `;

  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Receptor — RescateLocal</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px 16px; line-height: 1.6; color: #1a1a1a; background: #f3f4f6; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { color: #0f766e; margin: 0; }
    .btn { display: inline-block; background: #0f766e; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .btn.secondary { background: #6b7280; }
    .btn.danger { background: #dc2626; }
    .btn:hover { opacity: 0.9; }
    .card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; border: 1px solid #e5e7eb; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .badge.disponible { background: #dcfce7; color: #166534; }
    .badge.tomado { background: #fef3c7; color: #92400e; }
    .badge.rescatado { background: #dbeafe; color: #1e40af; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    th { background: #f9fafb; font-weight: 700; color: #374151; }
    .empty { color: #6b7280; font-style: italic; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .user-role { background: #0f766e; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .direccion { background: #f9fafb; padding: 12px; border-radius: 6px; margin-top: 8px; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <div class="user-info">
      <span class="user-role">RECEPTOR</span>
      <span>👋 ${user.userId}</span>
    </div>
    <a href="/auth/logout" class="btn secondary">Cerrar sesión</a>
  </header>

  <h1>Lotes disponibles</h1>
  <div class="card">
    ${disponibles.length === 0
      ? '<p class="empty">No hay lotes disponibles en este momento.</p>'
      : `
        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Unidades</th>
              <th>Kg est.</th>
              <th>Ventana fin</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${disponibles.map(l => `
              <tr>
                <td>${l.descripcion}</td>
                <td>${l.cantidad_unidades}</td>
                <td>${l.peso_kg_estimado || '—'}</td>
                <td>${new Date(l.ventana_fin).toLocaleString()}</td>
                <td>
                  <button class="btn" onclick="reservar('${l.id}')">Reservar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    }
  </div>

  <div class="card">
    <h2 style="margin-top:0">Mis reservas</h2>
    <table>
      <thead>
        <tr>
          <th>Lote</th>
          <th>Unidades</th>
          <th>Estado</th>
          <th>Dirección de retiro</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${reservas.length === 0
          ? '<tr><td colspan="5" class="empty">No tienes reservas aún.</td></tr>'
          : reservas.map(r => `
            <tr>
              <td>${r.descripcion}</td>
              <td>${r.cantidad_unidades}</td>
              <td><span class="badge ${r.estado}">${r.estado}</span></td>
              <td>${r.direccion_retiro || '<span class="empty">—</span>'}</td>
              <td>
                ${r.estado === 'tomado'
                  ? `<button class="btn" onclick="recoger('${r.id}', ${r.cantidad_unidades})">Confirmar recogida</button>`
                  : '—'
                }
              </td>
            </tr>
          `).join('')}
      </tbody>
    </table>
  </div>

  <script>
    async function reservar(loteId) {
      const res = await fetch('/lotes/' + loteId + '/reservar', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('Lote reservado. Dirección: ' + data.direccion_retiro);
        location.reload();
      } else {
        alert('Error: ' + (data.error || 'desconocido'));
      }
    }

    async function recoger(reservaId, unidades) {
      if (!confirm('¿Confirmar recogida de ' + unidades + ' unidades?')) return;
      const res = await fetch('/reservas/' + reservaId + '/recoger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidades: unidades })
      });
      if (res.ok) {
        alert('¡Recogida confirmada!');
        location.reload();
      } else {
        const data = await res.json();
        alert('Error: ' + (data.error || 'desconocido'));
      }
    }
  </script>
</body>
</html>`);
});

// ============================
// DASHBOARD ADMIN
// ============================
dashboardRoutes.get('/dashboard/admin', requireAuth, async (c) => {
  const user = c.get('user') as { userId: string; role: string };
  const sql = getSql(c.env);

  const mes = new Date().toISOString().slice(0, 7); // YYYY-MM

  const reporte = await sql`
    SELECT r.unidades, r.peso_kg_estimado
    FROM recogidas r
    JOIN reservas res ON res.id = r.reserva_id
    WHERE r.confirmed_at >= ${mes + '-01'}::timestamptz
      AND r.confirmed_at < ((${mes + '-01'}::timestamptz + interval '1 month'))
  `;

  let kgEstimados = 0;
  let unidadesRescatadas = 0;
  for (const rec of reporte) {
    unidadesRescatadas += Number(rec.unidades) || 0;
    if (rec.peso_kg_estimado) kgEstimados += Number(rec.peso_kg_estimado);
  }

  const recogidasCompletadas = reporte.length;

  const reservasMes = await sql`
    SELECT COUNT(*) as total FROM reservas
    WHERE created_at >= ${mes + '-01'}::timestamptz
      AND created_at < ((${mes + '-01'}::timestamptz + interval '1 month'))
  `;
  const totalReservasMes = Number(reservasMes[0].total) || 0;
  const porcentaje = totalReservasMes > 0 ? Math.round((recogidasCompletadas / totalReservasMes) * 100) : 0;

  const receptoresMes = await sql`
    SELECT COUNT(DISTINCT receptor_id) as total FROM reservas
    WHERE id IN (SELECT reserva_id FROM recogidas)
      AND created_at >= ${mes + '-01'}::timestamptz
      AND created_at < ((${mes + '-01'}::timestamptz + interval '1 month'))
  `;
  const receptoresAtendidos = Number(receptoresMes[0].total) || 0;

  const lotesMes = await sql`
    SELECT COUNT(*) as total FROM lotes
    WHERE created_at >= ${mes + '-01'}::timestamptz
      AND created_at < ((${mes + '-01'}::timestamptz + interval '1 month'))
  `;
  const lotesPublicados = Number(lotesMes[0].total) || 0;

  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard Admin — RescateLocal</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px 16px; line-height: 1.6; color: #1a1a1a; background: #f3f4f6; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { color: #0f766e; margin: 0; }
    .btn { display: inline-block; background: #0f766e; color: #fff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .btn.secondary { background: #6b7280; }
    .btn:hover { opacity: 0.9; }
    .card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 16px; border: 1px solid #e5e7eb; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .metric { background: #fff; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb; }
    .metric .valor { font-size: 28px; font-weight: 800; color: #0f766e; }
    .metric .etiqueta { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .user-role { background: #0f766e; color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .mes-select { padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <div class="user-info">
      <span class="user-role">ADMINISTRADOR</span>
      <span>👋 ${user.userId}</span>
    </div>
    <a href="/auth/logout" class="btn secondary">Cerrar sesión</a>
  </header>

  <h1>Reporte de Impacto</h1>

  <div class="card" style="margin-bottom: 20px;">
    <label for="mes">Mes:</label>
    <select id="mes" class="mes-select" onchange="cambiarMes()">${Array.from({length: 12}, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      const y = new Date().getFullYear();
      const val = y + '-' + m;
      const sel = val === mes ? 'selected' : '';
      return '<option value="' + val + '" ' + sel + '>' + y + '-' + m + '</option>';
    }).join('')}</select>
    <a href="/admin/reporte?mes=' + ${JSON.stringify(mes)} + '&export=csv" class="btn secondary" style="float: right;">Exportar CSV</a>
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="valor">${kgEstimados}</div>
      <div class="etiqueta">Kg estimados rescatados</div>
    </div>
    <div class="metric">
      <div class="valor">${unidadesRescatadas}</div>
      <div class="etiqueta">Unidades rescatadas</div>
    </div>
    <div class="metric">
      <div class="valor">${recogidasCompletadas}</div>
      <div class="etiqueta">Recogidas completadas</div>
    </div>
    <div class="metric">
      <div class="valor">${porcentaje}%</div>
      <div class="etiqueta">% recogidas completadas</div>
    </div>
    <div class="metric">
      <div class="valor">${receptoresAtendidos}</div>
      <div class="etiqueta">Receptores atendidos</div>
    </div>
    <div class="metric">
      <div class="valor">${lotesPublicados}</div>
      <div class="etiqueta">Lotes publicados</div>
    </div>
  </div>

  <div class="card">
    <h2 style="margin-top:0">Acciones de admin</h2>
    <p>Corregir estado de un lote:</p>
    <form id="correccionForm" style="display:grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; align-items: end;">
      <input type="text" id="loteId" placeholder="ID del lote" style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <select id="nuevoEstado" style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
        <option value="disponible">Disponible</option>
        <option value="tomado">Tomado</option>
        <option value="rescatado">Rescatado</option>
        <option value="vencido">Vencido</option>
        <option value="liberado">Liberado</option>
        <option value="cancelado">Cancelado</option>
      </select>
      <input type="text" id="motivo" placeholder="Motivo" style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px;">
      <button type="submit" class="btn">Corregir</button>
    </form>
    <div id="correccionMsg"></div>
  </div>

  <script>
    function cambiarMes() {
      const mes = document.getElementById('mes').value;
      window.location.href = '/dashboard/admin?mes=' + mes;
    }

    document.getElementById('correccionForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const loteId = document.getElementById('loteId').value;
      const nuevoEstado = document.getElementById('nuevoEstado').value;
      const motivo = document.getElementById('motivo').value;
      const msg = document.getElementById('correccionMsg');

      const res = await fetch('/admin/lotes/' + loteId + '/correccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado, motivo: motivo })
      });
      if (res.ok) {
        msg.innerHTML = '<div style="color:#059669">Estado corregido correctamente.</div>';
        setTimeout(() => location.reload(), 1000);
      } else {
        const data = await res.json();
        msg.innerHTML = '<div style="color:#dc2626">Error: ' + (data.error || 'desconocido') + '</div>';
      }
    });
  </script>
</body>
</html>`);
});

export default dashboardRoutes;
