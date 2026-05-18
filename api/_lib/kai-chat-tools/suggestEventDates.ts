/**
 * Tool `suggestEventDates` — sugere datas comemorativas (BR) + eventos
 * do cliente pra ajudar o LLM a planejar conteúdo.
 *
 * Use quando o usuário pedir:
 *   - "que datas importantes tem em junho?"
 *   - "planeja posts pra Black Friday"
 *   - "tem alguma data comemorativa essa semana?"
 *   - "próximos 30 dias, o que cai?"
 *
 * Retorna lista unificada de:
 *   1. Datas nacionais/comerciais fixas e móveis (Dia das Mães, Black Friday,
 *      Natal, Independência, etc) calculadas pro ano alvo.
 *   2. Datas próprias do cliente (aniversário marca, lançamentos passados,
 *      eventos próprios) buscadas em `client_reference_library` com
 *      `reference_type='event'` OU metadata.tags contendo 'event'/'evento'.
 *      Se a convenção não existir naquele workspace, simplesmente retorna
 *      vazio pra essa parte — não bloqueia.
 *
 * Filtros aceitos:
 *   - `month` (1-12) + `year`: lista todas as datas daquele mês.
 *   - `range_days`: alternativa — próximos N dias a partir de hoje
 *     (sobrepõe month/year).
 *   - `include_client`: liga/desliga busca de eventos do cliente
 *     (default true).
 */
import type { RegisteredTool } from './types.js';
import { query } from '../db.js';
import { assertToolClientAccess } from './tool-access.js';

interface SuggestEventDatesArgs {
  month?: number;
  year?: number;
  range_days?: number;
  include_client?: boolean;
  client_id?: string;
}

type EventType = 'national' | 'client' | 'commerce' | 'religious';

interface EventDate {
  date: string; // YYYY-MM-DD
  name: string;
  type: EventType;
  description?: string;
  daysFromToday: number;
}

interface SuggestEventDatesData {
  dates: EventDate[];
  scope:
    | { kind: 'month'; month: number; year: number }
    | { kind: 'range'; from: string; to: string; days: number };
  counts: {
    total: number;
    national: number;
    commerce: number;
    religious: number;
    client: number;
  };
}

// --------------------- Helpers de data ---------------------

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseISODateOnly(s: string): Date {
  // Trata como meia-noite UTC pra evitar drift de timezone na diferença em dias.
  const [y, m, d] = s.split('-').map((p) => parseInt(p, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function diffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Nth-weekday-of-month. weekday: 0=Sun ... 6=Sat. nth: 1..5.
 * Ex: nthWeekday(2026, 5, 0, 2) = 2º domingo de maio/2026.
 */
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  // month aqui é 1-12
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = first.getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return fmtDate(year, month, day);
}

/**
 * Última ocorrência de um weekday num mês. Ex: última sexta de novembro
 * (Black Friday).
 */
function lastWeekday(year: number, month: number, weekday: number): string {
  // dias do mês
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = lastDay; d >= 1; d--) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow === weekday) return fmtDate(year, month, d);
  }
  return fmtDate(year, month, lastDay);
}

/**
 * Páscoa — algoritmo de Meeus/Jones/Butcher (gregoriano).
 * Retorna YYYY-MM-DD.
 */
function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fmtDate(year, month, day);
}

function addDaysISO(iso: string, days: number): string {
  const d = parseISODateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmtDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Dia do Programador — 256º dia do ano (12/9 em ano normal, 12/9 em bissexto
 * também porque já passou de fev). Implementa de forma robusta.
 */
function dayOfProgrammer(year: number): string {
  const start = new Date(Date.UTC(year, 0, 1));
  start.setUTCDate(start.getUTCDate() + 255); // 256º dia (1-indexed)
  return fmtDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate());
}

// --------------------- Catálogo BR ---------------------

interface CatalogEntry {
  name: string;
  type: EventType;
  description?: string;
  /** Recebe o ano, devolve YYYY-MM-DD. */
  date: (year: number) => string;
}

