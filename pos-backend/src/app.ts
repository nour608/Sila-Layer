import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import type { Logger as PinoLogger } from 'pino'
import { z } from 'zod'
import { loadConfig, type AppConfig } from './config'
import { toDateWindowUtc } from './date'
import { AppError, isAppError, toAppError } from './errors'
import { CheckoutStore } from './checkouts'
import type { NormalizedPayment } from './types'
import { SquareClient } from './square-client'
import { verifySquareWebhookSignature } from './webhooks'

const dailyQuerySchema = z.object({
  merchantId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const paymentsDailyQuerySchema = dailyQuerySchema.extend({
  category: z.string().min(1).optional(),
  item: z.string().min(1).optional(),
})

const pendingQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
})

const onchainResultSchema = z.object({
  checkoutId: z.string().min(1),
  outcome: z.enum(['SUCCESS', 'RETRYABLE']),
  txHash: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
})

interface WebhookBodyCandidate {
  event_id?: string
  type?: string
  merchant_id?: string
  data?: { object?: { payment?: Record<string, unknown> } }
}

interface RequestWithRawBody {
  rawBodyText?: string
}

const loggerRedactionPaths = [
  'req.headers.authorization',
  'headers.authorization',
  'authorization',
  'token',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  'SQUARE_PAT_FALLBACK_TOKEN',
  'INTERNAL_API_TOKEN',
]

const parseWebhookMeta = (payload: unknown): { eventId: string; eventType: string; merchantId?: string } => {
  const fallbackEventId = `local-${randomUUID()}`
  if (typeof payload !== 'object' || payload === null) {
    return { eventId: fallbackEventId, eventType: 'unknown' }
  }
  const candidate = payload as WebhookBodyCandidate
  return {
    eventId: typeof candidate.event_id === 'string' && candidate.event_id.length > 0 ? candidate.event_id : fallbackEventId,
    eventType: typeof candidate.type === 'string' && candidate.type.length > 0 ? candidate.type : 'unknown',
    merchantId: typeof candidate.merchant_id === 'string' && candidate.merchant_id.length > 0 ? candidate.merchant_id : undefined,
  }
}

// Map a Square webhook payment object into the NormalizedPayment shape the store expects.
const normalizePaymentObject = (obj: Record<string, unknown> | undefined): NormalizedPayment | undefined => {
  if (!obj || typeof obj.id !== 'string') return undefined
  const money = (obj.amount_money ?? {}) as { amount?: number | string; currency?: string }
  const amountRaw = money.amount ?? 0
  return {
    id: String(obj.id),
    orderId: typeof obj.order_id === 'string' ? obj.order_id : undefined,
    amountMinor: typeof amountRaw === 'number' ? BigInt(amountRaw) : BigInt(amountRaw || 0),
    currency: String(money.currency ?? 'USD'),
    status: String(obj.status ?? ''),
    createdAt: String(obj.created_at ?? ''),
    note: typeof obj.note === 'string' ? obj.note : undefined,
    raw: obj,
  }
}

export interface BuildAppOptions {
  config?: AppConfig
  now?: () => Date
  logger?: FastifyServerOptions['logger'] | PinoLogger
  fetchFn?: typeof fetch
  store?: CheckoutStore
}

