import React from 'react'
import { useLegisApi } from '../hooks/useLegisApi.js'

export default function ListaReunioes() {
  const { data } = useLegisApi('/api/legis/reunioes?size=50')
  const list = data?.content || []
  const convocadas = list.filter(m => m.status?.txNome === 'Convocada' || !m.status)
  return (
    <div>
      <div className="bg-gradient-to-r from-alesp to-alesp-light text-white rounded-xl p-5 mb-4">
        <div className="text-xs uppercase tracking-wide opacity-80">ALESP • Seminários • Convocadas</div>
        <div className="text-2xl font-extrabold mt-1">Reuniões de Comissão</div>
      </div>
      {convocadas.length===0 && <div className="text-slate-500">Carregando reuniões…</div>}
      <div className="grid md:grid-cols-2 gap-4">
        {convocadas.map(m => (
          <article key={m.idReuniao} className="bg-white border rounded-xl overflow-hidden">
            <div className="bg-blue-50 px-4 py-2 flex justify-between text-xs font-bold">
              <span>CONVOCADA • {m.tipoConvocacao || m.tituloReuniao}</span><span>Nº {m.nuReuniao}</span>
            </div>
            <div className="p-4">
              <div className="font-extrabold">{m.tituloReuniao}</div>
              <div className="text-sm text-slate-600">{m.txAssunto}</div>
              <div className="text-sm mt-2"><b>{m.dtReuniao?.replace('T',' às ')}</b> • {m.local?.txNome}</div>
              <div className="text-xs bg-slate-50 rounded p-2 mt-2">{m.colegiadosRelacionados?.map(c=>`${c.sigla} — ${c.nome}`).join('; ') || m.solicitante}</div>
              <div className="flex gap-2 mt-3">
                {m.documentosReuniao?.map(d=>(
                  <a key={d.idDocumento} href={d.linkArquivoPDF} target="_blank" rel="noreferrer" className="flex-1 text-center text-xs font-bold border border-blue-200 rounded-lg p-2 text-blue-800">{d.descricao || d.tipo}</a>
                ))}
              </div>
              <a href={`/reuniao/${m.idReuniao}`} className="block text-center mt-3 bg-alesp text-white rounded-lg p-3 font-bold">Abrir pauta →</a>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