const CATALOG: CatalogEntry[] = [
  // --- Feriados nacionais fixos ---
  {
    name: 'Confraternização Universal (Ano Novo)',
    type: 'national',
    description: 'Feriado nacional — virada do ano.',
    date: (y) => fmtDate(y, 1, 1),
  },
  {
    name: 'Tiradentes',
    type: 'national',
    description: 'Feriado nacional brasileiro.',
    date: (y) => fmtDate(y, 4, 21),
  },
  {
    name: 'Dia do Trabalho',
    type: 'national',
    description: 'Feriado nacional — Dia do Trabalhador.',
    date: (y) => fmtDate(y, 5, 1),
  },
  {
    name: 'Independência do Brasil',
    type: 'national',
    description: 'Feriado nacional — 7 de setembro.',
    date: (y) => fmtDate(y, 9, 7),
  },
  {
    name: 'Nossa Senhora Aparecida / Dia das Crianças',
    type: 'national',
    description: 'Feriado nacional (padroeira) + Dia das Crianças no mesmo dia.',
    date: (y) => fmtDate(y, 10, 12),
  },
  {
    name: 'Finados',
    type: 'national',
    description: 'Feriado nacional — Dia de Finados.',
    date: (y) => fmtDate(y, 11, 2),
  },
  {
    name: 'Proclamação da República',
    type: 'national',
    description: 'Feriado nacional — 15 de novembro.',
    date: (y) => fmtDate(y, 11, 15),
  },
  {
    name: 'Natal',
    type: 'religious',
    description: 'Feriado nacional — Natal.',
    date: (y) => fmtDate(y, 12, 25),
  },

  // --- Comerciais grandes ---
  {
    name: 'Dia das Mães',
    type: 'commerce',
    description: '2º domingo de maio — uma das maiores datas comerciais do ano.',
    date: (y) => nthWeekday(y, 5, 0, 2),
  },
  {
    name: 'Dia dos Namorados',
    type: 'commerce',
    description: 'Data comercial brasileira (12 de junho).',
    date: (y) => fmtDate(y, 6, 12),
  },
  {
    name: 'Dia dos Pais',
    type: 'commerce',
    description: '2º domingo de agosto.',
    date: (y) => nthWeekday(y, 8, 0, 2),
  },
  {
    name: 'Dia do Cliente',
    type: 'commerce',
    description: '15 de setembro — data forte pra ofertas e fidelização.',
    date: (y) => fmtDate(y, 9, 15),
  },
  {
    name: 'Dia das Crianças',
    type: 'commerce',
    description: '12 de outubro (mesmo dia do feriado de N. Sra. Aparecida).',
    date: (y) => fmtDate(y, 10, 12),
  },
  {
    name: 'Dia do Profissional de Marketing',
    type: 'commerce',
    description: '5 de novembro — útil pra conteúdo institucional de agência.',
    date: (y) => fmtDate(y, 11, 5),
  },
  {
    name: 'Black Friday',
    type: 'commerce',
    description: 'Última sexta-feira de novembro — maior data de e-commerce do ano.',
    date: (y) => lastWeekday(y, 11, 5),
  },
  {
    name: 'Cyber Monday',
    type: 'commerce',
    description: 'Segunda-feira seguinte à Black Friday.',
    date: (y) => addDaysISO(lastWeekday(y, 11, 5), 3),
  },

  // --- Digitais / nicho ---
  {
    name: 'Dia da Internet',
    type: 'commerce',
    description: '17 de maio — Dia Mundial da Internet, bom gancho pra tech/marketing.',
    date: (y) => fmtDate(y, 5, 17),
  },
  {
    name: 'Dia do Programador',
    type: 'commerce',
    description: '256º dia do ano (12 ou 13 de setembro).',
    date: (y) => dayOfProgrammer(y),
  },

  // --- Religiosas móveis ---
  {
    name: 'Páscoa',
    type: 'religious',
    description: 'Domingo de Páscoa (cálculo gregoriano).',
    date: (y) => easterSunday(y),
  },
  {
    name: 'Carnaval (terça-feira)',
    type: 'religious',
    description: 'Terça-feira de Carnaval — 47 dias antes da Páscoa.',
    date: (y) => addDaysISO(easterSunday(y), -47),
  },
  {
    name: 'Quarta-feira de Cinzas',
    type: 'religious',
    description: '46 dias antes da Páscoa — fim do Carnaval.',
    date: (y) => addDaysISO(easterSunday(y), -46),
  },
  {
    name: 'Sexta-feira Santa',
    type: 'religious',
    description: 'Feriado religioso — 2 dias antes da Páscoa.',
    date: (y) => addDaysISO(easterSunday(y), -2),
  },
  {
    name: 'Corpus Christi',
    type: 'religious',
    description: '60 dias depois da Páscoa.',
    date: (y) => addDaysISO(easterSunday(y), 60),
  },
];

