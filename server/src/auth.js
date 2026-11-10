const crypto = require('crypto')
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
}
function signToken(payload, ttlSec=8*3600) {
  const header = base64url(JSON.stringify({alg:'HS256',typ:'JWT'}))
  const body = base64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+ttlSec }))
  const sig = crypto.createHmac('sha256', SECRET).update(header+'.'+body).digest()
  return header+'.'+body+'.'+base64url(sig)
}
function verifyToken(tok) {
  if (!tok || typeof tok !== 'string') return null
  const parts = tok.split('.')
  if (parts.length !== 3) return null
  const [h,b,s] = parts
  const sig = crypto.createHmac('sha256', SECRET).update(h+'.'+b).digest()
  const sigB64 = base64url(sig)
  if (sigB64 !== s) return null
  let payload
  try { payload = JSON.parse(Buffer.from(b,'base64').toString()) } catch { return null }
  if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null
  return payload
}
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  const tok = m ? m[1] : (req.query.token || '')
  const p = verifyToken(tok)
  if (!p) return res.status(401).json({ error:'unauthorized' })
  req.user = p
  next()
}
function requireRole(...roles) {
  return (req,res,next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error:'forbidden' })
    next()
  }
}
module.exports = { signToken, verifyToken, requireAuth, requireRole }
