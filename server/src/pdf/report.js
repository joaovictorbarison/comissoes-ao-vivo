const PDFDocument = require('pdfkit')
const { getDb } = require('../db.js')
const { fetchLegis } = require('../legisClient.js')

function normalize(name=''){ return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
function formatName(name='') {
  return String(name).toLowerCase().split(' ').map(w => ['de','da','do','das','dos','e'].includes(w) ? w : w.charAt(0).toUpperCase()+w.slice(1)).join(' ').trim()
}
async function buildPartyMaps(raw) {
  const byKey = new Map()
  try {
    const colegiados = raw?.colegiadosRelacionados || []
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
    return { byKey, portalMap }
  } catch { return { byKey, portalMap: {} } }
}
function displayName(name, maps) {
  const normalized = normalize(name)
  const mem = maps?.byKey?.get(normalized)
  const party = mem ? (mem.federacao||mem.partido||'') : (maps?.portalMap?.[normalized] || '')
  return `${formatName(name)} — ${party || 'Sem partido'}`
}
function normalizeSymbolic(data, maps) {
  if (!data) return { efetivos: [], substitutos: [], outros: [] }
  if (Array.isArray(data)) {
    // legado: lista flat de nomes ou strings já com partido
    if (data.length && data[0] && typeof data[0] === 'object') return { efetivos: [], substitutos: [], outros: data.map(x => x.nome || String(x)) }
    const enriched = data.map(n => {
      if (typeof n !== 'string') return String(n)
      return n.includes('—') ? n : displayName(n, maps)
    })
    return { efetivos: [], substitutos: [], outros: enriched }
  }
  return {
    efetivos: data.efetivos || [],
    substitutos: data.substitutos || [],
    outros: data.outros || []
  }
}

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
  if (st==='aprovado_simbolico') return 'aprovado o voto do relator'
  if (st==='rejeitado_simbolico') return 'rejeitado o voto do relator'
  if (st==='aprovado_nominal') return 'aprovado o voto do relator - votação nominal'
  if (st==='rejeitado_nominal') return 'rejeitado o voto do relator - votação nominal'
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
  const simbolicas = {}
  db.prepare('SELECT item_id,deputados FROM votacao_simbolica WHERE id_reuniao=?').all(String(idReuniao)).forEach(r=>{ simbolicas[r.item_id]=JSON.parse(r.deputados) })
  const nominais = {}
  db.prepare('SELECT item_id,deputado_name,voto,outro_texto FROM votos_nominais WHERE id_reuniao=? ORDER BY item_id,deputado_name').all(String(idReuniao)).forEach(r=>{ (nominais[r.item_id]=nominais[r.item_id]||[]).push(r) })
  const notasSec = {}
  db.prepare('SELECT item_id,texto FROM anotacoes_secretario WHERE id_reuniao=?').all(String(idReuniao)).forEach(r=>{ notasSec[r.item_id]=r.texto })
  return { db, sess, raw, items, pres, vistas, encerrada, simbolicas, nominais, notasSec }
}

function cabecalho(doc, raw) {
  const comissao = raw.solicitante || raw.colegiadosRelacionados?.map(c=>c.nome).join('; ') || ''
  let numTipo = ''
  if (raw.tituloReuniao && /Reunião/i.test(raw.tituloReuniao)) numTipo = raw.tituloReuniao
  else if (raw.nuReuniao != null) numTipo = `${raw.nuReuniao}ª Reunião ${raw.tipoConvocacao || 'Ordinária'}`
  doc.fontSize(16).text(comissao, { align:'center' })
  doc.fontSize(12).text(formatBR(raw.dtReuniao), { align:'center' })
  doc.text(numTipo, { align:'center' })
  doc.text(raw.local?.txNome || '', { align:'center' })
  doc.moveDown()
  return { comissao, numTipo }
}