// --------------------- Tool ---------------------

const DEFAULT_RANGE = 30;
const MAX_RANGE = 365;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Tenta extrair uma data ISO YYYY-MM-DD de um metadata object qualquer.
 * Aceita várias chaves comuns: `event_date`, `date`, `when`, `scheduled_for`.
 */
function pickEventDate(meta: Record<string, unknown>): string | null {
  const candidates = ['event_date', 'date', 'when', 'scheduled_for', 'starts_at'];
  for (const k of candidates) {
    const raw = meta[k];
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
  }
  return null;
}

function metaTagsHaveEvent(meta: Record<string, unknown>): boolean {
  const tags = meta.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some(
    (t) =>
      typeof t === 'string' &&
      (t.toLowerCase() === 'event' || t.toLowerCase() === 'evento'),
  );
}

export const suggestEventDatesTool: RegisteredTool<
  SuggestEventDatesArgs,
  SuggestEventDatesData
> = {
  definition: {
    name: 'suggestEventDates',
    description:
      "Lista datas comemorativas relevantes (feriados nacionais BR, datas comerciais como Black Friday e Dia das Mães, datas religiosas móveis como Páscoa e Carnaval) e, opcionalmente, eventos próprios do cliente (lançamentos, aniversário da marca). Use quando o usuário perguntar 'que datas importantes tem em junho?', 'próximos 30 dias o que cai?', 'planeja posts pra Black Friday', ou pedir calendário editorial. Passe `month`+`year` pra um mês específico, OU `range_days` pra próximos N dias a partir de hoje.",
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'integer',
          description: 'Mês alvo (1-12). Default: mês atual. Ignorado se range_days for passado.',
        },
        year: {
          type: 'integer',
          description: 'Ano alvo (ex: 2026). Default: ano atual.',
        },
        range_days: {
          type: 'integer',
          description:
            'Alternativa a month/year: próximos N dias a partir de hoje (1-365). Default 30 quando nenhum filtro temporal é passado.',
        },
        include_client: {
          type: 'boolean',
          description:
            'Se true (default), inclui eventos próprios do cliente registrados em client_reference_library (reference_type=event ou tag event/evento).',
        },
        client_id: {
          type: 'string',
          description: 'UUID do cliente. Default: cliente atual do contexto.',
        },
      },
      required: [],
    },
  },

  handler: async (args, ctx) => {
    const includeClient = args.include_client !== false; // default true
    const clientId = String(args.client_id ?? ctx.clientId ?? '').trim();

    // Decide janela: prioriza range_days > month/year > default próximos 30 dias.
    const today = todayUTC();
    let from: Date;
    let to: Date;
    let scope: SuggestEventDatesData['scope'];

    const rangeDays =
      typeof args.range_days === 'number' && args.range_days > 0
        ? Math.min(Math.floor(args.range_days), MAX_RANGE)
        : null;

    const hasMonthFilter =
      typeof args.month === 'number' && args.month >= 1 && args.month <= 12;

    if (rangeDays !== null) {
      from = today;
      to = new Date(today.getTime());
      to.setUTCDate(to.getUTCDate() + rangeDays);
      scope = {
        kind: 'range',
        from: fmtDate(from.getUTCFullYear(), from.getUTCMonth() + 1, from.getUTCDate()),
        to: fmtDate(to.getUTCFullYear(), to.getUTCMonth() + 1, to.getUTCDate()),
        days: rangeDays,
      };
    } else if (hasMonthFilter) {
      const year = typeof args.year === 'number' ? args.year : today.getUTCFullYear();
      const month = args.month as number;
      from = new Date(Date.UTC(year, month - 1, 1));
      to = new Date(Date.UTC(year, month, 0)); // último dia do mês
      scope = { kind: 'month', month, year };
    } else {
      // Default: próximos 30 dias.
      from = today;
      to = new Date(today.getTime());
      to.setUTCDate(to.getUTCDate() + DEFAULT_RANGE);
      scope = {
        kind: 'range',
        from: fmtDate(from.getUTCFullYear(), from.getUTCMonth() + 1, from.getUTCDate()),
        to: fmtDate(to.getUTCFullYear(), to.getUTCMonth() + 1, to.getUTCDate()),
        days: DEFAULT_RANGE,
      };
    }

    // Gera catálogo nacional pros anos cobertos pela janela (pode cruzar
    // virada de ano em range mode).
    const yearsToCover = new Set<number>();
    yearsToCover.add(from.getUTCFullYear());
    yearsToCover.add(to.getUTCFullYear());

    const all: EventDate[] = [];
    for (const y of yearsToCover) {
      for (const entry of CATALOG) {
        let iso: string;
        try {
          iso = entry.date(y);
        } catch {
          continue;
        }
        const d = parseISODateOnly(iso);
        if (d.getTime() < from.getTime() || d.getTime() > to.getTime()) continue;
        all.push({
          date: iso,
          name: entry.name,
          type: entry.type,
          description: entry.description,
          daysFromToday: diffDays(today, d),
        });
      }
    }

    // Busca eventos do cliente — opcional, falha silenciosa.
    let clientCount = 0;
    if (includeClient && clientId) {
      const guard = await assertToolClientAccess(ctx, clientId);
      if (guard.ok) {
        try {
          const rows = await query<{
            id: string;
            title: string | null;
            content: string | null;
            metadata: unknown;
            reference_type: string | null;
          }>(
            `SELECT id, title, content, metadata, reference_type
               FROM client_reference_library
              WHERE client_id = $1
                AND (
                  reference_type = 'event'
                  OR (metadata->>'reference_type') = 'event'
                  OR (metadata->'tags') @> '["event"]'::jsonb
                  OR (metadata->'tags') @> '["evento"]'::jsonb
                )
              LIMIT 200`,
            [clientId],
          );

          for (const r of rows) {
            if (!isPlainObject(r.metadata)) continue;
            const iso = pickEventDate(r.metadata);
            if (!iso) continue;
            const d = parseISODateOnly(iso);
            if (Number.isNaN(d.getTime())) continue;
            if (d.getTime() < from.getTime() || d.getTime() > to.getTime()) continue;
            all.push({
              date: iso,
              name: r.title?.trim() || 'Evento do cliente',
              type: 'client',
              description:
                typeof r.content === 'string' && r.content.trim()
                  ? r.content.trim().slice(0, 240)
                  : undefined,
              daysFromToday: diffDays(today, d),
            });
            clientCount++;
          }
        } catch (err) {
          // Tabela / convenção pode não existir nesse workspace — não bloqueia.
          console.warn(
            '[suggestEventDates] client events lookup falhou (seguindo sem):',
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    // Ordena por data e depois por nome.
    all.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    const counts = {
      total: all.length,
      national: all.filter((e) => e.type === 'national').length,
      commerce: all.filter((e) => e.type === 'commerce').length,
      religious: all.filter((e) => e.type === 'religious').length,
      client: clientCount,
    };

    console.log(
      `[suggestEventDates] scope=${scope.kind} client=${clientId || 'none'} → ${all.length} datas (cli=${clientCount})`,
    );

    return {
      ok: true,
      data: {
        dates: all,
        scope,
        counts,
      },
    };
  },
};
