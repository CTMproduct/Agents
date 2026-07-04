/* eslint-disable no-console */
/**
 * Eval harness Fase 2. Nada se despliega sin correr esto.
 *
 * Uso:
 *   1. Exporta conversaciones reales de CTM y etiquetalas en evals/dataset.jsonl
 *      (usa dataset.example.jsonl como plantilla; objetivo: 300-500 ejemplos).
 *   2. npm run evals
 *
 * Mide: exactitud de intent, customerType, destination, pax y escalamiento.
 * Estos numeros son el GATE para subir de nivel de autonomia (L0 -> L1...).
 */
import * as fs from 'fs';
import * as path from 'path';

// Carga .env sin dependencia extra
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=["']?(.*?)["']?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
} catch { /* noop */ }

import Anthropic from '@anthropic-ai/sdk';
import { IntakeOutputSchema } from '../src/agents/schemas';
import { zodToJsonSchema } from '../src/agents/zod-to-json-schema';
import { INTAKE_SYSTEM_PROMPT } from '../src/agents/intake-agent.prompt';

interface EvalCase {
  id: string;
  conversation: string;
  expected: Record<string, unknown>;
}

async function main() {
  const datasetPath = fs.existsSync(path.join(__dirname, 'dataset.jsonl'))
    ? path.join(__dirname, 'dataset.jsonl')
    : path.join(__dirname, 'dataset.example.jsonl');
  const cases: EvalCase[] = fs
    .readFileSync(datasetPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  console.log(`Eval harness: ${cases.length} casos desde ${path.basename(datasetPath)}\n`);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
  const system = INTAKE_SYSTEM_PROMPT.replace('{{TODAY}}', new Date().toISOString().slice(0, 10));

  const fields = ['intent', 'customerType', 'destination', 'paxAdults', 'paxChildren', 'escalateToHuman'];
  const hits: Record<string, number> = Object.fromEntries(fields.map((f) => [f, 0]));
  const counts: Record<string, number> = Object.fromEntries(fields.map((f) => [f, 0]));
  const failures: string[] = [];
  let schemaFailures = 0;

  for (const c of cases) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: `Conversacion:\n\n${c.conversation}` }],
        tools: [{ name: 'registrar_analisis_intake', description: 'Analisis estructurado', input_schema: zodToJsonSchema() as never }],
        tool_choice: { type: 'tool', name: 'registrar_analisis_intake' },
      });
      const toolUse = resp.content.find((b) => b.type === 'tool_use');
      const parsed = IntakeOutputSchema.safeParse(toolUse && toolUse.type === 'tool_use' ? toolUse.input : null);
      if (!parsed.success) {
        schemaFailures++;
        failures.push(`${c.id}: output no valida con schema`);
        continue;
      }
      const out = parsed.data as unknown as Record<string, unknown>;
      for (const f of fields) {
        if (!(f in c.expected)) continue;
        counts[f]++;
        const exp = c.expected[f];
        const got = out[f];
        const match =
          typeof exp === 'string' && typeof got === 'string'
            ? got.toLowerCase().includes(exp.toLowerCase()) || exp.toLowerCase().includes(got.toLowerCase())
            : got === exp;
        if (match) hits[f]++;
        else failures.push(`${c.id}: ${f} esperado=${JSON.stringify(exp)} obtenido=${JSON.stringify(got)}`);
      }
      process.stdout.write('.');
    } catch (e) {
      failures.push(`${c.id}: ERROR ${(e as Error).message}`);
      process.stdout.write('x');
    }
  }

  console.log('\n\n=== RESULTADOS ===');
  for (const f of fields) {
    if (counts[f] === 0) continue;
    const pct = ((hits[f] / counts[f]) * 100).toFixed(1);
    console.log(`${f.padEnd(18)} ${hits[f]}/${counts[f]}  (${pct}%)`);
  }
  console.log(`schema failures     ${schemaFailures}`);
  if (failures.length) {
    console.log('\n=== FALLOS ===');
    failures.forEach((f) => console.log('- ' + f));
  }
  console.log('\nGate de autonomia L1: <2% de error sostenido 4 semanas en la categoria correspondiente.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
