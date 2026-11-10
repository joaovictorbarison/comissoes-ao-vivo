import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function normalize(name='') {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(() => sessionStorage.getItem('c2_profile'))
  const [name, setName] = useState(() => sessionStorage.getItem('c2_name') || '')
  const [deputadoVinculado, setDeputadoVinculado] = useState(() => sessionStorage.getItem('c2_deputado') || '')
  const [token, setToken] = useState(() => sessionStorage.getItem('c2_token') || '')
  const cabinetKey = normalize(deputadoVinculado || name)

  useEffect(() => { if (profile) sessionStorage.setItem('c2_profile', profile); else sessionStorage.removeItem('c2_profile') }, [profile])
  useEffect(() => { if (name) sessionStorage.setItem('c2_name', name); else sessionStorage.removeItem('c2_name') }, [name])
  useEffect(() => { if (deputadoVinculado) sessionStorage.setItem('c2_deputado', deputadoVinculado); else sessionStorage.removeItem('c2_deputado') }, [deputadoVinculado])
  useEffect(() => { if (token) sessionStorage.setItem('c2_token', token); else sessionStorage.removeItem('c2_token') }, [token])

  const setAuth = (p, n, dep, tok) => { setProfile(p); setName(n); setDeputadoVinculado(dep || ''); setToken(tok || '') }
  const clearAuth = () => { setProfile(null); setName(''); setDeputadoVinculado(''); setToken('') }

  const authHeaders = () => token ? { Authorization: `Bearer ${token}` } : {}
  const authFetch = (url, opts={}) => fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...authHeaders() } })

  return <AuthCtx.Provider value={{ profile, name, deputadoVinculado, cabinetKey, token, setAuth, clearAuth, authHeaders, authFetch }}>{children}</AuthCtx.Provider>
}
