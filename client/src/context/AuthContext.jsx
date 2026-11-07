import React, { createContext, useContext, useState } from 'react'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function normalize(name='') {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()
}

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const cabinetKey = normalize(name)
  const setAuth = (p, n) => { setProfile(p); setName(n) }
  const clearAuth = () => { setProfile(null); setName('') }
  return <AuthCtx.Provider value={{ profile, name, cabinetKey, setAuth, clearAuth }}>{children}</AuthCtx.Provider>
}
