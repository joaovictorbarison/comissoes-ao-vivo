const express = require('express')
const { fetchLegis } = require('../legisClient.js')
const { getDb } = require('../db.js')
const { generatePdf, generateAssessoriaPdf } = require('../pdf/report.js')
const router = express.Router()
const { requireAuth } = require('../auth.js')

function normalize(name=''){ return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
function formatName(name='') {
  return String(name).toLowerCase().split(' ').map(w => ['de','da','do','das','dos','e'].includes(w) ? w : w.charAt(0).toUpperCase()+w.slice(1)).join(' ').trim()
}
function isEncerrada(id) {
  const s = getDb().prepare('SELECT encerrada_em FROM sessions WHERE id_reuniao=?').get(String(id))
  return !!(s && s.encerrada_em)
}

router.post('/auth/secretario', (req, res) => {
  const expected = (process.env.SECRETARIO_SENHA || 'dac2027').trim()
  const sent = typeof req.body?.password === 'string' ? req.body.password.trim() : ''
  const ok = sent === expected
  if (!ok) return res.status(401).json({ ok:false })
  const { signToken } = require('../auth.js')
  const token = signToken({ role:'secretario', name: (req.body?.name || 'Secretário').trim() })
  res.json({ ok:true, token })
})

router.post('/auth/identificar', (req, res) => {
  const { profile, name, deputadoVinculado } = req.body || {}
  if (!profile || !name) return res.status(400).json({ error:'profile e name obrigatórios' })
  const { signToken } = require('../auth.js')
  const token = signToken({ role: profile, name, deputadoVinculado: deputadoVinculado || null })
  res.json({ ok:true, token })
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
  const sess = db.prepare('SELECT * FROM sessions WHERE id_reuniao=?').get(id) || {}
  const encerrada = !!sess.encerrada_em
  const items = rows.map(r => {
    const it = JSON.parse(r.raw)
    const st = db.prepare('SELECT status FROM official_status WHERE id_reuniao=? AND item_id=?').get(id, String(it.id))
    let status = st?.status || 'pendente'
    if (encerrada && ['pendente','em_discussao','em_votacao'].includes(status)) status = 'nao_deliberado'
    return { ...it, status_oficial: status }
  })
  res.json({ ...JSON.parse(sess.raw||'{}'), items, active_item_id: sess.active_item_id || null, encerrada, iniciada: !!sess.iniciada })
})

router.post('/reuniao/:id/status', requireAuth, (req, res) => {
  const { itemId, status } = req.body
  const allowed = ['pendente','em_discussao','em_votacao','aprovado_relator','rejeitado_relator','aprovado_separado','vista','retirado']
  if (!allowed.includes(status)) return res.status(400).json({ error:'status inválido' })
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  const db = getDb()
  // garante linha de sessão antes de marcar iniciada
  db.prepare('INSERT OR IGNORE INTO sessions (id_reuniao) VALUES (?)').run(String(req.params.id))
  db.prepare('UPDATE sessions SET iniciada=1 WHERE id_reuniao=?').run(String(req.params.id))
  // se registrar status em um item, desfaz "em discussão"/"em votação" dos demais (volta a pendente)
  if (status !== 'pendente') {
    const others = db.prepare("SELECT item_id FROM official_status WHERE id_reuniao=? AND status IN ('em_discussao','em_votacao') AND item_id<>?").all(String(req.params.id), String(itemId))
    others.forEach(o => {
      db.prepare('UPDATE official_status SET status=? WHERE id_reuniao=? AND item_id=?').run('pendente', String(req.params.id), o.item_id)
      req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId: o.item_id, status:'pendente' })
    })
  }
  db.prepare('INSERT INTO official_status (id_reuniao,item_id,status) VALUES (?,?,?) ON CONFLICT(id_reuniao,item_id) DO UPDATE SET status=excluded.status').run(String(req.params.id), String(itemId), status)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId, status })
  res.json({ ok:true })
})

router.post('/reuniao/:id/item-ativo', requireAuth, (req, res) => {
  const { itemId } = req.body
  getDb().prepare('UPDATE sessions SET active_item_id=? WHERE id_reuniao=?').run(String(itemId), String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('active_item_changed', { idReuniao:req.params.id, itemId })
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId, status:'em_votacao' })
  res.json({ ok:true })
})

