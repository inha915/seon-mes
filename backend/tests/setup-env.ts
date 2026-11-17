import 'dotenv/config'

// PrismaClient 생성 전에 테스트 DB 로 바꿔야 함
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