async function generatePdf(idReuniao) {
  const { db, raw, items, pres, vistas, encerrada, simbolicas, nominais, notasSec } = loadMeeting(idReuniao)
  const partyMaps = await buildPartyMaps(raw)
  const buf = await renderPdf(doc => {
    cabecalho(doc, raw)
    doc.moveDown()
    doc.fontSize(13).text('Presenças confirmadas')
    doc.fontSize(10)
    pres.forEach(p => doc.text(`• ${displayName(p.name, partyMaps)}`))
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
      if (i.status_oficial==='aprovado_simbolico' || i.status_oficial==='rejeitado_simbolico') {
        const deps = normalizeSymbolic(simbolicas[i.id], partyMaps)
        const label = i.status_oficial==='aprovado_simbolico' ? 'Aprovado' : 'Rejeitado'
        doc.text(`Status: ${label} - votação simbólica:`, { width: 515, lineGap: 3 })
        doc.text(`Efetivos: ${deps.efetivos.join(', ') || '—'}`, { indent: 12, width: 515, lineGap: 3 })
        doc.text(`Substitutos: ${deps.substitutos.join(', ') || '—'}`, { indent: 12, width: 515, lineGap: 3 })
        doc.text(`Outros: ${deps.outros.join(', ') || '—'}`, { indent: 12, width: 515, lineGap: 3 })
      } else {
        doc.text(`Status: ${statusTexto(i, encerrada, vistas)}`, { width: 515, lineGap: 3 })
      }
      const nom = nominais[i.id] || []
      if (nom.length) {
        nom.forEach(v => doc.text(`• ${displayName(v.deputado_name, partyMaps)}: ${v.voto === 'outro' ? `Outro: ${v.outro_texto||''}` : v.voto}`, { indent: 12, width: 503, lineGap: 3 }))
      }
      if (notasSec[i.id]) doc.text(`Anotação do secretário: ${notasSec[i.id]}`, { width: 515, lineGap: 3 })
      doc.moveDown(0.5)
    })
  })
  db.prepare('INSERT INTO relatorio_final (id_reuniao, snapshot) VALUES (?,?)').run(String(idReuniao), JSON.stringify({ items: items.length, pres: pres.length, encerrada }))
  return buf
}

async function generateAssessoriaPdf(idReuniao, cabinetKey) {
  const { sess, raw, items, vistas, encerrada, simbolicas, nominais } = loadMeeting(idReuniao)
  const db = getDb()
  const partyMaps = await buildPartyMaps(raw)
  const titulo = encerrada ? 'Relatório Final da Reunião — Assessoria Parlamentar' : 'Relatório de Orientações da Assessoria para a Reunião'
  const withNotes = items.map(i => {
    const notes = cabinetKey ? db.prepare('SELECT author_name,text FROM anotacoes_privadas WHERE id_reuniao=? AND item_id=? AND cabinet_key=? ORDER BY created_at').all(String(idReuniao), String(i.id), normalize(cabinetKey)) : []
    return { ...i, notes }
  })
  return renderPdf(doc => {
    cabecalho(doc, raw)
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
      if (i.status_oficial==='aprovado_simbolico' || i.status_oficial==='rejeitado_simbolico') {
        const deps = normalizeSymbolic(simbolicas[i.id], partyMaps)
        const label = i.status_oficial==='aprovado_simbolico' ? 'Aprovado' : 'Rejeitado'
        doc.text(`Status: ${label} - votação simbólica:`, { width: 515 })
        doc.text(`Efetivos: ${deps.efetivos.join(', ') || '—'}`, { indent: 12, width: 515 })
        doc.text(`Substitutos: ${deps.substitutos.join(', ') || '—'}`, { indent: 12, width: 515 })
        doc.text(`Outros: ${deps.outros.join(', ') || '—'}`, { indent: 12, width: 515 })
      } else {
        const st = encerrada ? statusTexto(i, encerrada, vistas) : 'Orientações'
        doc.text(`Status: ${st}`, { width: 515 })
      }
      const nom = nominais[i.id] || []
      if (nom.length) nom.forEach(v=>doc.text(`• ${displayName(v.deputado_name, partyMaps)}: ${v.voto}`, { indent: 12, width: 503 }))
      if (i.notes.length) {
        i.notes.forEach(n => doc.text(`Orientação — ${n.author_name}: ${n.text}`, { width: 515, lineGap: 3, indent: 12 }))
      }
      doc.moveDown(0.5)
    })
  })
}