router.post('/reuniao/:id/presenca', requireAuth, (req, res) => {
  const { name, profile, manual } = req.body
  if (!name?.trim()) return res.status(400).json({ error:'nome obrigatório' })
  if (profile === 'assessor' || profile === 'secretario') return res.status(400).json({ error:'apenas deputados em presencas' })
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  const key = normalize(name)
  const exists = getDb().prepare('SELECT id, origem, confirmed FROM presencas WHERE id_reuniao=? AND cabinet_key=?').get(String(req.params.id), key)
  if (exists) {
    // login após marcação manual: vira pendente novamente para nova confirmação
    if (!manual && exists.origem === 'manual') {
      getDb().prepare("UPDATE presencas SET origem='login', confirmed=0 WHERE id=?").run(exists.id)
      req.app.get('io')?.to('reuniao:'+req.params.id).emit('presence_pending', { idReuniao:req.params.id, name, profile })
    }
    return res.json({ ok:true, id: exists.id, duplicate:true })
  }
  const origem = manual ? 'manual' : 'login'
  const confirmed = manual ? 1 : 0
  const info = getDb().prepare('INSERT INTO presencas (id_reuniao,name,profile,cabinet_key,origem,confirmed) VALUES (?,?,?,?,?,?)').run(String(req.params.id), name.trim(), profile||'', key, origem, confirmed)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit(manual ? 'presence_confirmed' : 'presence_pending', { idReuniao:req.params.id, name, profile })
  res.json({ ok:true, id: info.lastInsertRowid })
})

router.get('/reuniao/:id/presencas', (req, res) => {  const rows = getDb().prepare('SELECT id,name,profile,confirmed,origem FROM presencas WHERE id_reuniao=? ORDER BY created_at').all(String(req.params.id))
  res.json(rows.map(r=>({ id:r.id, name:r.name, profile:r.profile, confirmed: !!r.confirmed, origem: r.origem || 'login' })))
})

