/**
 * Clasificador automático de conversaciones en 9 categorías
 * Basado en patrones de palabras clave
 */

export type Category =
  | 'Preguntas comerciales sobre HyperGuest'
  | 'Revenue y rentabilidad'
  | 'Sell to Net y acuerdos'
  | 'Operación de extranet'
  | 'Conectividad y Channel Manager'
  | 'Pagos y VCC'
  | 'Fiscalidad e impuestos'
  | 'Revenue Compass'
  | 'Soporte y escalamiento';

const CATEGORY_PATTERNS: Record<Category, string[]> = {
  'Preguntas comerciales sobre HyperGuest': [
    'hyperguest',
    'producto',
    'feature',
    'función',
    'característica',
    'módulo',
    'plataforma',
    'integraciones',
    'sistemas',
    'herramientas',
  ],
  'Revenue y rentabilidad': [
    'revenue',
    'rentabilidad',
    'margen',
    'ganancia',
    'beneficio',
    'tarifa',
    'precio',
    'comisión',
    'ADR',
    'net ADR',
    'net average daily rate',
    'ingresos',
    'facturación',
    'ROI',
  ],
  'Sell to Net y acuerdos': [
    'sell to net',
    'contrato',
    'acuerdo',
    'commission',
    'comisión',
    'términos',
    'condiciones',
    'negociación',
    'rate plan',
    'rate parity',
    'política de precios',
  ],
  'Operación de extranet': [
    'extranet',
    'operación',
    'gestión',
    'manejo',
    'disponibilidad',
    'reservas',
    'inventory',
    'ocupación',
    'habitaciones',
    'reservación',
  ],
  'Conectividad y Channel Manager': [
    'conectividad',
    'channel manager',
    'canales',
    'distribución',
    'OTA',
    'booking',
    'conexión',
    'integración',
    'API',
    'sincronización',
    'update',
  ],
  'Pagos y VCC': [
    'pago',
    'VCC',
    'tarjeta virtual',
    'pmt',
    'payment',
    'cobro',
    'comisión de pago',
    'depósito',
    'facturación',
    'invoice',
    'cuenta',
    'liquidación',
  ],
  'Fiscalidad e impuestos': [
    'fiscal',
    'impuesto',
    'IVA',
    'IRPF',
    'impuestos',
    'régimen',
    'declaración',
    'tributaria',
    'retención',
    'facturación',
    'normativa',
    'complianza',
    'compliance',
  ],
  'Revenue Compass': [
    'revenue compass',
    'compass',
    'analytics',
    'análisis',
    'reportes',
    'reports',
    'métricas',
    'KPI',
    'estadísticas',
    'dashboards',
    'inteligencia',
  ],
  'Soporte y escalamiento': [
    'soporte',
    'problema',
    'error',
    'bug',
    'issue',
    'ayuda',
    'escalamiento',
    'técnico',
    'fallo',
    'no funciona',
    'conectar',
    'resolver',
    'solución',
  ],
};

/**
 * Clasifica una pregunta/conversación en una de las 9 categorías
 * @param text Texto a clasificar (pregunta o conversación)
 * @returns Categoría clasificada
 */
export function classifyConversation(text: string): Category {
  if (!text) return 'Soporte y escalamiento';

  const lowerText = text.toLowerCase();
  const scores: Record<Category, number> = {} as Record<Category, number>;

  // Inicializar scores
  Object.keys(CATEGORY_PATTERNS).forEach((category) => {
    scores[category as Category] = 0;
  });

  // Calcular score para cada categoría basado en palabras clave
  Object.entries(CATEGORY_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach((pattern) => {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        scores[category as Category] += matches.length;
      }
    });
  });

  // Encontrar la categoría con mayor score
  const classified = Object.entries(scores).sort(
    ([, scoreA], [, scoreB]) => scoreB - scoreA
  )[0];

  // Si no hay match claro, retornar "Soporte y escalamiento" como default
  return classified?.[1] > 0 ? (classified[0] as Category) : 'Soporte y escalamiento';
}

/**
 * Genera una pregunta base resumida
 * @param pregunta Pregunta original
 * @returns Pregunta base o resumen corto
 */
export function generateBasePregunta(pregunta: string): string {
  if (!pregunta) return '';

  // Si la pregunta es corta, retornarla tal cual
  if (pregunta.length < 80) return pregunta;

  // Si es larga, retornar los primeros 80 caracteres o hasta la primera frase completa
  const truncated = pregunta.substring(0, 80);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const endOfSentence = Math.max(lastPeriod, lastQuestion);

  if (endOfSentence > 40) {
    return truncated.substring(0, endOfSentence + 1);
  }

  return truncated + '...';
}

/**
 * Prepara datos de conversación para captura con categorización automática
 * @param datos Datos básicos de la conversación
 * @returns Datos preparados con categoría y pregunta_base
 */
interface ConversationInput {
  pregunta?: string;
  respuesta?: string;
  agent_id?: string;
  agent_slug?: string;
  categoria?: string;
  pregunta_base?: string;
  fuente?: string;
  tipo_interaccion?: string;
  asistente_nombre?: string;
  region?: string;
  usuario_nombre?: string | null;
  usuario_email?: string | null;
  usuario_id?: string | null;
}

export function prepareConversationData<T extends ConversationInput>(datos: T): T & {
  categoria: string;
  pregunta_base: string;
  fuente: string;
  tipo_interaccion: string;
  asistente_nombre: string;
  region: string;
  usuario_nombre: string | null;
  usuario_email: string | null;
  usuario_id: string | null;
  status: string;
} {
  const pregunta = datos.pregunta || '';

  return {
    ...datos,
    categoria: datos.categoria || classifyConversation(pregunta),
    pregunta_base: datos.pregunta_base || generateBasePregunta(pregunta),
    fuente: datos.fuente || 'GPT_ACTION',
    tipo_interaccion: datos.tipo_interaccion || 'respuesta_gpt',
    asistente_nombre: datos.asistente_nombre || 'NORA',
    region: datos.region || 'Nora',
    usuario_nombre: datos.usuario_nombre || 'Usuario Anónimo',
    usuario_email: datos.usuario_email || null,
    usuario_id: datos.usuario_id || null,
    status: 'capturada',
  };
}

export const CATEGORIES: Category[] = [
  'Preguntas comerciales sobre HyperGuest',
  'Revenue y rentabilidad',
  'Sell to Net y acuerdos',
  'Operación de extranet',
  'Conectividad y Channel Manager',
  'Pagos y VCC',
  'Fiscalidad e impuestos',
  'Revenue Compass',
  'Soporte y escalamiento',
];
