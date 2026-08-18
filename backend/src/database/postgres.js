const { Pool } = require('pg');

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const DEFAULT_AGENT_ID = 'agent_nora';
const DEFAULT_AGENT_VERSION_ID = 'agent_nora_v1';
const DEFAULT_PROMPT = 'Eres Nora, una asistente de viajes. Responde en español con información clara, breve y accionable.';

console.log('[PostgreSQL] Configuration:');
console.log(`   POSTGRES_URL exists: ${!!POSTGRES_URL}`);
console.log(`   DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
if (POSTGRES_URL) {
  const maskedUrl = POSTGRES_URL.replace(/:[^/]*@/, ':***@');
  console.log(`   Connection URL: ${maskedUrl}`);
}

const pool = POSTGRES_URL
  ? new Pool({
      connectionString: POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

let pgReady = false;

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value) {
  return String(value || 'agent')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'agent';
}

function safeLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed)) return 100;
  return Math.min(Math.max(parsed, 1), 1000);
}

async function initPostgres() {
  console.log('[PostgreSQL] Initializing...');

  if (!pool) {
    console.warn('[PostgreSQL] No connection string provided. Using fallback storage.');
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'draft',
        default_language TEXT DEFAULT 'es',
        avatar TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_versions (
        id TEXT PRIMARY KEY,
        agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        system_prompt TEXT NOT NULL,
        model TEXT NOT NULL,
        temperature DOUBLE PRECISION DEFAULT 0.4,
        max_tokens INTEGER DEFAULT 350,
        tools JSONB DEFAULT '[]'::jsonb,
        guardrails JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(agent_id, version)
      )
    `);

    const alters = [
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'No especificado'`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS origen_pais TEXT DEFAULT 'No especificado'`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pregunta_base TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS fuente TEXT DEFAULT 'GPT_ACTION'`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tipo_interaccion TEXT DEFAULT 'respuesta_gpt'`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_id TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_version_id TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'openai'`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS model TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS latency_ms INTEGER`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tokens_input INTEGER DEFAULT 0`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tokens_output INTEGER DEFAULT 0`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS cost_usd DOUBLE PRECISION DEFAULT 0`,
      // Feedback humano explicito (distinto del score de IA autoevaluado)
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS feedback_rating TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS feedback_category TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS feedback_comment TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS feedback_received_at TIMESTAMPTZ`,
      // Escalamiento a asistencia humana (ej. HyperGuest)
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalated_to_human BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalation_target TEXT`,
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalation_reason TEXT`,
    ];

    for (const statement of alters) {
      await pool.query(statement);
    }

    await pool.query(`CREATE INDEX IF NOT EXISTS conversations_timestamp_idx ON conversations (timestamp DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS conversations_agent_idx ON conversations (agent_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS conversations_feedback_category_idx ON conversations (feedback_category)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS conversations_escalated_idx ON conversations (escalated_to_human)`);

    await ensureDefaultAgent();

    pgReady = true;
    console.log('[PostgreSQL] Ready: conversations, agents, and agent versions initialized.');
    return true;
  } catch (error) {
    console.error('[PostgreSQL] Initialization failed');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    pgReady = false;
    return false;
  }
}

async function ensureDefaultAgent() {
  await pool.query(
    `
      INSERT INTO agents (id, slug, name, description, status, default_language, avatar)
      VALUES ($1, 'nora', 'Nora', 'Asistente de viajes y turismo de CTM', 'published', 'es', 'plane')
      ON CONFLICT (id) DO NOTHING
    `,
    [DEFAULT_AGENT_ID],
  );

  await pool.query(
    `
      INSERT INTO agent_versions (
        id, agent_id, version, system_prompt, model, temperature, max_tokens, tools, guardrails, is_active
      ) VALUES ($1, $2, 1, $3, $4, 0.4, 350, '[]'::jsonb, '{}'::jsonb, TRUE)
      ON CONFLICT (id) DO NOTHING
    `,
    [DEFAULT_AGENT_VERSION_ID, DEFAULT_AGENT_ID, DEFAULT_PROMPT, process.env.OPENAI_MODEL || 'gpt-4o-mini'],
  );
}

function isPostgresConnected() {
  return !!(pgReady && pool);
}