router.delete('/reuniao/:id/presencas', requireAuth, (req, res) => {
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  getDb().prepare('DELETE FROM presencas WHERE id_reuniao=?').run(String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('presence_confirmed', { idReuniao:req.params.id, cleared:true })
  res.json({ ok:true })
})

router.post('/reuniao/:id/presenca/:pid/confirmar', requireAuth, (req, res) => {
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  getDb().prepare('UPDATE presencas SET confirmed=1 WHERE id=? AND id_reuniao=?').run(Number(req.params.pid), String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('presence_confirmed', { idReuniao:req.params.id, pid:req.params.pid })
  res.json({ ok:true })
})

router.delete('/reuniao/:id/presenca/:pid', requireAuth, (req, res) => {
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  getDb().prepare('DELETE FROM presencas WHERE id=? AND id_reuniao=?').run(Number(req.params.pid), String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('presence_confirmed', { idReuniao:req.params.id, pid:req.params.pid, deleted:true })
  res.json({ ok:true })
})

router.post('/reuniao/:id/iniciar', requireAuth, async (req, res) => {
  const id = String(req.params.id)
  const db = getDb()
  const sess = db.prepare('SELECT * FROM sessions WHERE id_reuniao=?').get(id)
  if (!sess) {
    // trigger cache load via GET handler logic (fetch Legis)
    const detail = await fetchLegis(`/colegiado/reuniao/${id}`) || {}
    const pauta = await fetchLegis(`/colegiado/reuniao/${id}/pauta?size=500`) || []
    const items = pauta.content ? pauta.content : (Array.isArray(pauta) ? pauta : [])
    db.prepare('INSERT OR REPLACE INTO sessions (id_reuniao, titulo, tipo, dt, local, assunto, status, raw) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, detail.tituloReuniao||'', detail.tipoConvocacao||'', detail.dtReuniao||'', detail.local?.txNome||'', detail.txAssunto||'', detail.status?.txNome||'', JSON.stringify(detail))
    const ins = db.prepare('INSERT OR REPLACE INTO agenda_items (id, id_reuniao, nu_ordem, raw) VALUES (?,?,?,?)')
    items.forEach(it => ins.run(String(it.id), id, it.nuOrdem||0, JSON.stringify(it)))
  }
  db.prepare('UPDATE sessions SET iniciada=1, encerrada_em=NULL WHERE id_reuniao=?').run(id)
  req.app.get('io')?.to('reuniao:'+id).emit('official_status_changed', { idReuniao:id })
  res.json({ ok:true, iniciada:true })
})

router.post('/reuniao/:id/encerrar', requireAuth, (req, res) => {
  getDb().prepare("UPDATE sessions SET encerrada_em=datetime('now'), iniciada=1 WHERE id_reuniao=?").run(String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id })
  res.json({ ok:true, encerrada:true })
})

router.post('/reuniao/:id/reabrir', requireAuth, (req, res) => {
  getDb().prepare('UPDATE sessions SET encerrada_em=NULL, iniciada=1 WHERE id_reuniao=?').run(String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id })
  res.json({ ok:true, encerrada:false })
})

router.post('/reuniao/:id/limpar', requireAuth, (req, res) => {
  const id = String(req.params.id)
  const db = getDb()
  db.prepare('DELETE FROM official_status WHERE id_reuniao=?').run(id)
  db.prepare('DELETE FROM vistas WHERE id_reuniao=?').run(id)
  db.prepare('DELETE FROM votacao_simbolica WHERE id_reuniao=?').run(id)
  db.prepare('DELETE FROM votos_nominais WHERE id_reuniao=?').run(id)
  db.prepare('DELETE FROM anotacoes_secretario WHERE id_reuniao=?').run(id)
  db.prepare('UPDATE sessions SET active_item_id=NULL, encerrada_em=NULL, iniciada=0 WHERE id_reuniao=?').run(id)
  req.app.get('io')?.to('reuniao:'+id).emit('official_status_changed', { idReuniao:id })
  res.json({ ok:true })
})

router.get('/sessoes', (req, res) => {
  // backfill: reunião com algum status/vista mas iniciada=0 considerada iniciada (compat com dados antigos)
  getDb().prepare('UPDATE sessions SET iniciada=1 WHERE iniciada=0 AND id_reuniao IN (SELECT DISTINCT id_reuniao FROM official_status)').run()
  const rows = getDb().prepare('SELECT id_reuniao, iniciada, encerrada_em FROM sessions').all()
  const out = {}
  rows.forEach(r => { out[r.id_reuniao] = { iniciada: !!r.iniciada, encerrada: !!r.encerrada_em } })
  res.json(out)
})

router.post('/reuniao/:id/anotacao', requireAuth, (req, res) => {
  const { itemId, text, authorName, cabinetKey } = req.body
  if (!text?.trim() || !cabinetKey) return res.status(400).json({ error:'texto e cabinetKey obrigatórios' })
  const depKey = normalize(cabinetKey)
  const hasVinculo = getDb().prepare('SELECT id FROM vinculos WHERE deputado_key=? AND status=?').get(depKey, 'aceito')
  if (!hasVinculo) return res.status(403).json({ error:'vínculo pendente ou recusado' })
  const info = getDb().prepare('INSERT INTO anotacoes_privadas (id_reuniao,item_id,text,author_name,cabinet_key) VALUES (?,?,?,?,?)').run(String(req.params.id), String(itemId), text.trim(), authorName||'', depKey)
  // emit only to same room, front filters by cabinetKey
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('note_created', { idReuniao:req.params.id, itemId })
  res.json({ ok:true, id: info.lastInsertRowid })
})

router.get('/reuniao/:id/anotacoes', (req, res) => {
  const key = req.query.cabinetKey ? normalize(req.query.cabinetKey) : null
  if (!key) return res.json([])
  const rows = getDb().prepare('SELECT id,item_id,text,author_name,created_at FROM anotacoes_privadas WHERE id_reuniao=? AND cabinet_key=? ORDER BY created_at').all(String(req.params.id), key)
  res.json(rows)
})

router.get('/reuniao/:id/relatorio.pdf', async (req, res) => {
  const buf = await generatePdf(String(req.params.id))
  res.setHeader('Content-Type','application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-${req.params.id}.pdf"`)
  res.send(buf)
})

router.get('/reuniao/:id/relatorio-assessoria.pdf', async (req, res) => {
  const buf = await generateAssessoriaPdf(String(req.params.id), req.query.cabinetKey || '')
  res.setHeader('Content-Type','application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="relatorio-assessoria-${req.params.id}.pdf"`)
  res.send(buf)
})

router.post('/reuniao/:id/vista', requireAuth, (req, res) => {
  const { itemId, names } = req.body
  if (!itemId || !Array.isArray(names)) return res.status(400).json({ error:'itemId e names[] obrigatórios' })
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  const db = getDb()
  db.prepare('UPDATE sessions SET iniciada=1 WHERE id_reuniao=?').run(String(req.params.id))
  db.prepare('DELETE FROM vistas WHERE id_reuniao=? AND item_id=?').run(String(req.params.id), String(itemId))
  if (names.length===0) {
    db.prepare('INSERT INTO official_status (id_reuniao,item_id,status) VALUES (?,?,?) ON CONFLICT(id_reuniao,item_id) DO UPDATE SET status=excluded.status').run(String(req.params.id), String(itemId), 'pendente')
    req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId, status:'pendente' })
    return res.json({ ok:true, cleared:true })
  }
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

router.post('/vinculos', (req, res) => {
  const { assessorName, deputadoName } = req.body
  if (!assessorName?.trim() || !deputadoName?.trim()) return res.status(400).json({ error:'assessorName e deputadoName obrigatórios' })
  const aKey = normalize(assessorName), dKey = normalize(deputadoName)
  const existing = getDb().prepare('SELECT id FROM vinculos WHERE assessor_key=? AND deputado_key=?').get(aKey, dKey)
  if (existing) return res.json({ ok:true, id: existing.id, duplicate:true })
  const info = getDb().prepare('INSERT INTO vinculos (assessor_name, deputado_name, assessor_key, deputado_key) VALUES (?,?,?,?)').run(assessorName.trim(), deputadoName.trim(), aKey, dKey)
  res.json({ ok:true, id: info.lastInsertRowid })
})

router.post('/reuniao/:id/vinculo', requireAuth, (req, res) => {
  const { assessorName, deputadoName } = req.body
  if (!assessorName?.trim() || !deputadoName?.trim()) return res.status(400).json({ error:'assessorName e deputadoName obrigatórios' })
  const aKey = normalize(assessorName), dKey = normalize(deputadoName)
  const existing = getDb().prepare('SELECT id FROM vinculos WHERE assessor_key=? AND deputado_key=?').get(aKey, dKey)
  if (existing) return res.json({ ok:true, id: existing.id, duplicate:true })
  const info = getDb().prepare('INSERT INTO vinculos (id_reuniao, assessor_name, deputado_name, assessor_key, deputado_key) VALUES (?,?,?,?,?)').run(String(req.params.id), assessorName.trim(), deputadoName.trim(), aKey, dKey)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('vinculo_changed', { idReuniao:req.params.id, id: info.lastInsertRowid })
  res.json({ ok:true, id: info.lastInsertRowid })
})

router.get('/vinculos', (req, res) => {
  const dKey = req.query.deputadoKey ? normalize(req.query.deputadoKey) : null
  if (!dKey) {
    const auth = req.headers.authorization || ''
    const m = auth.match(/^Bearer\s+(.+)$/i)
    const { verifyToken } = require('../auth.js')
    const p = m ? verifyToken(m[1]) : null
    if (!p || p.role !== 'secretario') return res.status(401).json({ error:'unauthorized' })
  }
  const rows = dKey
    ? getDb().prepare('SELECT id, id_reuniao, assessor_name, deputado_name, status FROM vinculos WHERE deputado_key=? ORDER BY created_at').all(dKey)
    : getDb().prepare('SELECT id, id_reuniao, assessor_name, deputado_name, status FROM vinculos ORDER BY created_at').all()
  const seen = new Map()
  rows.forEach(r => {
    const aKey = normalize(r.assessor_name)
    if (!seen.has(aKey)) seen.set(aKey, r)
    else if (seen.get(aKey).status !== 'aceito' && r.status === 'aceito') seen.set(aKey, r)
  })
  res.json([...seen.values()])
})

router.get('/reuniao/:id/vinculos', (req, res) => {
  const dKey = req.query.deputadoKey ? normalize(req.query.deputadoKey) : null
  // dedupe global por assessor: um pedido por assessor independente da reunião
  let rows
  if (dKey) rows = getDb().prepare('SELECT id, assessor_name, deputado_name, status FROM vinculos WHERE deputado_key=? ORDER BY created_at').all(dKey)
  else rows = getDb().prepare('SELECT id, assessor_name, deputado_name, status FROM vinculos WHERE id_reuniao=? ORDER BY created_at').all(String(req.params.id))
  const seen = new Map()
  rows.forEach(r => {
    const aKey = normalize(r.assessor_name)
    if (!seen.has(aKey)) seen.set(aKey, r)
    else if (seen.get(aKey).status !== 'aceito' && r.status === 'aceito') seen.set(aKey, r)
  })
  res.json([...seen.values()])
})

router.post('/reuniao/:id/vinculo/:vid/aceitar', requireAuth, (req, res) => {
  getDb().prepare('UPDATE vinculos SET status=? WHERE id=? AND id_reuniao=?').run('aceito', Number(req.params.vid), String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('vinculo_changed', { idReuniao:req.params.id, id: req.params.vid })
  res.json({ ok:true })
})

router.post('/reuniao/:id/vinculo/:vid/recusar', requireAuth, (req, res) => {
  getDb().prepare('UPDATE vinculos SET status=? WHERE id=? AND id_reuniao=?').run('recusado', Number(req.params.vid), String(req.params.id))
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('vinculo_changed', { idReuniao:req.params.id, id: req.params.vid })
  res.json({ ok:true })
})

router.delete('/reuniao/:id/vinculo/:vid', requireAuth, (req, res) => {
  const row = getDb().prepare('SELECT * FROM vinculos WHERE id=?').get(Number(req.params.vid))
  if (row) {
    getDb().prepare('DELETE FROM anotacoes_privadas WHERE author_name=? AND cabinet_key=?').run(row.assessor_name, row.deputado_key)
    getDb().prepare('DELETE FROM vinculos WHERE id=?').run(Number(req.params.vid))
  }
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('vinculo_changed', { idReuniao:req.params.id, id: req.params.vid })
  res.json({ ok:true })
})

router.delete('/vinculos/:vid', requireAuth, (req, res) => {
  const row = getDb().prepare('SELECT * FROM vinculos WHERE id=?').get(Number(req.params.vid))
  if (row) {
    getDb().prepare('DELETE FROM anotacoes_privadas WHERE author_name=? AND cabinet_key=?').run(row.assessor_name, row.deputado_key)
    getDb().prepare('DELETE FROM vinculos WHERE id=?').run(Number(req.params.vid))
    req.app.get('io')?.to('reuniao:'+row.id_reuniao).emit('vinculo_changed', { idReuniao: row.id_reuniao, id: row.id })
    req.app.get('io')?.to('reuniao:'+row.id_reuniao).emit('note_created', { idReuniao: row.id_reuniao })
  }
  res.json({ ok:true })
})

router.post('/reuniao/:id/votacao-simbolica', requireAuth, async (req, res) => {
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  const { itemId, decision } = req.body
  const id = String(req.params.id)
  const statusFinal = decision === 'rejeitado' ? 'rejeitado_simbolico' : 'aprovado_simbolico'
  const allPresent = getDb().prepare('SELECT name FROM presencas WHERE id_reuniao=? AND confirmed=1 ORDER BY name').all(id).map(r=>r.name)
  let grouped = { efetivos: [], substitutos: [], outros: [] }
  try {
    const sessRow = getDb().prepare('SELECT raw FROM sessions WHERE id_reuniao=?').get(id)
    let raw = {}
    try { raw = JSON.parse(sessRow?.raw||'{}') } catch {}
    const colegiados = raw.colegiadosRelacionados || []
    const byKey = new Map()
    for (const col of colegiados) {
      const membres = await fetchLegis(`/colegiado/membros/${col.id}`) || []
      membres.forEach(m => {
        const k = normalize(m.parlamentar || '')
        if (!byKey.has(k)) byKey.set(k, m)
      })
    }
    const det = await fetchLegis(`/parlamentar-portal?filtroLegislatura=20&filtroEmExercicioPesquisa=S`) || {}
    const portalMap = {}
    ;(det.content||[]).forEach(p=>{ portalMap[normalize(p.txNomeParlamentar||'')] = p.txPartido||'' })
    allPresent.forEach(name=>{
      const mem = byKey.get(normalize(name))
      const party = mem ? (mem.federacao||mem.partido||'') : (portalMap[normalize(name)] || '')
      const cat = mem ? (/substituto/i.test(mem.ocupacao||'') ? 'substitutos' : 'efetivos') : 'outros'
      grouped[cat].push(`${formatName(name)} — ${party || 'Sem partido'}`)
    })
  } catch {
    grouped.outros = allPresent.map(n => `${formatName(n)} — Sem partido`)
  }
  getDb().prepare('INSERT OR REPLACE INTO votacao_simbolica (id_reuniao,item_id,deputados) VALUES (?,?,?)').run(id, String(itemId), JSON.stringify(grouped))
  getDb().prepare('INSERT INTO official_status (id_reuniao,item_id,status) VALUES (?,?,?) ON CONFLICT(id_reuniao,item_id) DO UPDATE SET status=excluded.status').run(id, String(itemId), statusFinal)
  req.app.get('io')?.to('reuniao:'+id).emit('official_status_changed', { idReuniao:id, itemId, status: statusFinal })
  res.json({ ok:true, deputados: grouped })
})

router.get('/reuniao/:id/votacoes-simbolicas', (req, res) => {
  const rows = getDb().prepare('SELECT item_id,deputados FROM votacao_simbolica WHERE id_reuniao=?').all(String(req.params.id))
  const out = {}
  rows.forEach(r=>{ out[r.item_id] = JSON.parse(r.deputados) })
  res.json(out)
})

router.post('/reuniao/:id/voto-nominal', requireAuth, (req, res) => {
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  const { itemId, deputado, voto, outro } = req.body
  if (!itemId || !deputado || !voto) return res.status(400).json({ error:'itemId deputado voto obrigatórios' })
  if (!['favoravel','contrario','outro'].includes(voto)) return res.status(400).json({ error:'voto inválido' })
  getDb().prepare('INSERT INTO votos_nominais (id_reuniao,item_id,deputado_name,voto,outro_texto) VALUES (?,?,?,?,?) ON CONFLICT(id_reuniao,item_id,deputado_name) DO UPDATE SET voto=excluded.voto, outro_texto=excluded.outro_texto').run(String(req.params.id), String(itemId), deputado, voto, outro||null)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('voto_nominal_changed', { idReuniao:req.params.id, itemId })
  res.json({ ok:true })
})

router.get('/reuniao/:id/votos-nominais/:itemId', (req, res) => {
  const rows = getDb().prepare('SELECT deputado_name,voto,outro_texto FROM votos_nominais WHERE id_reuniao=? AND item_id=? ORDER BY deputado_name').all(String(req.params.id), String(req.params.itemId))
  res.json(rows)
})

router.delete('/reuniao/:id/voto-nominal/:itemId/:deputado', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM votos_nominais WHERE id_reuniao=? AND item_id=? AND deputado_name=?').run(String(req.params.id), String(req.params.itemId), req.params.deputado)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('voto_nominal_changed', { idReuniao:req.params.id, itemId:req.params.itemId })
  res.json({ ok:true })
})

router.get('/reuniao/:id/votos-nominais', (req, res) => {
  const rows = getDb().prepare('SELECT item_id,deputado_name,voto,outro_texto FROM votos_nominais WHERE id_reuniao=?').all(String(req.params.id))
  const out = {}
  rows.forEach(r=>{ (out[r.item_id]=out[r.item_id]||[]).push(r) })
  res.json(out)
})

router.post('/reuniao/:id/votacao-nominal/finalizar', requireAuth, (req, res) => {
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  const { itemId, decisaoManual } = req.body
  const votes = getDb().prepare('SELECT voto FROM votos_nominais WHERE id_reuniao=? AND item_id=?').all(String(req.params.id), String(itemId))
  const fav = votes.filter(v=>v.voto==='favoravel').length
  const contra = votes.filter(v=>v.voto==='contrario').length
  const outro = votes.filter(v=>v.voto==='outro').length
  const needsManual = outro >= 4
  if (needsManual && !decisaoManual) return res.json({ ok:false, needsManual:true, outro })
  const approved = decisaoManual ? (decisaoManual==='aprovado') : (fav > contra)
  const status = approved ? 'aprovado_nominal' : 'rejeitado_nominal'
  getDb().prepare('INSERT INTO official_status (id_reuniao,item_id,status) VALUES (?,?,?) ON CONFLICT(id_reuniao,item_id) DO UPDATE SET status=excluded.status').run(String(req.params.id), String(itemId), status)
  req.app.get('io')?.to('reuniao:'+req.params.id).emit('official_status_changed', { idReuniao:req.params.id, itemId, status })
  res.json({ ok:true, status, fav, contra, outro })
})

router.get('/reuniao/:id/anotacoes-secretario', (req, res) => {
  const rows = getDb().prepare('SELECT item_id,texto FROM anotacoes_secretario WHERE id_reuniao=?').all(String(req.params.id))
  const out = {}
  rows.forEach(r=>{ out[r.item_id]=r.texto })
  res.json(out)
})

router.post('/reuniao/:id/item-nota', requireAuth, (req, res) => {
  if (isEncerrada(req.params.id)) return res.status(400).json({ error:'reunião encerrada' })
  const { itemId, texto } = req.body
  if (!itemId) return res.status(400).json({ error:'itemId obrigatório' })
  getDb().prepare('INSERT INTO anotacoes_secretario (id_reuniao,item_id,texto) VALUES (?,?,?) ON CONFLICT(id_reuniao,item_id) DO UPDATE SET texto=excluded.texto').run(String(req.params.id), String(itemId), texto||'')
  res.json({ ok:true })
})

module.exports = router
