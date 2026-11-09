const { getDb } = require('../db.js')
async function generatePdf(idReuniao) {
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
  const header = [raw.nuReuniao ? `Nº ${raw.nuReuniao}`:'', raw.tipoConvocacao||raw.tituloReuniao||'', raw.dtReuniao||'', raw.local?.txNome||'', raw.solicitante||''].filter(Boolean).join(' — ')
  const rows = items.map(i=>`<tr><td>${i.nuOrdem||''}</td><td>${i.processoDadosView?.txDescricao||''}</td><td>${i.processoDadosView?.txEmenta||''}</td><td>${i.status_oficial}</td></tr>`).join('')
  const presList = pres.map(p=>`<li>${p.name} (${p.profile})</li>`).join('') || '<li>Nenhuma presença confirmada.</li>'
  const html = `<html><head><meta charset="utf-8"><title>Relatório</title></head><body>
    <h1>Comissões Ao Vivo 2 — Relatório Final</h1>
    <p><b>Reunião:</b> ${header}</p>
    <h2>Presenças confirmadas</h2><ul>${presList}</ul>
    <h2>Itens da pauta — deliberações e vistas</h2>
    <table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>Ordem</th><th>Processo</th><th>Ementa</th><th>Status final</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`
  // Try puppeteer, fallback to minimal PDF text
  try {
    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({ args:['--no-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil:'networkidle0' })
    const buf = await page.pdf({ format:'A4' })
    await browser.close()
    // persist snapshot
    db.prepare('INSERT INTO relatorio_final (id_reuniao, snapshot) VALUES (?,?)').run(String(idReuniao), JSON.stringify({ header, items: items.length, pres: pres.length }))
    db.prepare('UPDATE sessions SET encerrada_em=datetime("now") WHERE id_reuniao=?').run(String(idReuniao))
    return buf
  } catch (e) {
    // fallback minimal PDF
    const safeHeader = header.replace(/[()\\]/g, '')
    const safeItems = items.map(i => `${i.nuOrdem || ''} ${i.processoDadosView?.txDescricao || ''} — ${i.status_oficial}`).join(' | ')
    const safePres = pres.map(p => p.name).join(' | ')
    const safeText = `Relatorio Final ${safeHeader} | Presencas ${safePres} | Itens ${safeItems}`
    const pdfText = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${safeText.length + 80}>>stream
BT /F1 12 Tf 50 800 Td (${safeText}) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`
    return Buffer.from(pdfText)
  }
}
function normalize(name=''){ return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim() }
async function generateAssessoriaPdf(idReuniao, cabinetKey) {
  const db = getDb()
  const sess = db.prepare('SELECT * FROM sessions WHERE id_reuniao=?').get(String(idReuniao)) || {}
  let raw = {}
  try { raw = JSON.parse(sess.raw||'{}') } catch {}
  const isEncerrada = !!sess.encerrada_em
  const items = db.prepare('SELECT raw FROM agenda_items WHERE id_reuniao=? ORDER BY nu_ordem').all(String(idReuniao)).map(r=>{
    const it = JSON.parse(r.raw)
    const st = db.prepare('SELECT status FROM official_status WHERE id_reuniao=? AND item_id=?').get(String(idReuniao), String(it.id))
    const notes = cabinetKey ? db.prepare('SELECT author_name,text FROM anotacoes_privadas WHERE id_reuniao=? AND item_id=? AND cabinet_key=? ORDER BY created_at').all(String(idReuniao), String(it.id), normalize(cabinetKey)) : []
    return { ...it, status_oficial: st?.status||'pendente', notes }
  })
  const header = [raw.nuReuniao ? `Nº ${raw.nuReuniao}`:'', raw.tipoConvocacao||raw.tituloReuniao||'', raw.dtReuniao||'', raw.local?.txNome||'', raw.solicitante||''].filter(Boolean).join(' — ')
  const titulo = isEncerrada ? 'Relatório Final da Reunião — Assessoria Parlamentar' : 'Relatório de Orientações da Assessoria para a Reunião'
  const rows = items.map(i=>{
    const n = i.notes.map(x=>`${x.author_name}: ${x.text}`).join(' | ') || ''
    const statusTxt = isEncerrada ? i.status_oficial : (n ? 'Orientações' : 'Pendente')
    return `<tr><td>${i.nuOrdem||''}</td><td>${i.processoDadosView?.txDescricao||''}</td><td>${i.processoDadosView?.txEmenta||''}</td><td>${statusTxt}</td><td>${n}</td></tr>`
  }).join('')
  const html = `<html><head><meta charset="utf-8"><title>Relatório Assessoria</title></head><body><h1>Comissões Ao Vivo 2 — ${titulo}</h1><p><b>Reunião:</b> ${header}</p><p><b>Encerrada:</b> ${isEncerrada ? 'Sim' : 'Não (orientações pré-reunião)'}</p><table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>Ordem</th><th>Processo</th><th>Ementa</th><th>Status</th><th>Orientações</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  try {
    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({ args:['--no-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil:'networkidle0' })
    const buf = await page.pdf({ format:'A4' })
    await browser.close()
    return buf
  } catch {
    const safe = `${titulo} ${header} | ${items.map(i=>`${i.nuOrdem} ${i.processoDadosView?.txDescricao||''} ${i.status_oficial} ${i.notes.map(n=>n.text).join(',')}`).join(' | ')}`
    return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${safe.length+80}>>stream\nBT /F1 12 Tf 50 800 Td (${safe.replace(/[()\\]/g,'')}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`)
  }
}
module.exports = { generatePdf, generateAssessoriaPdf }
