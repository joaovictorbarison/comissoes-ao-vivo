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
  const cabinetKey = normalize(deputadoVinculado || name)

  useEffect(() => {
    if (profile) sessionStorage.setItem('c2_profile', profile)
    else sessionStorage.removeItem('c2_profile')
  }, [profile])
  useEffect(() => {
    if (name) sessionStorage.setItem('c2_name', name)
    else sessionStorage.removeItem('c2_name')
  }, [name])
  useEffect(() => {
    if (deputadoVinculado) sessionStorage.setItem('c2_deputado', deputadoVinculado)
    else sessionStorage.removeItem('c2_deputado')
  }, [deputadoVinculado])

  const setAuth = (p, n, dep) => { setProfile(p); setName(n); setDeputadoVinculado(dep || '') }
  const clearAuth = () => { setProfile(null); setName(''); setDeputadoVinculado('') }
  return <AuthCtx.Provider value={{ profile, name, deputadoVinculado, cabinetKey, setAuth, clearAuth }}>{children}</AuthCtx.Provider>
}
