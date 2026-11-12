import { execSync } from 'node:child_process';
import 'dotenv/config';

/** 테스트 시작 전 테스트 DB(TEST_DATABASE_URL)에 마이그레이션을 적용합니다. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set. Copy .env.example to backend/.env first.');
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL (tests truncate all tables).');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