const AVISO_PUBLICO = 'Relatório provisório, sujeito à revisão da Secretaria das Comissões. Os dados oficiais estarão disponíveis oportunamente no site oficial da Assembleia Legislativa do Estado de São Paulo (al.sp.gov.br).'

function statusTextoPublico(item, vistas) {
  const st = item?.status_oficial
  if (st === 'vista') {
    const names = (vistas && vistas[item.id]) || []
    return names.length ? `Vista — ${names.join(', ')}` : 'Vista'
  }
  const map = {
    pendente: 'Pendente',
    em_discussao: 'Em discussão',
    em_votacao: 'Em votação',
    nao_deliberado: 'Não deliberado',
    aprovado_relator: 'Aprovado o voto do relator',
    rejeitado_relator: 'Rejeitado o voto do relator',
    aprovado_simbolico: 'Aprovado o voto do relator (votação simbólica)',
    rejeitado_simbolico: 'Rejeitado o voto do relator (votação simbólica)',
    aprovado_nominal: 'Aprovado o voto do relator (votação nominal)',
    rejeitado_nominal: 'Rejeitado o voto do relator (votação nominal)',
    aprovado_separado: 'Aprovado voto em separado',
    retirado: 'Retirado'
  }
  return map[st] || st || 'Pendente'
}

function parseIds(txt) {
  try {
    const ids = JSON.parse(txt || '[]')
    return Array.isArray(ids) ? ids : []
  } catch { return [] }
}

async function buildPublicReportData(idReuniao) {
  const { db, raw, items, pres, vistas, encerrada, simbolicas, nominais } = loadMeeting(idReuniao)
  const partyMaps = await buildPartyMaps(raw)
  const publicItems = items.map(i => {
    const proc = i.processoDadosView || {}
    const vote = (i.documentosVoto || [])[0] || {}
    return {
      id: i.id,
      nuOrdem: i.nuOrdem,
      descricao: proc.txDescricao || '',
      ementa: proc.txEmenta || '',
      autores: proc.txNomeAutores || '',
      relator: vote.autores || '',
      voto: vote.conclusao || '',
      status: statusTextoPublico(i, vistas),
      simbolica: normalizeSymbolic(simbolicas[i.id], partyMaps),
      vistas: vistas[i.id] || [],
      nominal: (nominais[i.id] || []).map(v => ({ deputado: v.deputado_name, voto: v.voto }))
    }
  })
  const nuOrdens = (ids) => ids
    .map(id => items.find(i => String(i.id) === String(id)))
    .filter(Boolean)
    .map(i => i.nuOrdem)
  const blocos = db.prepare('SELECT numero,item_ids,resultado FROM blocos WHERE id_reuniao=? ORDER BY numero')
    .all(String(idReuniao))
    .map(r => ({ numero: r.numero, itemNums: nuOrdens(parseIds(r.item_ids)), resultado: r.resultado }))
  const rowBloco = db.prepare('SELECT item_ids,status,ativo FROM votacao_bloco WHERE id_reuniao=?').get(String(idReuniao))
  const blocoAtivo = rowBloco && rowBloco.ativo
    ? { itemNums: nuOrdens(parseIds(rowBloco.item_ids)), status: statusTextoPublico({ status_oficial: rowBloco.status }, {}) }
    : null
  const numeros = (pred) => publicItems.filter(pred).map(i => i.nuOrdem).filter(n => n != null)
  const resumo = {
    aprovados: numeros(i => i.status.startsWith('Aprovado')),
    rejeitados: numeros(i => i.status.startsWith('Rejeitado')),
    vistas: numeros(i => i.status.startsWith('Vista')),
    retirados: numeros(i => i.status === 'Retirado'),
    naoDeliberados: numeros(i => i.status === 'Não deliberado')
  }
  return {
    raw,
    encerrada,
    presencas: pres.map(p => ({ name: p.name, label: displayName(p.name, partyMaps) })),
    items: publicItems,
    blocoAtivo,
    blocos,
    resumo
  }
}

