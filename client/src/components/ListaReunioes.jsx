import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLegisApi } from '../hooks/useLegisApi.js'

function formatDataBR(dt) {
  if (!dt) return ''
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`
  const m2 = dt.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`
  return dt
}

function docLabel(d) {
  const tipo = (d.tipo || '') + ' ' + (d.descricao || '')
  if (/comunicado/i.test(tipo)) return 'Comunicado'
  if (/pauta/i.test(tipo)) return 'Pauta'
  return d.tipo || 'Documento'
}

function sortDocs(docs=[]) {
  const score = (d) => {
    const t = (d.tipo || '') + ' ' + (d.descricao || '')
    if (/comunicado/i.test(t)) return 0
    if (/pauta/i.test(t)) return 1
    return 2
  }
  return [...docs].sort((a,b)=>score(a)-score(b))
}

function cardTone(estado) {
  if (!estado) return 'bg-white border'
  if (estado.encerrada) return 'bg-green-50 border-green-200'
  if (estado.iniciada) return 'bg-yellow-50 border-yellow-200'
  return 'bg-white border'
}

export default function ListaReunioes() {
  const { data } = useLegisApi('/api/legis/reunioes?size=50')
  const [sessoes, setSessoes] = useState({})
  useEffect(()=>{
    fetch('/api/sessoes').then(r=>r.json()).catch(()=>({})).then(setSessoes)
  }, [])
  const list = data?.content || []
  const convocadas = list.filter(m => m.status?.txNome === 'Convocada' || !m.status)
  return (
    <div>
      <div className="bg-gradient-to-r from-alesp to-alesp-light text-white rounded-xl p-5 mb-4">
        <div className="text-2xl font-extrabold">Reuniões de Comissão</div>
      </div>
      {convocadas.length===0 && <div className="text-slate-500">Carregando reuniões…</div>}
      <div className="grid md:grid-cols-2 gap-4">
        {convocadas.map(m => {
          const tipo = m.tipoConvocacao || m.tituloReuniao || ''
          const prefix = m.nuReuniao != null ? `${m.nuReuniao}ª ${tipo}` : tipo
          const docs = sortDocs(m.documentosReuniao || [])
          const estado = sessoes[String(m.idReuniao)]
          const tone = cardTone(estado)
          const comissaoTxt = m.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || m.solicitante || ''
          const btnLabel = estado?.encerrada
            ? 'Ir para reunião - reunião encerrada'
            : estado?.iniciada
              ? 'Ir para reunião - reunião já iniciada'
              : 'Ir para reunião'
          return (
          <article key={m.idReuniao} className={`border rounded-xl overflow-hidden ${tone}`}>
            <div className="p-4">
              <div className="text-lg font-black text-alesp leading-tight">{comissaoTxt}</div>
              <div className="text-sm font-bold text-slate-700 mt-1">{prefix}</div>
              <div className="text-sm text-slate-600 mt-1">{m.txAssunto}</div>
              <div className="text-sm mt-2"><b>{formatDataBR(m.dtReuniao)}</b> • {m.local?.txNome}</div>
              <div className="flex gap-2 mt-3">
                {docs.map(d=>(
                  <a key={d.idDocumento} href={d.linkArquivoPDF || d.linkArquivo} target="_blank" rel="noreferrer" className="flex-1 text-center text-xs font-bold border border-blue-200 rounded-lg p-2 text-blue-800">{docLabel(d)}</a>
                ))}
              </div>
              <Link to={`/reuniao/${m.idReuniao}`} className="block text-center mt-3 bg-alesp text-white rounded-lg p-3 font-bold">{btnLabel}</Link>
            </div>
          </article>
          )
        })}
      </div>
    </div>
  )
}
