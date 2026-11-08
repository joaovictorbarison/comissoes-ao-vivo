import { useEffect, useState } from 'react'

export function useProcessoLinks(items=[]) {
  const [linksMap, setLinksMap] = useState({})
  useEffect(() => {
    const ids = [...new Set(items.map(i=>i.processoDadosView?.idProcesso).filter(Boolean))]
    if (!ids.length) return
    let alive = true
    Promise.all(ids.map(async (pid) => {
      try {
        const r = await fetch(`/api/processo/${pid}/links`)
        const j = await r.json()
        return [pid, j]
      } catch { return [pid, null] }
    })).then(entries => {
      if (!alive) return
      setLinksMap(Object.fromEntries(entries))
    })
    return () => { alive = false }
  }, [items])
  return linksMap
}
