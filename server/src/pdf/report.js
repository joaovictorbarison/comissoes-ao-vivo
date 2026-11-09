const PDFDocument = require('pdfkit')
const { getDb } = require('../db.js')

function normalize(name=''){ return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }

async function renderPdf(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    build(doc)
    doc.end()
  })
}

function loadMeeting(idReuniao) {
  const db = getDb()
  const sess = db.prepare('SELECT * FROM sessions WHERE id_reuniao=?').get(String(idReuniao)) || {}
  let raw = {}
  try { raw = JSON.parse(sess.raw||'{}') } catch {}
  const items = db.prepare('SELECT raw FROM agenda_items WHERE id_reuniao=? ORDER BY nu_ordem').all(String(idReuniao)).map(r=>{
    const it = JSON.parse(r.raw)
    const st = db.prepare('SELECT status FROM official_status WHERE id_reuniao=? AND item_id=?').get(String(idReuniao), String(it.id))
    return { ...it, status_oficial: st?.status||'pendente' }
  })
  const pres = db.prepare('SELECT name,profile FROM presencas WHERE id_reuniao=? AND confirmed=1 ORDER BY name').all(String(idReuniao))
  const vistasRows = db.prepare('SELECT item_id,name FROM vistas WHERE id_reuniao=? ORDER BY item_id,name').all(String(idReuniao))
  const vistas = {}
  vistasRows.forEach(r => { (vistas[r.item_id] = vistas[r.item_id] || []).push(r.name) })
  return { db, sess, raw, items, pres, vistas }
}

async function generatePdf(idReuniao) {
  const { db, sess, raw, items, pres, vistas } = loadMeeting(idReuniao)
  const header = [raw.nuReuniao ? `Nº ${raw.nuReuniao}`:'', raw.tipoConvocacao||raw.tituloReuniao||'', raw.dtReuniao||'', raw.local?.txNome||'', raw.solicitante||''].filter(Boolean).join(' — ')
  const buf = await renderPdf(doc => {
    doc.fontSize(18).text('Comissões Ao Vivo 2 — Relatório Final', { align:'center' })
    doc.fontSize(11).moveDown(0.5)
    doc.text(`Reunião: ${header}`)
    doc.moveDown()
    doc.fontSize(13).text('Presenças confirmadas')
    doc.fontSize(10)
    pres.forEach(p => doc.text(`• ${p.name} (${p.profile})`))
    if (!pres.length) doc.text('• Nenhuma presença confirmada.')
    doc.moveDown()
    doc.fontSize(13).text('Itens da pauta — deliberações e vistas')
    doc.fontSize(10).moveDown(0.3)
    items.forEach(i => {
      const proc = i.processoDadosView || {}
      doc.text(`${i.nuOrdem || ''}. ${proc.txDescricao || ''} — ${proc.txEmenta || ''}`, { width: 515, lineGap: 3 })
      let extra = `Status: ${i.status_oficial}`
      if (vistas[i.id] && vistas[i.id].length) extra += ` • Vista solicitada por: ${vistas[i.id].join(', ')}`
      doc.fillColor('#333').text(extra, { width: 515, lineGap: 3 }).fillColor('black')
      doc.moveDown(0.5)
    })
  })
  db.prepare('INSERT INTO relatorio_final (id_reuniao, snapshot) VALUES (?,?)').run(String(idReuniao), JSON.stringify({ header, items: items.length, pres: pres.length }))
  db.prepare("UPDATE sessions SET encerrada_em=datetime('now') WHERE id_reuniao=?").run(String(idReuniao))
  return buf
}

async function generateAssessoriaPdf(idReuniao, cabinetKey) {
  const { sess, raw, items, vistas } = loadMeeting(idReuniao)
  const db = getDb()
  const isEncerrada = !!sess.encerrada_em
  const header = [raw.nuReuniao ? `Nº ${raw.nuReuniao}`:'', raw.tipoConvocacao||raw.tituloReuniao||'', raw.dtReuniao||'', raw.local?.txNome||'', raw.solicitante||''].filter(Boolean).join(' — ')
  const titulo = isEncerrada ? 'Relatório Final da Reunião — Assessoria Parlamentar' : 'Relatório de Orientações da Assessoria para a Reunião'
  const withNotes = items.map(i => {
    const notes = cabinetKey ? db.prepare('SELECT author_name,text FROM anotacoes_privadas WHERE id_reuniao=? AND item_id=? AND cabinet_key=? ORDER BY created_at').all(String(idReuniao), String(i.id), normalize(cabinetKey)) : []
    return { ...i, notes }
  })
  return renderPdf(doc => {
    doc.fontSize(16).text(`Comissões Ao Vivo 2 — ${titulo}`, { align:'center' })
    doc.fontSize(11).moveDown(0.5)
    doc.text(`Reunião: ${header}`)
    doc.text(`Encerrada: ${isEncerrada ? 'Sim' : 'Não (orientações pré-reunião)'}`)
    doc.moveDown()
    doc.fontSize(13).text('Pauta e orientações')
    doc.fontSize(10).moveDown(0.3)
    withNotes.forEach(i => {
      const proc = i.processoDadosView || {}
      doc.text(`${i.nuOrdem || ''}. ${proc.txDescricao || ''} — ${proc.txEmenta || ''}`, { width: 515, lineGap: 3 })
      const statusTxt = isEncerrada ? i.status_oficial : '—'
      doc.text(`Status: ${statusTxt}`, { width: 515 })
      if (vistas[i.id]?.length) doc.text(`Vista: ${vistas[i.id].join(', ')}`, { width: 515 })
      if (i.notes.length) {
        doc.fillColor('#333')
        i.notes.forEach(n => doc.text(`Oriente — ${n.author_name}: ${n.text}`, { width: 515, lineGap: 3, indent: 12 }))
        doc.fillColor('black')
      }
      doc.moveDown(0.5)
    })
  })
}

module.exports = { generatePdf, generateAssessoriaPdf }
