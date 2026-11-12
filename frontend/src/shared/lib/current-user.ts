/**
 * 현재 사용자 id 저장소 (데모용 — 로그인 기능 없음).
 * 헤더의 사용자 전환 메뉴에서 바꾸며, API 클라이언트가 X-User-Id 헤더로 보냅니다.
 */
const STORAGE_KEY = 'seon-mes.userId';
const listeners = new Set<() => void>();

let currentUserId: number | null = (() => {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
})();

export const getCurrentUserId = () => currentUserId;

export function setCurrentUserId(id: number) {
  currentUserId = id;
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* 저장할 수 없는 환경이면 세션 동안만 유지 */
  }
  listeners.forEach((l) => l());
}

export function subscribeCurrentUser(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
