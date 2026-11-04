import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import lotesRoutes from './routes/lotes';
import reservasRoutes from './routes/reservas';
import impactoRoutes from './routes/impacto';
import vencimientoRoutes from './routes/vencimiento';
import dashboardRoutes from './routes/dashboard';
import { authMiddleware, requireRole } from './middleware/auth';

export interface Env {
  DATABASE_URL: string;
  APP_NAME: string;
}

const app = new Hono();

app.use('*', cors());

app.get('/login', (c) => c.redirect('/auth/login'));
app.get('/register', (c) => c.redirect('/auth/register'));

app.get('/', async (c) => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(c.env.DATABASE_URL);

  const lotes = await sql`
    SELECT id, descripcion, cantidad_unidades, peso_kg_estimado, ventana_fin
    FROM lotes
    WHERE estado = 'disponible' AND ventana_fin > NOW()
    ORDER BY ventana_fin ASC
    LIMIT 20
  `;

  const lotesHtml = lotes.length > 0
    ? `
      <div class="lotes-grid">
        ${lotes.map(l => `
          <article class="lote-card">
            <h4>${l.descripcion}</h4>
            <p><strong>${l.cantidad_unidades}</strong> unidades${l.peso_kg_estimado ? ' · ' + l.peso_kg_estimado + ' kg est.' : ''}</p>
            <p>Retiro hasta: ${new Date(l.ventana_fin).toLocaleString()}</p>
          </article>
        `).join('')}
      </div>
    `
    : `
      <div class="empty-lotes">
        <p>No hay lotes disponibles en este momento. Vuelve pronto.</p>
      </div>
    `;

  return c.html(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RescateLocal — Rescata comida, alimenta a quien lo necesita</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; background: #ffffff; }
    .navbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #e5e7eb; background: #fff; position: sticky; top: 0; z-index: 100; }
    .navbar .logo { font-weight: 800; font-size: 20px; color: #0f766e; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .navbar .nav-links { display: flex; gap: 12px; align-items: center; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; }
    .btn-primary { background: #0f766e; color: #fff; }
    .btn-primary:hover { background: #0d5e56; }
    .btn-ghost { background: transparent; color: #374151; border: 1px solid #d1d5db; }
    .btn-ghost:hover { background: #f9fafb; }
    .nav-text { color: #4b5563; font-size: 14px; }
    .nav-text a { color: #0f766e; text-decoration: none; font-weight: 600; }
    .nav-text a:hover { text-decoration: underline; }
    .nav-link { color: #374151; text-decoration: none; font-size: 14px; font-weight: 500; }
    .nav-link:hover { color: #0f766e; }
    .hero { padding: 60px 20px; text-align: center; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%); }
    .hero h1 { font-size: 42px; font-weight: 800; color: #065f46; margin-bottom: 16px; line-height: 1.2; }
    .hero p { font-size: 18px; color: #374151; max-width: 600px; margin: 0 auto 24px auto; }
    .hero-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .lotes-section { padding: 48px 20px; background: #fff; }
    .lotes-section h2 { text-align: center; font-size: 24px; color: #111827; margin-bottom: 8px; }
    .lotes-sub { text-align: center; color: #6b7280; margin-bottom: 30px; font-size: 16px; }
    .lotes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; max-width: 900px; margin: 0 auto; }
    .lote-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; }
    .lote-card h4 { font-size: 16px; color: #111827; margin-bottom: 8px; }
    .lote-card p { color: #4b5563; font-size: 14px; margin: 4px 0; }
    .empty-lotes { text-align: center; color: #6b7280; font-size: 16px; padding: 40px; }
    .features { padding: 48px 20px; background: #f9fafb; }
    .features h2 { text-align: center; font-size: 24px; color: #111827; margin-bottom: 8px; }
    .features-sub { text-align: center; color: #6b7280; margin-bottom: 40px; font-size: 16px; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; max-width: 900px; margin: 0 auto; }
    .feature-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; }
    .impact-grid { display: flex; gap: 16px; max-width: 1200px; margin: 0 auto; overflow-x: auto; }
    .impact-grid .feature-card { flex: 1; min-width: 280px; }
    .feature-card h3 { font-size: 16px; color: #0f766e; margin-bottom: 10px; }
    .feature-card p { color: #4b5563; font-size: 14px; }
    .how-it-works { padding: 48px 20px; background: #fff; }
    .how-it-works h2 { text-align: center; font-size: 24px; color: #111827; margin-bottom: 8px; }
    .steps { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; max-width: 900px; margin: 30px auto 0; }
    .step { flex: 1; min-width: 240px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; text-align: center; position: relative; }
    .step-number { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #0f766e; color: #fff; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 3px solid #fff; }
    .step h3 { font-size: 16px; color: #111827; margin: 12px 0 8px; }
    .step p { color: #4b5563; font-size: 14px; }
    .footer { padding: 32px 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <nav class="navbar">
    <a href="/" class="logo">RescateLocal</a>
    <div class="nav-links">
      <a href="/" class="nav-link">Inicio</a>
      <a href="/lotes/disponibles" class="nav-link">Lotes disponibles</a>
      <a href="#colaborador" class="nav-link">Quiero ser colaborador</a>
      <span class="nav-text">¿No tenés cuenta? <a href="/auth/register">Registrate</a></span>
      <a href="/auth/login" class="btn btn-primary">Iniciar sesión</a>
    </div>
  </nav>

  <section class="hero">
    <h1>Rescata comida, alimenta a quien lo necesita</h1>
    <p>Conectamos comercios con excedentes de comida a comedores, instituciones y vecinos que los necesitan. Menos comida en la basura, más comida en la mesa.</p>
  </section>

  <section class="lotes-section">
    <h2>Lotes disponibles ahora</h2>
    <p class="lotes-sub">Excedentes de comida listos para ser rescatados</p>
    ${lotesHtml}
  </section>

  <section class="features">
    <h2>Cómo funciona RescateLocal</h2>
    <p class="features-sub">Tres pasos simples para rescatar alimentos y medir el impacto</p>
    <div class="features-grid">
      <div class="feature-card">
        <h3>1. El comercio publica</h3>
        <p>Publica un lote con cantidad, ventana de retiro y dirección. Mientras esté disponible, puede cancelarlo.</p>
      </div>
      <div class="feature-card">
        <h3>2. El receptor reserva</h3>
        <p>Ve los lotes disponibles, reserva uno y accede a la dirección exacta solo después de reservar.</p>
      </div>
      <div class="feature-card">
        <h3>3. Se confirma el rescate</h3>
        <p>El receptor confirma la recogida y queda registrado el impacto: unidades y kg estimados rescatados.</p>
      </div>
    </div>
  </section>

  <section class="how-it-works">
    <h2>El ciclo de un lote</h2>
    <div class="steps">
      <div class="step">
        <div class="step-number">1</div>
        <h3>Disponible</h3>
        <p>El comercio publica el lote y queda visible para receptores.</p>
      </div>
      <div class="step">
        <div class="step-number">2</div>
        <h3>Tomado</h3>
        <p>Un receptor lo reserva. Queda exclusivo para él.</p>
      </div>
      <div class="step">
        <div class="step-number">3</div>
        <h3>Rescatado</h3>
        <p>El receptor confirma la recogida y queda el registro de impacto.</p>
      </div>
    </div>
  </section>

  <section class="features" style="background: #fff;">
    <h2>El impacto que generamos</h2>
    <p class="features-sub">Cada rescate cuenta. Medimos el resultado para demostrar que la coordinación digital funciona.</p>
    <div class="impact-grid">
      <div class="feature-card">
        <h3>🍽️ Menos comida desperdiciada</h3>
        <p>Los comercios publican sus excedentes antes de que se los tiren. Cada lote rescatado es alimento que llega a la mesa en vez de a la basura.</p>
      </div>
      <div class="feature-card">
        <h3>📊 Registro medible</h3>
        <p>Cada recogida confirmada queda registrada con unidades y kg estimados rescatados. Sin registro, no hay impacto demostrable.</p>
      </div>
      <div class="feature-card">
        <h3>🤝 Coordinación simple</h3>
        <p>Sin apps, sin mapas, sin logística compleja. Un comercio publica, un receptor reserva y retira. Tres pasos, sin barreras tecnológicas.</p>
      </div>
      <div class="feature-card">
        <h3>📈 Reporte mensual</h3>
        <p>El administrador genera reportes con kg rescatados, recogidas completadas y receptores atendidos. Datos reales para sostener el proyecto.</p>
      </div>
    </div>
  </section>

  <section class="collaborator-section" style="padding: 48px 20px; background: #f3f4f6;">
    <div class="collab-container" style="max-width: 1100px; margin: 0 auto; display: flex; gap: 32px; flex-wrap: wrap;">
      <div class="collab-form" style="flex: 1; min-width: 300px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <h2 style="font-size: 20px; color: #0f766e; margin-bottom: 16px;">Quiero ser colaborador</h2>
        <p style="color: #4b5563; font-size: 14px; margin-bottom: 20px;">Cuéntanos quién eres para orientarte mejor en la plataforma.</p>
        <form id="colabForm" style="display: flex; flex-direction: column; gap: 14px;">
          <label style="font-weight: 600; font-size: 14px; color: #374151;">Nombre completo</label>
          <input type="text" name="nombre" placeholder="Juan Pérez" required style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
          <label style="font-weight: 600; font-size: 14px; color: #374151;">Email</label>
          <input type="email" name="email" placeholder="tu@email.com" required style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
          <label style="font-weight: 600; font-size: 14px; color: #374151;">¿Qué deseas hacer en RescateLocal?</label>
          <select name="tipo" required style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            <option value="">Seleccionar...</option>
            <option value="comercio">Soy un comercio (entrego excedentes de comida)</option>
            <option value="receptor">Soy un receptor o institución (retiro y recibo alimentos)</option>
          </select>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 8px;">Enviar solicitud</button>
        </form>
        <div id="colabMsg" style="margin-top: 12px; font-size: 14px; text-align: center;"></div>
      </div>

      <div class="collab-faq" style="flex: 1; min-width: 300px;">
        <h2 style="font-size: 20px; color: #0f766e; margin-bottom: 16px;">Preguntas frecuentes</h2>
        <div class="faq-accordion" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <button class="faq-question" style="width: 100%; padding: 14px 16px; text-align: left; background: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px; color: #111827;" onclick="toggleFaq(this)">
              ¿Qué es RescateLocal?
              <span style="float: right; font-size: 18px; color: #0f766e;">▾</span>
            </button>
            <div class="faq-answer" style="padding: 0 16px 14px 16px; color: #4b5563; font-size: 14px; line-height: 1.5; display: none;">
              Es una plataforma que conecta comercios con excedentes de comida a comedores, instituciones y vecinos que los necesitan, dejando registro del rescate para demostrar impacto.
            </div>
          </div>
          <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <button class="faq-question" style="width: 100%; padding: 14px 16px; text-align: left; background: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px; color: #111827;" onclick="toggleFaq(this)">
              ¿Quién puede ser comercio?
              <span style="float: right; font-size: 18px; color: #0f766e;">▾</span>
            </button>
            <div class="faq-answer" style="padding: 0 16px 14px 16px; color: #4b5563; font-size: 14px; line-height: 1.5; display: none;">
              Cualquier comercio que genere excedentes de comida apta para consumo: panaderías, verdulerías, restaurantes, almacenes y supermercados chicos.
            </div>
          </div>
          <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <button class="faq-question" style="width: 100%; padding: 14px 16px; text-align: left; background: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px; color: #111827;" onclick="toggleFaq(this)">
              ¿Quién puede ser receptor?
              <span style="float: right; font-size: 18px; color: #0f766e;">▾</span>
            </button>
            <div class="faq-answer" style="padding: 0 16px 14px 16px; color: #4b5563; font-size: 14px; line-height: 1.5; display: none;">
              Comedores, merenderos, escuelas, iglesias, instituciones y vecinos individuales con necesidad de alimentos.
            </div>
          </div>
          <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <button class="faq-question" style="width: 100%; padding: 14px 16px; text-align: left; background: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px; color: #111827;" onclick="toggleFaq(this)">
              ¿Cuánto cuesta usar la plataforma?
              <span style="float: right; font-size: 18px; color: #0f766e;">▾</span>
            </button>
            <div class="faq-answer" style="padding: 0 16px 14px 16px; color: #4b5563; font-size: 14px; line-height: 1.5; display: none;">
              Es gratuita. No hay pagos ni donaciones monetarias involucradas en el MVP.
            </div>
          </div>
          <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <button class="faq-question" style="width: 100%; padding: 14px 16px; text-align: left; background: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px; color: #111827;" onclick="toggleFaq(this)">
              ¿Cómo sé si mis alimentos son aptos para donar?
              <span style="float: right; font-size: 18px; color: #0f766e;">▾</span>
            </button>
            <div class="faq-answer" style="padding: 0 16px 14px 16px; color: #4b5563; font-size: 14px; line-height: 1.5; display: none;">
              Al publicar, el comercio declara que los alimentos son aptos y asume la responsabilidad legal sobre ellos.
            </div>
          </div>
          <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <button class="faq-question" style="width: 100%; padding: 14px 16px; text-align: left; background: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px; color: #111827;" onclick="toggleFaq(this)">
              ¿Qué pasa si no retiro mi lote a tiempo?
              <span style="float: right; font-size: 18px; color: #0f766e;">▾</span>
            </button>
            <div class="faq-answer" style="padding: 0 16px 14px 16px; color: #4b5563; font-size: 14px; line-height: 1.5; display: none;">
              Si el lote está reservado y no se retira dentro de la ventana de retiro, se libera automáticamente para que otro receptor pueda tomarlo. Si nadie lo reserva antes del fin de la ventana, el lote se marca como vencido.
            </div>
          </div>
          <div class="faq-item" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <button class="faq-question" style="width: 100%; padding: 14px 16px; text-align: left; background: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 14px; color: #111827;" onclick="toggleFaq(this)">
              ¿Cómo funciona el reporte de impacto mensual?
              <span style="float: right; font-size: 18px; color: #0f766e;">▾</span>
            </button>
            <div class="faq-answer" style="padding: 0 16px 14px 16px; color: #4b5563; font-size: 14px; line-height: 1.5; display: none;">
              El administrador genera un reporte mensual con kg estimados rescatados, unidades rescatadas, recogidas completadas, porcentaje de completadas y receptores atendidos. El reporte es exportable en CSV.
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <script>
    function toggleFaq(btn) {
      const answer = btn.nextElementSibling;
      const isOpen = answer.style.display === 'block';
      document.querySelectorAll('.faq-answer').forEach(a => a.style.display = 'none');
      if (!isOpen) answer.style.display = 'block';
    }
  </script>

  <footer class="footer" style="padding: 40px 20px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
    <div style="max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; text-align: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="font-weight: 800; font-size: 18px; color: #0f766e;">RescateLocal</div>
        <div style="display: flex; gap: 24px; font-size: 14px; color: #4b5563;">
          <a href="/" style="color: #374151; text-decoration: none;">Inicio</a>
          <a href="/lotes/disponibles" style="color: #374151; text-decoration: none;">Lotes disponibles</a>
          <a href="#colaborador" style="color: #374151; text-decoration: none;">Ser colaborador</a>
          <a href="/auth/login" style="color: #374151; text-decoration: none;">Iniciar sesión</a>
        </div>
      </div>
      <div style="color: #6b7280; font-size: 13px;">
        RescateLocal — MVP · Plataforma de coordinación de excedentes alimentarios<br>
        <span style="font-size: 12px; color: #9ca3af;">© 2026 RescateLocal. Código abierto para el rescate de alimentos.</span>
      </div>
    </div>
  </footer>
</body>
</html>`);
});

app.route('/auth', authRoutes);
app.route('/lotes', lotesRoutes);
app.route('', reservasRoutes);
app.route('', impactoRoutes);
app.route('', vencimientoRoutes);
app.route('', dashboardRoutes);

app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

export default {
  fetch: app.fetch,
  scheduled: async (event: any, env: any, ctx: any) => {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(env.DATABASE_URL);
    const ahora = new Date().toISOString();

    try {
      await sql`BEGIN`;
      await sql`UPDATE lotes SET estado = 'vencido', updated_at = NOW() WHERE estado = 'disponible' AND ventana_fin < ${ahora}`;
      await sql`UPDATE lotes SET estado = 'liberado', updated_at = NOW() WHERE estado = 'tomado' AND ventana_fin < ${ahora}`;
      await sql`COMMIT`;
    } catch (e) {
      await sql`ROLLBACK`;
    }
  },
} satisfies ExportedHandler<Env>;
