import 'dotenv/config';

// PrismaClient 가 생성되기 전에 테스트 DB 로 전환합니다.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
