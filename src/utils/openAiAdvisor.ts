import { BoardGrid, HandPieces, Player } from '../types/shogi';

export type AdvisorTrigger = 'manual' | 'capture' | 'promotion' | 'hq_attack' | 'evaluation_swing' | 'periodic' | 'multiple';

export interface OpenAiAdvice {
  summary: string;
  bullets: string[];
  model: string;
}

export interface OpenAiAdviceRequest {
  board: BoardGrid;
  hands: HandPieces;
  currentPlayer: Player;
  checkPlayer: Player | null;
  lastMovePlayer: Player | null;
  language: 'ja' | 'en';
  trigger: AdvisorTrigger;
}

const CACHE_LIMIT = 24;
const adviceCache = new Map<string, OpenAiAdvice>();

function cacheKey(input: OpenAiAdviceRequest): string { return JSON.stringify(input); }
function remember(key: string, advice: OpenAiAdvice) {
  if (adviceCache.size >= CACHE_LIMIT) {
    const oldest = adviceCache.keys().next().value;
    if (oldest) adviceCache.delete(oldest);
  }
  adviceCache.set(key, advice);
}

function isAdvice(value: unknown): value is OpenAiAdvice {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.summary === 'string'
    && Array.isArray(item.bullets)
    && item.bullets.length <= 1
    && item.bullets.every(v => typeof v === 'string')
    && typeof item.model === 'string';
}

function endpoint(): string {
  const value = process.env.EXPO_PUBLIC_ADVICE_API_URL;
  if (!value) throw new Error('EXPO_PUBLIC_ADVICE_API_URL is not configured');
  return value;
}

export async function requestOpenAiAdvice(input: OpenAiAdviceRequest, signal?: AbortSignal): Promise<OpenAiAdvice> {
  const key = cacheKey(input);
  const cached = adviceCache.get(key);
  if (cached) return cached;

  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) throw new Error(`AI advisor request failed (${response.status})`);

  const payload: unknown = await response.json();
  if (!isAdvice(payload)) throw new Error('AI advisor returned an invalid response');
  const advice = { summary: payload.summary, bullets: payload.bullets.slice(0, 1), model: payload.model };
  remember(key, advice);
  return advice;
}
