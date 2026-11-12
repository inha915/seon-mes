import { Prisma } from '@prisma/client';
import { config } from '../config.js';

/** Decimal → number (수량은 소수 3자리까지라 number 로 안전하게 표현됩니다) */
export const num = (v: Prisma.Decimal | number | null | undefined): number =>
  v == null ? 0 : Number(v);

/** DATE 컬럼 → 'YYYY-MM-DD' */
export const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

/** 'YYYY-MM-DD' → DATE 컬럼용 Date (UTC 자정) */
export const toDbDate = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

/** 업무 기준 시간대의 오늘 날짜 'YYYY-MM-DD' */
export function todayString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 업무 시간대 기준으로 해당 시각의 UTC 오프셋(분) */
function tzOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** 업무 시간대 기준 'YYYY-MM-DD' 00:00 의 실제 시각 */
export function zonedDayStart(date: string): Date {
  const utcMidnight = new Date(`${date}T00:00:00.000Z`);
  return new Date(utcMidnight.getTime() - tzOffsetMinutes(utcMidnight) * 60_000);
}

/** 기간 필터 'YYYY-MM-DD' ~ 'YYYY-MM-DD' → [from 00:00, to 다음날 00:00) */
export function dayRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = zonedDayStart(from);
  if (to) {
    const next = new Date(`${to}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    range.lt = zonedDayStart(dateOnly(next));
  }
  return range;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const paging = (page: number, pageSize: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});
