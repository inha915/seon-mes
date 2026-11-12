/**
 * Netlify Function: Express API 를 서버리스 함수 하나로 실행합니다.
 * netlify.toml 의 리다이렉트가 /api/* 요청을 이 함수로 보냅니다.
 * 로컬 개발에서는 이 파일을 쓰지 않고 backend/src/index.ts 로 Express 서버를 직접 띄웁니다.
 */
import express from 'express';
import serverless from 'serverless-http';
import { createApp } from '../../backend/src/app';

const FUNCTION_PREFIX = '/.netlify/functions/api';

const root = express();
// 리다이렉트로 들어온 경로(/.netlify/functions/api/...)를 Express 라우트(/api/...)로 맞춥니다.
root.use((req, _res, next) => {
  if (req.url.startsWith(FUNCTION_PREFIX)) req.url = `/api${req.url.slice(FUNCTION_PREFIX.length)}`;
  next();
});
root.use(createApp());

export const handler = serverless(root);
