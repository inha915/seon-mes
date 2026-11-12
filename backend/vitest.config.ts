import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    // 모든 테스트가 하나의 테스트 DB를 공유하므로 파일 단위 병렬 실행을 끕니다.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
