import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function normalize(name='') {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(() => sessionStorage.getItem('c2_profile'))
  const [name, setName] = useState(() => sessionStorage.getItem('c2_name') || '')
  const cabinetKey = normalize(name)

  useEffect(() => {
    if (profile) sessionStorage.setItem('c2_profile', profile)
    else sessionStorage.removeItem('c2_profile')
  }, [profile])
  useEffect(() => {
    if (name) sessionStorage.setItem('c2_name', name)
    else sessionStorage.removeItem('c2_name')
  }, [name])

  const setAuth = (p, n) => { setProfile(p); setName(n) }
  const clearAuth = () => { setProfile(null); setName('') }
  return <AuthCtx.Provider value={{ profile, name, cabinetKey, setAuth, clearAuth }}>{children}</AuthCtx.Provider>
}
