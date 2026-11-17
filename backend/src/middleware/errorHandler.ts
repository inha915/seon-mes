import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError, ErrorCode } from '../lib/errors.js'

export const notFound: RequestHandler = (_req, _res, next) => {
  next(
    new AppError(404, ErrorCode.NOT_FOUND, 'Route not found', {
      resource: 'route',
    }),
  )
}

// 응답 형식은 { error: { code, message, details } } 로 통일. 화면 문구는 프론트에서 code 로 번역한다.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Malformed JSON body',
      },
    })
    return
  }

  console.error(err)
  res.status(500).json({
    error: { code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
  })
}
