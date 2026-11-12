/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 배포 시 API 서버 주소 (비우면 같은 출처의 /api 사용, 개발 중에는 Vite 프록시) */
  readonly VITE_API_BASE_URL?: string;
}
