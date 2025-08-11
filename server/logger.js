const crypto = require('crypto');

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
};

const DEFAULT_LEVEL = process.env.LOG_LEVEL ? String(process.env.LOG_LEVEL).toLowerCase() : 'info';
const CURRENT_LEVEL_NUM = LOG_LEVELS[DEFAULT_LEVEL] ?? LOG_LEVELS.info;

function shouldLog(level) {
  const levelNum = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  return levelNum >= CURRENT_LEVEL_NUM;
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function redactValue(value) {
  if (value === undefined) return value;
  if (value === null) return null;
  if (typeof value === 'string') return '[REDACTED]';
  if (typeof value === 'number' || typeof value === 'boolean') return '[REDACTED]';
  return '[REDACTED]';
}

const REDACT_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'access_token',
  'refresh_token',
  'client_secret',
  'secret',
  'password',
  'key',
];

function shouldRedactKey(key) {
  const lowerKey = String(key).toLowerCase();
  return REDACT_KEYS.some((rk) => lowerKey.includes(rk));
}

function safeSerialize(input, depth = 0, seen = new WeakSet()) {
  if (input === null || input === undefined) return input;
  if (depth > 5) return '[depth_limit]';
  if (typeof input === 'function') return `[function ${input.name || 'anonymous'}]`;
  if (typeof input !== 'object') return input;

  if (seen.has(input)) return '[circular]';
  seen.add(input);

  if (Array.isArray(input)) {
    return input.slice(0, 50).map((item) => safeSerialize(item, depth + 1, seen));
  }

  if (input instanceof Error) {
    return serializeError(input);
  }

  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (shouldRedactKey(key)) {
      output[key] = redactValue(value);
      continue;
    }
    if (key === 'req' || key === 'res' || key === 'request' || key === 'response') {
      output[key] = '[omitted]';
      continue;
    }
    output[key] = safeSerialize(value, depth + 1, seen);
  }
  return output;
}

function log(level, message, meta) {
  if (!shouldLog(level)) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...safeSerialize(meta),
  };
  try {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  } catch {
    // eslint-disable-next-line no-console
    console.log(entry);
  }
}

const logger = {
  trace: (msg, meta) => log('trace', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

function serializeError(err) {
  if (!err) return null;
  return {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  };
}

function requestIdMiddleware(req, res, next) {
  const headerId = req.headers['x-request-id'];
  const generatedId = crypto.randomUUID();
  const requestId = (typeof headerId === 'string' && headerId.trim()) ? headerId : generatedId;
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

function requestLoggingMiddleware(req, res, next) {
  const ignorePaths = new Set(['/api/health']);
  if (ignorePaths.has(req.path)) return next();

  const start = process.hrtime.bigint();
  const { method, path } = req;
  const requestId = req.id;

  function onFinish() {
    res.removeListener('finish', onFinish);
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    logger.info('request_completed', {
      requestId,
      method,
      path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
    });
  }

  res.on('finish', onFinish);
  next();
}

module.exports = {
  logger,
  requestIdMiddleware,
  requestLoggingMiddleware,
  serializeError,
  redact: safeSerialize, // expose serializer with redaction
};


