import { test, expect } from 'vitest'
import { semPapelUrl, votoUrl, proposituraUrl } from '../lib/legisLinks.js'

test('sem papel url contains idProcesso when provided', () => {
  const u = semPapelUrl({urlSemPapel:'http://sempapel.al.sp.gov.br/Sistema/Protocolo/Processo2/Digital.aspx?id=64104'})
  expect(u).toContain('64104')
})
test('propositura url prefers urlSemPapel then linksArquivosIniciais', () => {
  expect(proposituraUrl({urlSemPapel:'http://sempapel/x?id=1', linksArquivosIniciais:['/spl/a.pdf']})).toBe('http://sempapel/x?id=1')
  expect(proposituraUrl({urlSemPapel:null, linksArquivosIniciais:['/spl/2019/03/Propositura/1000260823_Propositura.doc']})).toBe('https://www.al.sp.gov.br/spl/2019/03/Propositura/1000260823_Propositura.doc')
  expect(proposituraUrl({})).toBeNull()
})
test('voto url returns linkArquivo or null', () => {
  expect(votoUrl({linkArquivo:'https://x/doc'})).toBe('https://x/doc')
  expect(votoUrl({})).toBeNull()
})
