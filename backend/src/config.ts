import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  /** "금일" 집계와 문서번호 날짜에 사용하는 업무 기준 시간대 */
  timeZone: process.env.APP_TIMEZONE ?? 'Asia/Seoul',
};
