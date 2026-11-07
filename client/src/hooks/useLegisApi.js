import { useEffect, useState } from 'react'

export function useLegisApi(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let alive = true
    fetch(path).then(r=>r.json()).then(j=>{ if(alive) setData(j) }).catch(e=>{ if(alive) setError(e) })
    return () => { alive = false }
  }, [path])
  return { data, error }
}
