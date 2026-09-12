'use strict'

/**
 * Hostinger reverse-proxy (LiteSpeed / hCDN) aborts streamed App Router
 * bodies and substitutes a 21-byte text/plain 500. Middleware redirects
 * survive because they are small and complete. Buffer HTML/JSON so the
 * proxy receives Content-Length instead of a chunked RSC/JSON stream.
 */
const fs = require('fs')
const http = require('http')
const path = require('path')
const { parse } = require('url')
const next = require('next')

process.env.NODE_ENV = process.env.NODE_ENV || 'production'

const hostname = '0.0.0.0'
const port = Number.parseInt(process.env.PORT || '3000', 10)
const MAX_BUFFER_BYTES = 6 * 1024 * 1024

try {
  fs.mkdirSync(path.join(__dirname, '.next', 'cache'), { recursive: true })
} catch (error) {
  console.warn('[vra-server] could not create .next/cache', error)
}

const app = next({ dev: false, hostname, port, dir: __dirname })
const handle = app.getRequestHandler()

function shouldBuffer(urlPath) {
  if (!urlPath) return true
  if (urlPath.startsWith('/_next/static')) return false
  if (urlPath.startsWith('/images/')) return false
  if (urlPath.startsWith('/favicon')) return false
  if (urlPath.includes('/download')) return false
  if (urlPath.includes('/view')) return false
  return true
}

function wrapForBuffering(res) {
  const chunks = []
  let total = 0
  let bypassed = false
  const originalWrite = res.write.bind(res)
  const originalEnd = res.end.bind(res)

  function flushPassthrough(chunk, encoding, callback) {
    bypassed = true
    res.write = originalWrite
    res.end = originalEnd
    if (chunk) return originalWrite(chunk, encoding, callback)
    return true
  }

  res.write = function write(chunk, encoding, callback) {
    if (bypassed) return originalWrite(chunk, encoding, callback)
    if (chunk) {
      const buf = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8')
      total += buf.length
      if (total > MAX_BUFFER_BYTES) {
        for (const queued of chunks) originalWrite(queued)
        chunks.length = 0
        return flushPassthrough(chunk, encoding, callback)
      }
      chunks.push(buf)
    }
    if (typeof encoding === 'function') encoding()
    else if (typeof callback === 'function') callback()
    return true
  }

  res.end = function end(chunk, encoding, callback) {
    if (bypassed) return originalEnd(chunk, encoding, callback)

    const cb =
      typeof chunk === 'function'
        ? chunk
        : typeof encoding === 'function'
          ? encoding
          : callback

    if (chunk && typeof chunk !== 'function') {
      const buf = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8')
      chunks.push(buf)
    }

    const body = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)
    try {
      res.removeHeader('transfer-encoding')
    } catch {
      // Header may already be sent; Content-Length still helps most proxies.
    }
    res.setHeader('content-length', String(body.length))
    return originalEnd(body, cb)
  }
}

app
  .prepare()
  .then(() => {
    http
      .createServer(async (req, res) => {
        const parsedUrl = parse(req.url || '/', true)
        const urlPath = parsedUrl.pathname || '/'

        res.on('finish', () => {
          if (res.statusCode >= 500) {
            console.error('[vra-server] 5xx', req.method, urlPath, res.statusCode)
          }
        })

        try {
          res.setHeader('x-vra-handler', 'server')
          if (shouldBuffer(urlPath)) wrapForBuffering(res)
          await handle(req, res, parsedUrl)
        } catch (error) {
          console.error('[vra-server] handler error', urlPath, error)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'text/plain; charset=utf-8')
            res.end('Internal Server Error')
          }
        }
      })
      .listen(port, hostname, () => {
        console.log(`[vra-server] listening on ${hostname}:${port}`)
      })
  })
  .catch((error) => {
    console.error('[vra-server] failed to start', error)
    process.exit(1)
  })
