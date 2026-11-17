import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import router from './routes.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: config.corsOrigin,
      allowedHeaders: ['Content-Type', 'X-User-Id'],
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.use('/api', router)
  app.use('/api', notFound)
  app.use(errorHandler)

  return app
}
