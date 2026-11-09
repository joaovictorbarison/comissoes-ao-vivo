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

function formatBR(dt) {
  if (!dt) return ''
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`
  const m2 = dt.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`
  return dt
}
function statusTexto(item, encerrada, vistas) {
  const st = item.status_oficial
  if (st==='aprovado_relator') return 'aprovado o voto do relator'
  if (st==='rejeitado_relator') return 'rejeitado o voto do relator'
  if (st==='vista') {
    const names = vistas[item.id] || []
    return names.length ? `vista - ${names.join(', ')}` : 'vista'
  }
  if (st==='retirado') return 'retirado'
  if (encerrada && (st==='pendente' || st==='em_discussao' || st==='em_votacao' || st==='nao_deliberado')) return 'Não deliberado'
  return st
}

function loadMeeting(idReuniao) {
  const db = getDb()
  const sess = db.prepare('SELECT * FROM sessions WHERE id_reuniao=?').get(String(idReuniao)) || {}
  let raw = {}
  try { raw = JSON.parse(sess.raw||'{}') } catch {}
  const encerrada = !!sess.encerrada_em
  const items = db.prepare('SELECT raw FROM agenda_items WHERE id_reuniao=? ORDER BY nu_ordem').all(String(idReuniao)).map(r=>{
    const it = JSON.parse(r.raw)
    const st = db.prepare('SELECT status FROM official_status WHERE id_reuniao=? AND item_id=?').get(String(idReuniao), String(it.id))
    let status = st?.status||'pendente'
    if (encerrada && ['pendente','em_discussao','em_votacao'].includes(status)) status = 'nao_deliberado'
    return { ...it, status_oficial: status }
  })
  const pres = db.prepare('SELECT name,profile FROM presencas WHERE id_reuniao=? AND confirmed=1 ORDER BY name').all(String(idReuniao))
  const vistasRows = db.prepare('SELECT item_id,name FROM vistas WHERE id_reuniao=? ORDER BY item_id,name').all(String(idReuniao))
  const vistas = {}
  vistasRows.forEach(r => { (vistas[r.item_id] = vistas[r.item_id] || []).push(r.name) })
  return { db, sess, raw, items, pres, vistas, encerrada }
}

function cabecalho(doc, raw, encerrada) {
  const comissao = raw.solicitante || raw.colegiadosRelacionados?.map(c=>c.nome).join('; ') || ''
  let numTipo = ''
  if (raw.tituloReuniao && /Reunião/i.test(raw.tituloReuniao)) {
    numTipo = raw.tituloReuniao // ex.: "1ª Reunião Ordinária"
  } else if (raw.nuReuniao != null) {
    const tipo = raw.tipoConvocacao || 'Ordinária'
    numTipo = `${raw.nuReuniao}ª Reunião ${tipo}`
  } else {
    numTipo = raw.tipoConvocacao || ''
  }
  doc.fontSize(16).text(comissao, { align:'center' })
  doc.fontSize(12).text(formatBR(raw.dtReuniao), { align:'center' })
  doc.text(numTipo, { align:'center' })
  doc.text(raw.local?.txNome || '', { align:'center' })
  doc.moveDown()
  return { comissao, numTipo }
}

async function generatePdf(idReuniao) {
  const { db, sess, raw, items, pres, vistas, encerrada } = loadMeeting(idReuniao)
  const buf = await renderPdf(doc => {
    cabecalho(doc, raw, encerrada)
    doc.moveDown()
    doc.fontSize(13).text('Presenças confirmadas')
    doc.fontSize(10)
    pres.forEach(p => doc.text(`• ${p.name}`))
    if (!pres.length) doc.text('• Nenhuma presença confirmada.')
    doc.moveDown()
    doc.fontSize(13).text('Itens da pauta — deliberações e vistas')
    doc.fontSize(10).moveDown(0.3)
    items.forEach(i => {
      const proc = i.processoDadosView || {}
      const vote = (i.documentosVoto||[])[0] || {}
      doc.text(`${i.nuOrdem || ''}. ${proc.txDescricao || ''} — ${proc.txEmenta || ''}`, { width: 515, lineGap: 3 })
      doc.text(`Autoria: ${proc.txNomeAutores || ''}`, { width: 515 })
      doc.text(`Relatoria: ${vote.autores || ''}`, { width: 515 })
      doc.text(`Voto: ${vote.conclusao || ''}`, { width: 515 })
      doc.text(`Status: ${statusTexto(i, encerrada, vistas)}`, { width: 515 })
      doc.moveDown(0.5)
    })
  })
  db.prepare('INSERT INTO relatorio_final (id_reuniao, snapshot) VALUES (?,?)').run(String(idReuniao), JSON.stringify({ items: items.length, pres: pres.length, encerrada }))
  return buf
}

async function generateAssessoriaPdf(idReuniao, cabinetKey) {
  const { sess, raw, items, vistas, encerrada } = loadMeeting(idReuniao)
  const db = getDb()
  const titulo = encerrada ? 'Relatório Final da Reunião — Assessoria Parlamentar' : 'Relatório de Orientações da Assessoria para a Reunião'
  const withNotes = items.map(i => {
    const notes = cabinetKey ? db.prepare('SELECT author_name,text FROM anotacoes_privadas WHERE id_reuniao=? AND item_id=? AND cabinet_key=? ORDER BY created_at').all(String(idReuniao), String(i.id), normalize(cabinetKey)) : []
    return { ...i, notes }
  })
  return renderPdf(doc => {
    cabecalho(doc, raw, encerrada)
    doc.fontSize(12).text(titulo, { align:'center' })
    doc.moveDown()
    doc.fontSize(13).text('Pauta e orientações')
    doc.fontSize(10).moveDown(0.3)
    withNotes.forEach(i => {
      const proc = i.processoDadosView || {}
      const vote = (i.documentosVoto||[])[0] || {}
      doc.text(`${i.nuOrdem || ''}. ${proc.txDescricao || ''} — ${proc.txEmenta || ''}`, { width: 515, lineGap: 3 })
      doc.text(`Autoria: ${proc.txNomeAutores || ''}`, { width: 515 })
      doc.text(`Relatoria: ${vote.autores || ''}`, { width: 515 })
      doc.text(`Voto: ${vote.conclusao || ''}`, { width: 515 })
      doc.text(`Status: ${statusTexto(i, encerrada, vistas)}`, { width: 515 })
      if (i.notes.length) {
        i.notes.forEach(n => doc.text(`Orientação — ${n.author_name}: ${n.text}`, { width: 515, lineGap: 3, indent: 12 }))
      }
      doc.moveDown(0.5)
    })
  })
}

module.exports = { generatePdf, generateAssessoriaPdf }