async function generatePublicoPdf(idReuniao) {
  const d = await buildPublicReportData(idReuniao)
  const lista = (arr) => arr.length ? arr.join(', ') : 'Nenhum'
  return renderPdf(doc => {
    cabecalho(doc, d.raw)
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#b91c1c').text(AVISO_PUBLICO, { width: 515, lineGap: 3 })
    doc.fillColor('black').moveDown()
    doc.fontSize(13).text('Presenças confirmadas')
    doc.fontSize(10)
    if (d.presencas.length) d.presencas.forEach(p => doc.text(`• ${p.label}`))
    else doc.text('• Nenhuma presença confirmada.')
    doc.moveDown()
    doc.fontSize(13).text('Itens da pauta — deliberações e vistas')
    doc.fontSize(10).moveDown(0.3)
    if (!d.items.length) doc.text('Nenhum item de pauta registrado.')
    d.items.forEach(i => {
      doc.text(`${i.nuOrdem || ''}. ${i.descricao} — ${i.ementa}`, { width: 515, lineGap: 3 })
      doc.text(`Autoria: ${i.autores}`, { width: 515 })
      doc.text(`Relatoria: ${i.relator}`, { width: 515 })
      doc.text(`Voto: ${i.voto}`, { width: 515 })
      doc.text(`Status: ${i.status}`, { width: 515, lineGap: 3 })
      if (i.vistas.length) doc.text(`Pedido de vista: ${i.vistas.join(', ')}`, { width: 515 })
      const s = i.simbolica
      if (s.efetivos.length || s.substitutos.length || s.outros.length) {
        doc.text('Votação simbólica:', { width: 515 })
        doc.text(`Efetivos: ${s.efetivos.join(', ') || '—'}`, { indent: 12, width: 503 })
        doc.text(`Substitutos: ${s.substitutos.join(', ') || '—'}`, { indent: 12, width: 503 })
        doc.text(`Outros: ${s.outros.join(', ') || '—'}`, { indent: 12, width: 503 })
      }
      i.nominal.forEach(v => doc.text(`• ${v.deputado}: ${v.voto}`, { indent: 12, width: 503 }))
      doc.moveDown(0.5)
    })
    doc.moveDown(0.5).fontSize(13).text('Votações em bloco')
    doc.fontSize(10)
    if (d.blocoAtivo) doc.text(`Em andamento — Itens: ${d.blocoAtivo.itemNums.join(', ')} — ${d.blocoAtivo.status}`, { width: 515 })
    d.blocos.forEach(b => doc.text(`Bloco ${b.numero} — Itens: ${b.itemNums.join(', ')} — Resultado: ${b.resultado}`, { width: 515 }))
    if (!d.blocoAtivo && !d.blocos.length) doc.text('Nenhuma votação em bloco registrada.')
    doc.moveDown().fontSize(13).text('Resumo')
    doc.fontSize(10)
    doc.text(`Aprovados: ${lista(d.resumo.aprovados)}`)
    doc.text(`Rejeitados: ${lista(d.resumo.rejeitados)}`)
    doc.text(`Pedidos de vista: ${lista(d.resumo.vistas)}`)
    doc.text(`Retirados: ${lista(d.resumo.retirados)}`)
    doc.text(`Não deliberados: ${lista(d.resumo.naoDeliberados)}`)
  })
}

module.exports = { generatePdf, generateAssessoriaPdf, buildPublicReportData, generatePublicoPdf, statusTextoPublico }
