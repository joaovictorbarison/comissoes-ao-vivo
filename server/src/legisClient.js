const fetch = require('node-fetch')
const BASE = process.env.LEGIS_API_BASE_URL || 'https://legis-api-portal-prd.al.sp.gov.br'
async function fetchLegis(path) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}
module.exports = { fetchLegis, BASE }