async function saveConversationPostgres(data) {
  if (!pool) throw new Error('PostgreSQL no configurado');
  if (!pgReady) throw new Error('PostgreSQL not initialized');

  const hasFeedback = Boolean(
    data.feedback_rating || data.feedback_category || data.escalated_to_human,
  );

  const query = `
    INSERT INTO conversations (
      id, asistente_nombre, pregunta, respuesta, usuario_nombre, usuario_email, usuario_id,
      region, status, score_promedio, timestamp, created_at, updated_at, categoria,
      origen_pais, pregunta_base, fuente, tipo_interaccion, agent_id, agent_version_id,
      provider, model, latency_ms, tokens_input, tokens_output, cost_usd,
      feedback_rating, feedback_category, feedback_comment, feedback_received_at,
      escalated_to_human, escalation_target, escalation_reason
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
      $27,$28,$29,$30,$31,$32,$33
    )
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
      tipo_interaccion = EXCLUDED.tipo_interaccion,
      agent_id = EXCLUDED.agent_id,
      agent_version_id = EXCLUDED.agent_version_id,
      provider = EXCLUDED.provider,
      model = EXCLUDED.model,
      latency_ms = EXCLUDED.latency_ms,
      tokens_input = EXCLUDED.tokens_input,
      tokens_output = EXCLUDED.tokens_output,
      cost_usd = EXCLUDED.cost_usd,
      feedback_rating = EXCLUDED.feedback_rating,
      feedback_category = EXCLUDED.feedback_category,
      feedback_comment = EXCLUDED.feedback_comment,
      feedback_received_at = EXCLUDED.feedback_received_at,
      escalated_to_human = EXCLUDED.escalated_to_human,
      escalation_target = EXCLUDED.escalation_target,
      escalation_reason = EXCLUDED.escalation_reason
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
    data.created_at || data.timestamp,
    new Date().toISOString(),
    data.categoria || 'No especificado',
    data.origen_pais || 'No especificado',
    data.pregunta_base || null,
    data.fuente || 'GPT_ACTION',
    data.tipo_interaccion || 'respuesta_gpt',
    data.agent_id || DEFAULT_AGENT_ID,
    data.agent_version_id || DEFAULT_AGENT_VERSION_ID,
    data.provider || 'openai',
    data.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    data.latency_ms || null,
    data.tokens_input || 0,
    data.tokens_output || 0,
    data.cost_usd || 0,
    data.feedback_rating || null,
    data.feedback_category || null,
    data.feedback_comment || null,
    hasFeedback ? new Date().toISOString() : null,
    Boolean(data.escalated_to_human),
    data.escalation_target || null,
    data.escalation_reason || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function updateConversationFeedbackPostgres(id, feedback = {}) {
  if (!pool) throw new Error('PostgreSQL no configurado');
  if (!pgReady) throw new Error('PostgreSQL not initialized');

  const result = await pool.query(
    `
      UPDATE conversations SET
        feedback_rating = COALESCE($2, feedback_rating),
        feedback_category = COALESCE($3, feedback_category),
        feedback_comment = COALESCE($4, feedback_comment),
        escalated_to_human = COALESCE($5, escalated_to_human),
        escalation_target = COALESCE($6, escalation_target),
        escalation_reason = COALESCE($7, escalation_reason),
        feedback_received_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      feedback.feedback_rating ?? null,
      feedback.feedback_category ?? null,
      feedback.feedback_comment ?? null,
      feedback.escalated_to_human ?? null,
      feedback.escalation_target ?? null,
      feedback.escalation_reason ?? null,
    ],
  );

  return result.rows[0] || null;
}

