import express from 'express'
import serverless from 'serverless-http'
import { createApp } from '../../backend/src/app'

const FUNCTION_PREFIX = '/.netlify/functions/api'

const root = express()

// 리다이렉트로 들어온 경로(/.netlify/functions/api/...)를 Express 라우트(/api/...)로 맞춥니다.
root.use((req, _res, next) => {
  if (req.url.startsWith(FUNCTION_PREFIX))
    req.url = `/api${req.url.slice(FUNCTION_PREFIX.length)}`
  next()
})

// serverless-http 는 요청 본문을 req.body 에 Buffer 로 넣고 스트림을 이미 끝난 상태로 만들기 때문에
// express.json() 이 "이미 읽음"으로 보고 파싱을 건너뜁니다. 여기서 JSON 본문을 직접 파싱해 둡니다.
// JSON 이 깨졌으면 빈 객체로 두고 Zod 검증에서 걸러지게 한다
root.use((req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString('utf8')
    if (text && req.is('application/json')) {
      try {
        req.body = JSON.parse(text)
      } catch {
        req.body = {}
      }
    } else {
      req.body = undefined
    }
  }
  next()
})

root.use(createApp())

export const handler = serverless(root)
