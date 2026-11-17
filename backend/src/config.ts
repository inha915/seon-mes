import 'dotenv/config'

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),
  timeZone: process.env.APP_TIMEZONE ?? 'Asia/Seoul',
}
