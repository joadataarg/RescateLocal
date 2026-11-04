# Feature: RescateLocal MVP

**Estado: COMPLETADO — POC funcional localmente**

**Stack:** Cloudflare Workers + Neon (PostgreSQL serverless) + Drizzle ORM + HTML plano server-rendered + Auth con hash de token en Neon + Emails log en Worker + Cron Trigger para vencimientos.

**Base de datos:** Proyecto Neon "RescateLocal" (ID: holy-dream-59364472), rama main (br-raspy-rain-bd9fro4b), 6 tablas creadas: users, sessions, lotes, reservas, recogidas, auditoria.

**Conexión:** DATABASE_URL configurada en wrangler.toml [vars] y .dev.vars (no commitear .dev.vars).

## Las 3 funcionalidades del MVP — todas implementadas y probadas

1. **Publicar lote (comercio):** GET /lotes/nuevo (form HTML), POST /lotes/nuevo, GET /lotes/disponibles, POST /lotes/:id/cancelar. Solo rol comercio.
2. **Reservar y confirmar recogida (receptor):** POST /lotes/:id/reservar (dirección revelada post-reserva), POST /reservas/:id/recoger (unidades deben coincidir con lo publicado). Solo rol receptor. Un lote = una reserva exclusiva.
3. **Registro e impacto:** Cada recogida confirma genera registro en tabla recogidas. GET /admin/reporte?mes=YYYY-MM (exportable CSV), GET /impacto (3 contadores públicos). Solo rol admin para reporte.

## Auth
- POST /auth/register, /auth/login, /auth/logout, /auth/me
- Sesión: 24 horas, token hash en BD, cookie HttpOnly SameSite=Lax
- Roles: admin, comercio, receptor (campo role en users)

## Vencimiento y cron
- POST /cron/vencer-lotes (solo admin): marca lotes disponibles con ventana_fin pasada como 'vencido', y lotes tomados como 'liberado'
- [triggers] crons = ["0 0 * *"] en wrangler.toml (cron diario)
- Handler scheduled en src/index.ts para Cloudflare Cron Trigger
- POST /admin/lotes/:id/correccion (admin): corrige estado con motivo, queda en auditoría

## Archivos creados
package.json, wrangler.toml, drizzle.config.ts, .gitignore, .dev.vars (no commitear),
db/sql/001_initial.sql, src/index.ts, src/db/schema.ts, src/auth.ts,
src/middleware/auth.ts, src/routes/auth.ts, src/routes/lotes.ts,
src/routes/reservas.ts, src/routes/impacto.ts, src/routes/vencimiento.ts,
odd/tasks/rescatelocal-mvp.md

## Endpoints resumen
GET / | POST /auth/{register,login,logout,me} | GET/POST /lotes/nuevo | GET /lotes/disponibles | POST /lotes/:id/cancelar | POST /lotes/:id/reservar | GET/POST /reservas/:id | POST /reservas/:id/recoger | GET /impacto | GET /admin/reporte?mes=YYYY-MM[&export=csv] | POST /cron/vencer-lotes | POST /admin/lotes/:id/correccion

## Próximos pasos sugeridos
- git add + commit (Convencional Commit: feat: POC RescateLocal MVP)
- wrangler deploy para desplegar en Cloudflare Workers
- Probar el cron trigger en producción
- Agregar tests de integración