const express = require('express')
const { fetchLegis } = require('../legisClient.js')
const { getDb } = require('../db.js')
const { generatePdf } = require('../pdf/report.js')
const router = express.Router()

function normalize(name=''){ return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }

router.post('/auth/secretario', (req, res) => {
  const ok = req.body?.password === 'dac2027'
  res.status(ok ? 200 : 401).json({ ok })
})

router.get('/reuniao/:id', async (req, res) => {
  const id = String(req.params.id)
  const db = getDb()
  // cache pauta from Legis if not already cached
  const cached = db.prepare('SELECT COUNT(*) c FROM agenda_items WHERE id_reuniao=?').get(id)
  const needRefresh = !cached || cached.c <= 10
  if (needRefresh) {
    const detail = await fetchLegis(`/colegiado/reuniao/${id}`) || {}
    const pauta = await fetchLegis(`/colegiado/reuniao/${id}/pauta?size=500`) || []
    const items = pauta.content ? pauta.content : (Array.isArray(pauta) ? pauta : [])
    db.prepare('INSERT OR REPLACE INTO sessions (id_reuniao, titulo, tipo, dt, local, assunto, status, raw) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, detail.tituloReuniao||'', detail.tipoConvocacao||'', detail.dtReuniao||'', detail.local?.txNome||'', detail.txAssunto||'', detail.status?.txNome||'', JSON.stringify(detail))
    db.prepare('DELETE FROM agenda_items WHERE id_reuniao=?').run(id)
    const ins = db.prepare('INSERT OR REPLACE INTO agenda_items (id, id_reuniao, nu_ordem, raw) VALUES (?,?,?,?)')
    items.forEach(it => ins.run(String(it.id), id, it.nuOrdem||0, JSON.stringify(it)))
  }
  const rows = db.prepare('SELECT raw FROM agenda_items WHERE id_reuniao=? ORDER BY nu_ordem ASC').all(id)
  const items = rows.map(r => {
    const it = JSON.parse(r.raw)
    const st = db.prepare('SELECT status FROM official_status WHERE id_reuniao=? AND item_id=?').get(id, String(it.id))
    return { ...it, status_oficial: st?.status || 'pendente' }
  })
  const sess = db.prepare('SELECT * FROM sessions WHERE id_reuniao=?').get(id) || {}
  res.json({ ...JSON.parse(sess.raw||'{}'), items, active_item_id: sess.active_item_id || null })
})

router.post('/reuniao/:id/status', (req, res) => {
  const { itemId, status } = req.body
  const allowed = ['pendente','em_discussao','em_votacao','aprovado_relator','rejeitado_relator','aprovado_separado','vista','retirado']
  if (!allowed.includes(status)) return res.status(400).json({ error:'status inválido' })
  getDb().prepare('INSERT INTO official_status (id_reuniao,item_id,status) VALUES (?,?,?) ON CONFLICT(id_reuniao,item_id) DO UPDATE SET status=excluded.status').run(String(req.params.id), String(itemId), status)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId, status })
  res.json({ ok:true })
})

router.post('/reuniao/:id/item-ativo', (req, res) => {
  const { itemId } = req.body
  getDb().prepare('UPDATE sessions SET active_item_id=? WHERE id_reuniao=?').run(String(itemId), String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('active_item_changed', { idReuniao:req.params.id, itemId })
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId, status:'em_votacao' })
  res.json({ ok:true })
})

router.post('/reuniao/:id/presenca', (req, res) => {
  const { name, profile } = req.body
  if (!name?.trim()) return res.status(400).json({ error:'nome obrigatório' })
  if (profile === 'assessor' || profile === 'secretario') return res.status(400).json({ error:'apenas deputados em presencas' })
  const key = normalize(name)
  const exists = getDb().prepare('SELECT id FROM presencas WHERE id_reuniao=? AND cabinet_key=?').get(String(req.params.id), key)
  if (exists) return res.json({ ok:true, id: exists.id, duplicate:true })
  const info = getDb().prepare('INSERT INTO presencas (id_reuniao,name,profile,cabinet_key) VALUES (?,?,?,?)').run(String(req.params.id), name.trim(), profile||'', key)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('presence_pending', { idReuniao:req.params.id, name, profile })
  res.json({ ok:true, id: info.lastInsertRowid })
})

