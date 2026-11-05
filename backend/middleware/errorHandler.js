// Turns thrown errors into JSON responses. Express 5 forwards rejected async handlers here.
export function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message })
  }
  // Two saves of the same document overlapped and this one was based on an older version
  if (err.name === 'VersionError') {
    return res.status(409).json({ error: 'This was changed somewhere else at the same time. Please try again.' })
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value', fields: err.keyValue })
  }
  const status = err.status ?? 500
  if (status === 500) console.error(err)
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message })
}

// Throw from a route to send a specific status: throw httpError(404, 'Plan not found')
export function httpError(status, message) {
  return Object.assign(new Error(message), { status })
}
