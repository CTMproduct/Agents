const { Pool } = require('pg');

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = POSTGRES_URL
  ? new Pool({
      connectionString: POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

let pgReady = false;

async function initPostgres() {
  if (!pool) {
    return false;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        asistente_nombre TEXT,
        pregunta TEXT NOT NULL,
        respuesta TEXT NOT NULL,
        usuario_nombre TEXT,
        usuario_email TEXT,
        usuario_id TEXT,
        region TEXT,
        status TEXT,
        score_promedio DOUBLE PRECISION,
        timestamp TIMESTAMPTZ,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      )
    `);

    // Agregar nuevas columnas si no existen (retrocompatible)
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'No especificado';
    `);
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS origen_pais TEXT DEFAULT 'No especificado';
    `);
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pregunta_base TEXT;
    `);
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS fuente TEXT DEFAULT 'GPT_ACTION';
    `);
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tipo_interaccion TEXT DEFAULT 'respuesta_gpt';
    `);

    pgReady = true;
    console.log('✅ PostgreSQL connected and conversation table initialized');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL initialization error:', error.message);
    return false;
  }
}

function isPostgresConnected() {
  return !!(pgReady && pool);
}

async function saveConversationPostgres(data) {
  if (!pool) {
    throw new Error('PostgreSQL no configurado');
  }

  const query = `
    INSERT INTO conversations (
      id,
      asistente_nombre,
      pregunta,
      respuesta,
      usuario_nombre,
      usuario_email,
      usuario_id,
      region,
      status,
      score_promedio,
      timestamp,
      created_at,
      updated_at,
      categoria,
      origen_pais,
      pregunta_base,
      fuente,
      tipo_interaccion
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT (id) DO UPDATE SET
      asistente_nombre = EXCLUDED.asistente_nombre,
      pregunta = EXCLUDED.pregunta,
      respuesta = EXCLUDED.respuesta,
      usuario_nombre = EXCLUDED.usuario_nombre,
      usuario_email = EXCLUDED.usuario_email,
      usuario_id = EXCLUDED.usuario_id,
      region = EXCLUDED.region,
      status = EXCLUDED.status,
      score_promedio = EXCLUDED.score_promedio,
      timestamp = EXCLUDED.timestamp,
      updated_at = EXCLUDED.updated_at,
      categoria = EXCLUDED.categoria,
      origen_pais = EXCLUDED.origen_pais,
      pregunta_base = EXCLUDED.pregunta_base,
      fuente = EXCLUDED.fuente,
      tipo_interaccion = EXCLUDED.tipo_interaccion
    RETURNING *;
  `;

  const values = [
    data.id,
    data.asistente_nombre,
    data.pregunta,
    data.respuesta,
    data.usuario_nombre,
    data.usuario_email,
    data.usuario_id,
    data.region,
    data.status,
    data.score_promedio,
    data.timestamp,
    data.timestamp,
    new Date().toISOString(),
    data.categoria || 'No especificado',
    data.origen_pais || 'No especificado',
    data.pregunta_base || null,
    data.fuente || 'GPT_ACTION',
    data.tipo_interaccion || 'respuesta_gpt',
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getConversationsPostgres(limit = 100) {
  if (!pool) {
    throw new Error('PostgreSQL no configurado');
  }

  const result = await pool.query(
    `SELECT * FROM conversations ORDER BY timestamp DESC NULLS LAST LIMIT $1`,
    [limit],
  );
  return result.rows;
}

async function disconnectPostgres() {
  if (!pool) return;
  await pool.end();
  pgReady = false;
}

module.exports = {
  initPostgres,
  saveConversationPostgres,
  getConversationsPostgres,
  isPostgresConnected,
  disconnectPostgres,
};
