const express = require('express')
const { fetchLegis } = require('../legisClient.js')
const { getDb } = require('../db.js')
const router = express.Router()

router.get('/reunioes', async (req, res) => {
  const qs = new URLSearchParams()
  if (req.query.dataInicio) qs.set('dataInicio', req.query.dataInicio)
  if (req.query.dataFim) qs.set('dataFim', req.query.dataFim)
  if (req.query.page !== undefined) qs.set('page', req.query.page)
  if (req.query.size !== undefined) qs.set('size', req.query.size)
  const data = await fetchLegis(`/colegiado/reunioes${qs.toString() ? '?' + qs.toString() : ''}`)
  res.json(data || { content: [], totalElements: 0 })
})

router.get('/reuniao/:id', async (req, res) => {
  const data = await fetchLegis(`/colegiado/reuniao/${req.params.id}`)
  res.json(data || null)
})

router.get('/reuniao/:id/pauta', async (req, res) => {
  const data = await fetchLegis(`/colegiado/reuniao/${req.params.id}/pauta?size=500`)
  const items = data?.content ? data.content : (Array.isArray(data) ? data : [])
  res.json(items)
})

router.get('/colegiados/:id/membros', async (req, res) => {
  const data = await fetchLegis(`/colegiado/membros/${req.params.id}`)
  res.json(data || [])
})

let _cacheParlamentares = null
let _cacheAt = 0
router.get('/parlamentares-ativos', async (req, res) => {
  const now = Date.now()
  if (!_cacheParlamentares || now - _cacheAt > 60*60*1000) {
    const data = await fetchLegis(`/parlamentar-portal?filtroLegislatura=20&filtroEmExercicioPesquisa=S`) || { content: [] }
    const list = data.content || data || []
    _cacheParlamentares = list.map(p => ({ matricula: p.nuMatricula, nome: p.txNomeParlamentar, partido: p.txPartido || '' })).filter(p=>p.nome).sort((a,b)=>a.nome.localeCompare(b.nome))
    _cacheAt = now
  }
  const q = (req.query.q || '').toLowerCase()
  const filtered = q ? _cacheParlamentares.filter(p => p.nome.toLowerCase().includes(q)) : _cacheParlamentares
  res.json(filtered)
})

module.exports = router
