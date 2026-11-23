import { test, expect, beforeAll, afterAll } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Um único arquivo para todo o teste: getDb() cacheia a conexão na primeira chamada.
const dbPath = `/tmp/test-public-report-${Date.now()}-${Math.random()}.db`
process.env.DB_PATH = dbPath
// Evita chamadas reais à API Legis durante o teste (conexão recusada é rápida).
process.env.LEGIS_API_BASE_URL = 'http://127.0.0.1:9'

let db
function seed() {
  const { initDb } = require('../db.js')
  db = initDb(dbPath)
  db.prepare('INSERT OR REPLACE INTO sessions (id_reuniao, raw, iniciada) VALUES (?,?,?)')
    .run('1', JSON.stringify({ nuReuniao: 1, tipoConvocacao: 'Ordinária', dtReuniao: '2026-11-10T15:30', local: { txNome: 'Plenário' }, solicitante: 'CDD' }), 1)
  const items = [
    { id:'a', nuOrdem:1, processoDadosView:{txDescricao:'PL 1/2026', txEmenta:'Aprovado', txNomeAutores:'Autor A'}, documentosVoto:[{autores:'Relator A', conclusao:'favorável'}] },
    { id:'b', nuOrdem:2, processoDadosView:{txDescricao:'PL 2/2026', txEmenta:'Rejeitado', txNomeAutores:'Autor B'}, documentosVoto:[{autores:'Relator B', conclusao:'contrário'}] },
    { id:'c', nuOrdem:3, processoDadosView:{txDescricao:'PL 3/2026', txEmenta:'Em votação', txNomeAutores:'Autor C'}, documentosVoto:[] },
    { id:'d', nuOrdem:4, processoDadosView:{txDescricao:'PL 4/2026', txEmenta:'Não deliberado', txNomeAutores:'Autor D'}, documentosVoto:[] }
  ]
  items.forEach(it => db.prepare('INSERT INTO agenda_items (id,id_reuniao,nu_ordem,raw) VALUES (?,?,?,?)').run(it.id,'1',it.nuOrdem,JSON.stringify(it)))
  Object.entries({ a:'aprovado_relator', b:'rejeitado_relator', c:'em_votacao', d:'nao_deliberado' })
    .forEach(([id,status]) => db.prepare('INSERT INTO official_status (id_reuniao,item_id,status) VALUES (?,?,?)').run('1',id,status))
  db.prepare("INSERT INTO presencas (id_reuniao,name,profile,confirmed) VALUES ('1','Gil Diniz','deputado',1)").run()
  db.prepare("INSERT INTO presencas (id_reuniao,name,profile,confirmed) VALUES ('1','Não Confirmado','deputado',0)").run()
  db.prepare("INSERT INTO vistas (id_reuniao,item_id,name) VALUES ('1','a','Gil Diniz')").run()
  db.prepare("INSERT INTO anotacoes_privadas (id_reuniao,item_id,text,author_name,cabinet_key) VALUES ('1','a','SEGREDO','Assessor','x')").run()
  db.prepare("INSERT INTO votacao_simbolica (id_reuniao,item_id,deputados) VALUES ('1','a',?)").run(JSON.stringify({ efetivos:['Gil — X'], substitutos:[], outros:[] }))
  db.prepare("INSERT INTO votos_nominais (id_reuniao,item_id,deputado_name,voto) VALUES ('1','b','Gil Diniz','contrario')").run()
  db.prepare("INSERT INTO blocos (id_reuniao,numero,item_ids,resultado) VALUES ('1',1,?,'Aprovados')").run(JSON.stringify(['a','b']))
  db.prepare("INSERT INTO votacao_bloco (id_reuniao,item_ids,status,ativo) VALUES ('1',?,'em_votacao',1)").run(JSON.stringify(['a']))
}

beforeAll(() => { seed() })
afterAll(() => { if (db) db.close() })

test('public report data uses live statuses and only public information', async () => {
  const { buildPublicReportData } = require('../pdf/report.js')
  const d = await buildPublicReportData('1')
  expect(d.presencas).toHaveLength(1)
  expect(d.presencas[0].name).toBe('Gil Diniz')
  expect(d.items.find(i=>i.id==='c').status).toBe('Em votação')
  expect(d.items.find(i=>i.id==='a').status).toBe('Aprovado o voto do relator')
  expect(d.items.find(i=>i.id==='a').vistas).toEqual(['Gil Diniz'])
  expect(d.resumo.rejeitados).toContain(2)
  expect(d.resumo.naoDeliberados).toContain(4)
  expect(d.items.find(i=>i.id==='a').simbolica.efetivos).toContain('Gil — X')
  expect(d.items.find(i=>i.id==='b').nominal[0]).toEqual({ deputado:'Gil Diniz', voto:'contrario' })
  expect(d.blocos[0].resultado).toBe('Aprovados')
  expect(d.blocoAtivo.status).toBe('Em votação')
  expect(JSON.stringify(d)).not.toContain('SEGREDO')
})

test('generatePublicoPdf returns a valid PDF for a full meeting and for an empty one', async () => {
  const { generatePublicoPdf } = require('../pdf/report.js')
  const full = await generatePublicoPdf('1')
  expect(full.slice(0,4).toString()).toBe('%PDF')
  db.prepare("INSERT OR REPLACE INTO sessions (id_reuniao, raw) VALUES ('2','{}')").run()
  const empty = await generatePublicoPdf('2')
  expect(empty.slice(0,4).toString()).toBe('%PDF')
})

test('GET relatorio-publico.pdf is public and returns a PDF', async () => {
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const res = await request(createApp()).get('/api/reuniao/1/relatorio-publico.pdf')
  expect(res.status).toBe(200)
  expect(res.headers['content-type']).toContain('application/pdf')
  expect(res.body.slice(0,4).toString()).toBe('%PDF')
})
