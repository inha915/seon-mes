import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ko from './locales/ko.json';

type Tree = { [k: string]: string | Tree };
const flatten = (obj: Tree, prefix = ''): [string, string][] =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const vars = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

describe('번역 리소스', () => {
  const koMap = new Map(flatten(ko));
  const enMap = new Map(flatten(en));

  it('한국어와 영어의 키가 정확히 일치한다', () => {
    expect([...enMap.keys()].sort()).toEqual([...koMap.keys()].sort());
  });

  it('같은 키의 {{변수}} 가 언어별로 일치한다', () => {
    for (const [key, value] of koMap) expect(vars(enMap.get(key) ?? ''), key).toEqual(vars(value));
  });

  it('빈 번역 문구가 없다', () => {
    for (const [key, value] of [...koMap, ...enMap]) expect(value.trim(), key).not.toBe('');
  });
});