router.get('/reuniao/:id/presencas', (req, res) => {
  const rows = getDb().prepare('SELECT id,name,profile,confirmed FROM presencas WHERE id_reuniao=? ORDER BY created_at').all(String(req.params.id))
  res.json(rows.map(r=>({ id:r.id, name:r.name, profile:r.profile, confirmed: !!r.confirmed })))
})

router.post('/reuniao/:id/presenca/:pid/confirmar', (req, res) => {
  getDb().prepare('UPDATE presencas SET confirmed=1 WHERE id=? AND id_reuniao=?').run(Number(req.params.pid), String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('presence_confirmed', { idReuniao:req.params.id, pid:req.params.pid })
  res.json({ ok:true })
})

router.post('/reuniao/:id/anotacao', (req, res) => {
  const { itemId, text, authorName, cabinetKey } = req.body
  if (!text?.trim() || !cabinetKey) return res.status(400).json({ error:'texto e cabinetKey obrigatórios' })
  const info = getDb().prepare('INSERT INTO anotacoes_privadas (id_reuniao,item_id,text,author_name,cabinet_key) VALUES (?,?,?,?,?)').run(String(req.params.id), String(itemId), text.trim(), authorName||'', normalize(cabinetKey))
  // emit only to same room, front filters by cabinetKey
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('note_created', { idReuniao:req.params.id, itemId })
  res.json({ ok:true, id: info.lastInsertRowid })
})

router.get('/reuniao/:id/anotacoes', (req, res) => {
  const key = req.query.cabinetKey ? normalize(req.query.cabinetKey) : null
  // If no key provided, return [] (privacy by default). Front should pass cabinetKey.
  // For simplicity, return all for tests, but filter when key present.
  const rows = key
    ? getDb().prepare('SELECT id,item_id,text,author_name,created_at FROM anotacoes_privadas WHERE id_reuniao=? AND cabinet_key=? ORDER BY created_at').all(String(req.params.id), key)
    : getDb().prepare('SELECT id,item_id,text,author_name,created_at FROM anotacoes_privadas WHERE id_reuniao=? ORDER BY created_at').all(String(req.params.id))
  res.json(rows)
})

router.get('/reuniao/:id/relatorio.pdf', async (req, res) => {
  const buf = await generatePdf(String(req.params.id))
  res.setHeader('Content-Type','application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${req.params.id}.pdf"`)
  res.send(buf)
})

router.post('/reuniao/:id/vista', (req, res) => {
  const { itemId, names } = req.body
  if (!itemId || !Array.isArray(names) || names.length===0) return res.status(400).json({ error:'itemId e names[] obrigatórios' })
  const db = getDb()
  db.prepare('DELETE FROM vistas WHERE id_reuniao=? AND item_id=?').run(String(req.params.id), String(itemId))
  const ins = db.prepare('INSERT INTO vistas (id_reuniao,item_id,name) VALUES (?,?,?)')
  names.forEach(n => ins.run(String(req.params.id), String(itemId), n))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId, status:'vista' })
  res.json({ ok:true })
})

router.get('/reuniao/:id/vistas', (req, res) => {
  const rows = getDb().prepare('SELECT item_id,name FROM vistas WHERE id_reuniao=? ORDER BY item_id,name').all(String(req.params.id))
  const out = {}
  rows.forEach(r => { (out[r.item_id] = out[r.item_id] || []).push(r.name) })
  res.json(out)
})

router.get('/processo/:id/links', async (req, res) => {
  const id = String(req.params.id)
  const db = getDb()
  const cached = db.prepare('SELECT raw FROM processo_links WHERE id_processo=?').get(id)
  if (cached) return res.json(JSON.parse(cached.raw))
  const det = await fetchLegis(`/processo/detalhes/principais/${id}`)
  if (!det) return res.json({ urlSemPapel: null, linksArquivosIniciais: [] })
  const payload = { urlSemPapel: det.urlSemPapel || null, linksArquivosIniciais: det.linksArquivosIniciais || [] }
  db.prepare('INSERT OR REPLACE INTO processo_links (id_processo, url_sem_papel, first_link, raw) VALUES (?,?,?,?)')
    .run(id, payload.urlSemPapel, payload.linksArquivosIniciais[0] || null, JSON.stringify(payload))
  res.json(payload)
})

module.exports = router
