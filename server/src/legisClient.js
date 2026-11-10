const fetch = require('node-fetch')
const BASE = process.env.LEGIS_API_BASE_URL || 'https://legis-api-portal-prd.al.sp.gov.br'

const _cache = new Map()
const TTL = parseInt(process.env.LEGIS_CACHE_TTL_MS || '600000', 10) // 10 min

async function fetchLegis(path) {
  const cached = _cache.get(path)
  if (cached && Date.now() - cached.t < TTL) return cached.data
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    if (data != null) {
      _cache.set(path, { t: Date.now(), data })
      if (_cache.size > 500) _cache.clear()
    }
    return data
  } catch { return null }
}
function clearLegisCache() { _cache.clear() }
module.exports = { fetchLegis, BASE, clearLegisCache }
