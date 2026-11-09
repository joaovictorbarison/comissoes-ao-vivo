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

router.get('/parlamentares-ativos', async (req, res) => {
  const ids = [12444,12445,12447,12455,1000000128]
  const seen = new Map()
  for (const id of ids) {
    const data = await fetchLegis(`/colegiado/membros/${id}`)
    if (Array.isArray(data)) {
      data.forEach(p => {
        if (!p.parlamentar) return
        if (p.dtFim && new Date(p.dtFim) < new Date()) return
        const key = p.nuMatriculaParlamentar || p.parlamentar
        if (!seen.has(key)) seen.set(key, { matricula: p.nuMatriculaParlamentar, nome: p.parlamentar })
      })
    }
  }
  const q = (req.query.q || '').toLowerCase()
  const all = [...seen.values()]
  const filtered = q ? all.filter(p => p.nome.toLowerCase().includes(q)) : all
  res.json(filtered)
})

module.exports = router