export const buildApp = (options: BuildAppOptions = {}): FastifyInstance => {
  const config = options.config ?? loadConfig()
  const store = options.store ?? new CheckoutStore()

  const app = Fastify({
    logger:
      options.logger ??
      ({
        level: config.logLevel,
        redact: { paths: loggerRedactionPaths, remove: true },
      } satisfies FastifyServerOptions['logger']),
  })

  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    const rawBodyText = String(body ?? '')
    ;(request as RequestWithRawBody).rawBodyText = rawBodyText
    if (rawBodyText.length === 0) {
      done(null, {})
      return
    }
    try {
      done(null, JSON.parse(rawBodyText))
    } catch {
      done(new AppError('INVALID_INPUT', 'Invalid JSON body', 400, false))
    }
  })

  const squareClient = new SquareClient(
    {
      baseUrl: config.squareBaseUrl,
      version: config.squareVersion,
      token: config.squarePatToken,
      timeoutMs: config.squareTimeoutMs,
      maxRetries: config.squareMaxRetries,
      retryBaseDelayMs: config.squareRetryBaseDelayMs,
    },
    options.fetchFn,
  )

  const now = options.now ?? (() => new Date())

  // Guard for /internal/* endpoints — the CRE workflow presents a bearer token.
  const requireInternalAuth = (request: { headers: Record<string, unknown> }): void => {
    const header = request.headers['authorization']
    const value = Array.isArray(header) ? header[0] : header
    const expected = `Bearer ${config.internalApiToken}`
    if (value !== expected) {
      throw new AppError('SQUARE_AUTH_FAILED', 'Invalid internal API token', 401, false)
    }
  }

  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', '*')
    reply.header('access-control-allow-methods', 'GET,POST,OPTIONS')
    reply.header('access-control-allow-headers', 'Content-Type, Authorization, x-square-hmacsha256-signature')
    if (request.method === 'OPTIONS') {
      reply.code(204)
      await reply.send()
    }
  })

  app.get('/health', async () => ({ status: 'ok', mode: 'stateless', timestamp: now().toISOString() }))

  app.get('/square/locations', async (request) => {
    const locations = await squareClient.listLocations()
    return { locations }
  })

  app.get('/square/payments/daily', async (request) => {
    const parsed = paymentsDailyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400, false, {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      })
    }
    const window = toDateWindowUtc(parsed.data.date)
    const paymentsResult = await squareClient.listPayments(window.startIso, window.endIso)
    return {
      source: 'square',
      merchantId: parsed.data.merchantId,
      date: parsed.data.date,
      count: paymentsResult.items.length,
      payments: paymentsResult.items.map((p) => ({ ...p, amountMinor: p.amountMinor.toString() })),
    }
  })

  // --- CRE-facing internal endpoints (Slice 3+4) ---

  // The CRE workflow polls this each cron tick for checkouts awaiting on-chain settlement.
  app.get('/internal/checkouts/pending', async (request) => {
    requireInternalAuth(request)
    const parsed = pendingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid query parameters', 400, false)
    }
    const limit = Math.min(parsed.data.limit ?? config.maxBatch, config.maxBatch)
    return { checkouts: store.listPending(limit) }
  })

  // The CRE workflow reports each settlement outcome so settled checkouts aren't re-submitted.
  app.post('/internal/checkouts/onchain-result', async (request, reply) => {
    requireInternalAuth(request)
    const parsed = onchainResultSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new AppError('INVALID_INPUT', 'Invalid result body', 400, false)
    }
    const { checkoutId, outcome, txHash, errorMessage } = parsed.data
    const known = store.recordResult(checkoutId, outcome, txHash, errorMessage)
    reply.code(known ? 200 : 404)
    return { ok: known }
  })

  // Square webhook: on a completed payment, record a pending checkout for the CRE workflow.
  app.post('/square/webhooks', async (request, reply) => {
    const rawBody = (request as unknown as RequestWithRawBody).rawBodyText ?? JSON.stringify(request.body ?? {})
    const signatureHeader = request.headers['x-square-hmacsha256-signature']
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
    const hasVerificationConfig = Boolean(config.squareWebhookSignatureKey && config.squareWebhookNotificationUrl)

    let signatureValid = false
    if (hasVerificationConfig && signature) {
      signatureValid = verifySquareWebhookSignature(
        config.squareWebhookSignatureKey as string,
        config.squareWebhookNotificationUrl as string,
        rawBody,
        signature,
      )
    }

    if (config.squareWebhookRequireSignature && !signatureValid) {
      throw new AppError('SQUARE_AUTH_FAILED', 'Invalid Square webhook signature', 401, false)
    }

    const payload = (typeof request.body === 'object' && request.body !== null
      ? (request.body as WebhookBodyCandidate)
      : {}) as WebhookBodyCandidate
    const webhookMeta = parseWebhookMeta(payload)

    // Only act on completed payments.
    let recorded = false
    let recordError: string | undefined
    if (webhookMeta.eventType === 'payment.updated' || webhookMeta.eventType === 'payment.created') {
      const normalized = normalizePaymentObject(payload.data?.object?.payment)
      if (normalized && normalized.status === 'COMPLETED') {
        const result = store.addFromPayment(normalized)
        if ('error' in result) {
          recordError = result.error
        } else {
          recorded = true
        }
      }
    }

    request.log.info(
      { requestId: request.id, eventId: webhookMeta.eventId, eventType: webhookMeta.eventType, signatureValid, recorded, recordError },
      'webhook_received',
    )

    reply.code(200)
    return { status: 'accepted', eventId: webhookMeta.eventId, signatureValid, recorded }
  })

  app.setErrorHandler((error, request, reply) => {
    const hasValidation = typeof error === 'object' && error !== null && 'validation' in error
    const appError = isAppError(error)
      ? error
      : hasValidation
        ? new AppError('INVALID_INPUT', 'Request validation failed', 400, false)
        : toAppError(error)
    request.log.error(
      { requestId: request.id, errorCode: appError.errorCode, statusCode: appError.statusCode },
      appError.message,
    )
    reply.status(appError.statusCode).send({
      errorCode: appError.errorCode,
      message: appError.message,
      requestId: request.id,
      retriable: appError.retriable,
      details: appError.details ?? {},
    })
  })

  return app
}
