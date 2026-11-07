import React from 'react'
import { useLegisApi } from '../hooks/useLegisApi.js'

function formatDataBR(dt) {
  if (!dt) return ''
  // dt esperado "2026-11-10T15:30" ou "2026-11-10 15:30"
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

export default function ListaReunioes() {
  const { data } = useLegisApi('/api/legis/reunioes?size=50')
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
          return (
          <article key={m.idReuniao} className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-blue-50 px-4 py-2 text-xs font-bold">
              <span>{prefix}</span>
            </div>
            <div className="p-4">
              <div className="font-extrabold">{m.tituloReuniao}</div>
              <div className="text-sm text-slate-600">{m.txAssunto}</div>
              <div className="text-sm mt-2"><b>{formatDataBR(m.dtReuniao)}</b> • {m.local?.txNome}</div>
              <div className="text-xs bg-slate-50 rounded p-2 mt-2">{m.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || m.solicitante}</div>
              <div className="flex gap-2 mt-3">
                {docs.map(d=>(
                  <a key={d.idDocumento} href={d.linkArquivoPDF || d.linkArquivo} target="_blank" rel="noreferrer" className="flex-1 text-center text-xs font-bold border border-blue-200 rounded-lg p-2 text-blue-800">{docLabel(d)}</a>
                ))}
              </div>
              <a href={`/reuniao/${m.idReuniao}`} className="block text-center mt-3 bg-alesp text-white rounded-lg p-3 font-bold">Ir para reunião</a>
            </div>
          </article>
          )
        })}
      </div>
    </div>
  )
}
