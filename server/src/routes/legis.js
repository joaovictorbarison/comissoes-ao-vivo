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
  const data = await fetchLegis(`/colegiado/reuniao/${req.params.id}/pauta`)
  const items = data?.content ? data.content : (Array.isArray(data) ? data : [])
  res.json(items)
})

router.get('/colegiados/:id/membros', async (req, res) => {
  const data = await fetchLegis(`/colegiado/membros/${req.params.id}`)
  res.json(data || [])
})

module.exports = router
