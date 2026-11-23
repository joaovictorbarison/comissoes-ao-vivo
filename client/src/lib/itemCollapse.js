import { useState } from 'react'

export const TERMINAL_FINAL = ['aprovado_relator','aprovado_simbolico','aprovado_nominal','rejeitado_relator','rejeitado_simbolico','rejeitado_nominal','vista','retirado']

export const STATUS_SHORT = {
  aprovado_relator:'Aprovado', aprovado_simbolico:'Aprovado', aprovado_nominal:'Aprovado',
  rejeitado_relator:'Rejeitado', rejeitado_simbolico:'Rejeitado', rejeitado_nominal:'Rejeitado',
  vista:'Vista', retirado:'Retirado'
}

export function isTerminalStatus(s){ return TERMINAL_FINAL.includes(s) }

export function useOpenItems(){
  const [openItems, setOpenItems] = useState(new Set())
  const toggleItem = (key) => setOpenItems(s => {
    const n = new Set(s)
    const k = String(key)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })
  return [openItems, toggleItem]
}