async function getConversationsPostgres(limit = 100, filters = {}) {
  if (!pool) throw new Error('PostgreSQL no configurado');

  const values = [safeLimit(limit)];
  const conditions = [];

  if (filters.agent_id) {
    values.push(filters.agent_id);
    conditions.push(`agent_id = $${values.length}`);
  }

  if (filters.asistente_nombre) {
    values.push(filters.asistente_nombre);
    conditions.push(`LOWER(asistente_nombre) = LOWER($${values.length})`);
  }

  if (filters.feedback_category) {
    values.push(filters.feedback_category);
    conditions.push(`feedback_category = $${values.length}`);
  }

  if (filters.escalated_to_human !== undefined) {
    values.push(filters.escalated_to_human);
    conditions.push(`escalated_to_human = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM conversations ${where} ORDER BY timestamp DESC NULLS LAST LIMIT $1`,
    values,
  );
  return result.rows;
}

async function getConversationByIdPostgres(id) {
  if (!pool) throw new Error('PostgreSQL no configurado');

  const result = await pool.query(
    `SELECT * FROM conversations WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] || null;
}

function mapAgentRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    status: row.status || 'draft',
    default_language: row.default_language || 'es',
    avatar: row.avatar || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    active_version: {
      id: row.active_version_id,
      version: Number(row.version || 1),
      system_prompt: row.system_prompt || DEFAULT_PROMPT,
      model: row.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: Number(row.temperature ?? 0.4),
      max_tokens: Number(row.max_tokens || 350),
      tools: row.tools || [],
      guardrails: row.guardrails || {},
      created_at: row.version_created_at,
    },
  };
}

async function getAgentsPostgres() {
  if (!pool) throw new Error('PostgreSQL no configurado');

  const result = await pool.query(`
    SELECT
      a.*,
      v.id AS active_version_id,
      v.version,
      v.system_prompt,
      v.model,
      v.temperature,
      v.max_tokens,
      v.tools,
      v.guardrails,
      v.created_at AS version_created_at
    FROM agents a
    LEFT JOIN LATERAL (
      SELECT *
      FROM agent_versions
      WHERE agent_id = a.id
      ORDER BY is_active DESC, version DESC
      LIMIT 1
    ) v ON true
    ORDER BY a.updated_at DESC NULLS LAST, a.name ASC
  `);

  return result.rows.map(mapAgentRow);
}

async function getAgentPostgres(identifier = DEFAULT_AGENT_ID) {
  if (!pool) throw new Error('PostgreSQL no configurado');

  const result = await pool.query(
    `
      SELECT
        a.*,
        v.id AS active_version_id,
        v.version,
        v.system_prompt,
        v.model,
        v.temperature,
        v.max_tokens,
        v.tools,
        v.guardrails,
        v.created_at AS version_created_at
      FROM agents a
      LEFT JOIN LATERAL (
        SELECT *
        FROM agent_versions
        WHERE agent_id = a.id
        ORDER BY is_active DESC, version DESC
        LIMIT 1
      ) v ON true
      WHERE a.id = $1 OR a.slug = $1 OR LOWER(a.name) = LOWER($1)
      LIMIT 1
    `,
    [identifier || DEFAULT_AGENT_ID],
  );

  return mapAgentRow(result.rows[0]);
}

async function saveAgentPostgres(data = {}) {
  if (!pool) throw new Error('PostgreSQL no configurado');

  const id = data.id || createId('agent');
  const name = String(data.name || 'Nuevo agente').trim();
  const slug = slugify(data.slug || name);
  const description = data.description || '';
  const status = data.status || 'draft';
  const defaultLanguage = data.default_language || 'es';
  const avatar = data.avatar || '';
  const current = await getAgentPostgres(id);
  const activeVersion = current?.active_version;

  const tools = data.tools ?? activeVersion?.tools ?? [];
  const guardrails = data.guardrails ?? activeVersion?.guardrails ?? {};
  const shouldCreateVersion =
    !activeVersion?.id ||
    (data.system_prompt !== undefined && data.system_prompt !== activeVersion.system_prompt) ||
    (data.model !== undefined && data.model !== activeVersion.model) ||
    (data.temperature !== undefined && Number(data.temperature) !== Number(activeVersion.temperature)) ||
    (data.max_tokens !== undefined && Number(data.max_tokens) !== Number(activeVersion.max_tokens)) ||
    (data.tools !== undefined && JSON.stringify(data.tools) !== JSON.stringify(activeVersion.tools || [])) ||
    (data.guardrails !== undefined && JSON.stringify(data.guardrails) !== JSON.stringify(activeVersion.guardrails || {}));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
        INSERT INTO agents (id, slug, name, description, status, default_language, avatar, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          default_language = EXCLUDED.default_language,
          avatar = EXCLUDED.avatar,
          updated_at = NOW()
      `,
      [id, slug, name, description, status, defaultLanguage, avatar],
    );

    if (shouldCreateVersion) {
      const nextVersion = Number(activeVersion?.version || 0) + 1;
      const versionId = createId('agent_version');
      const prompt = data.system_prompt || activeVersion?.system_prompt || DEFAULT_PROMPT;
      const model = data.model || activeVersion?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const temperature = Number(data.temperature ?? activeVersion?.temperature ?? 0.4);
      const maxTokens = Number(data.max_tokens ?? activeVersion?.max_tokens ?? 350);

      await client.query(`UPDATE agent_versions SET is_active = FALSE WHERE agent_id = $1`, [id]);
      await client.query(
        `
          INSERT INTO agent_versions (
            id, agent_id, version, system_prompt, model, temperature, max_tokens, tools, guardrails, is_active
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,TRUE)
        `,
        [
          versionId,
          id,
          nextVersion,
          prompt,
          model,
          temperature,
          maxTokens,
          JSON.stringify(tools),
          JSON.stringify(guardrails),
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getAgentPostgres(id);
}

async function disconnectPostgres() {
  if (!pool) return;
  await pool.end();
  pgReady = false;
}

module.exports = {
  initPostgres,
  saveConversationPostgres,
  updateConversationFeedbackPostgres,
  getConversationsPostgres,
  getConversationByIdPostgres,
  getAgentsPostgres,
  getAgentPostgres,
  saveAgentPostgres,
  isPostgresConnected,
  disconnectPostgres,
};
