import { pgTable, uuid, text, integer, decimal, timestamp, pgEnum, check, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['admin', 'comercio', 'receptor']);
export const estadoLoteEnum = pgEnum('estado', ['disponible', 'tomado', 'rescatado', 'vencido', 'liberado', 'cancelado']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lotes = pgTable('lotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  comercioId: uuid('comercio_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  descripcion: text('descripcion').notNull(),
  cantidadUnidades: integer('cantidad_unidades').notNull(),
  pesoKgEstimado: decimal('peso_kg_estimado', { precision: 10, scale: 2 }),
  ventanaInicio: timestamp('ventana_inicio', { withTimezone: true }).notNull(),
  ventanaFin: timestamp('ventana_fin', { withTimezone: true }).notNull(),
  direccionRetiro: text('direccion_retiro').notNull(),
  instruccionesRetiro: text('instrucciones_retiro'),
  estado: estadoLoteEnum('estado').notNull().default('disponible'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('cantidad_unidades_gt_0', sql`${table.cantidadUnidades} > 0`),
]);

export const reservas = pgTable('reservas', {
  id: uuid('id').primaryKey().defaultRandom(),
  loteId: uuid('lote_id').notNull().references(() => lotes.id, { onDelete: 'cascade' }),
  receptorId: uuid('receptor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Un lote tiene como máximo una reserva activa
  // Nota: la unicidad real se aplica en SQL con UNIQUE (lote_id)
]);

export const recogidas = pgTable('recogidas', {
  id: uuid('id').primaryKey().defaultRandom(),
  reservaId: uuid('reserva_id').notNull().references(() => reservas.id, { onDelete: 'cascade' }),
  unidades: integer('unidades').notNull(),
  pesoKgEstimado: decimal('peso_kg_estimado', { precision: 10, scale: 2 }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('unidades_gt_0', sql`${table.unidades} > 0`),
]);

export const auditoria = pgTable('auditoria', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tablaAfectada: text('tabla_afectada').notNull(),
  registroId: uuid('registro_id').notNull(),
  accion: text('accion').notNull(),
  motivo: text('motivo').notNull(),
  valoresAnteriores: jsonb('valores_anteriores'),
  valoresNuevos: jsonb('valores_nuevos'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
