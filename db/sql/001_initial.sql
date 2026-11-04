-- RescateLocal — Esquema inicial (v1)
-- Modelo: usuarios, sesiones, lotes, reservas, recogidas, auditoría

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'comercio', 'receptor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad_unidades INTEGER NOT NULL CHECK (cantidad_unidades > 0),
  peso_kg_estimado DECIMAL(10, 2),
  ventana_inicio TIMESTAMPTZ NOT NULL,
  ventana_fin TIMESTAMPTZ NOT NULL,
  direccion_retiro TEXT NOT NULL,
  instrucciones_retiro TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('disponible', 'tomado', 'rescatado', 'vencido', 'liberado', 'cancelado')) DEFAULT 'disponible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  receptor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uno_reserva_por_lote UNIQUE (lote_id)
);

CREATE TABLE IF NOT EXISTS recogidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  unidades INTEGER NOT NULL CHECK (unidades > 0),
  peso_kg_estimado DECIMAL(10, 2),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tabla_afectada TEXT NOT NULL,
  registro_id UUID NOT NULL,
  accion TEXT NOT NULL,
  motivo TEXT NOT NULL,
  valores_anteriores JSONB,
  valores_nuevos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_lotes_estado ON lotes(estado);
CREATE INDEX IF NOT EXISTS idx_lotes_ventana_fin ON lotes(ventana_fin);
CREATE INDEX IF NOT EXISTS idx_reservas_lote_id ON reservas(lote_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
