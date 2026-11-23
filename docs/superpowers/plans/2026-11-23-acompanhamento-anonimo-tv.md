# Acompanhamento anônimo + TV full-screen com QR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cidadão acompanha a reunião sem login (página pública + relatório público), e a TV do plenário vira uma tela full-screen grande com QR para o celular.

**Architecture:** Perfil local `anonimo` (sem token) → `Acompanhamento.jsx` (clone somente-leitura do `PautaAssessor`). `/tv/:id` sai do layout do app e usa um shell full-screen com card + faixa de QR. Novo gerador/rota pública de PDF no servidor, sem notas privadas.

**Tech Stack:** React 18, React Router 6, Tailwind, Vite, Vitest/Testing Library, Express, SQLite (`node:sqlite`), pdfkit, `qrcode`.

**Spec:** `docs/superpowers/specs/2026-11-23-acompanhamento-anonimo-tv-design.md`

## Global Constraints

- Anônimo não recebe token de backend; perfil `anonimo` só em `sessionStorage`.
- Nenhuma tabela nova e nenhuma mudança de schema.
- Página anônima e relatório público **não** expõem `anotacoes_privadas` nem `anotacoes_secretario`.
- `/tv/:id` nunca renderiza `Header`, `VinculoBar` ou `main max-w-5xl`.
- URL do QR: `${window.location.origin}/reuniao/${id}`.
- Aviso do PDF, texto exato: "Relatório provisório, sujeito à revisão da Secretaria das Comissões. Os dados oficiais estarão disponíveis oportunamente no site oficial da Assembleia Legislativa do Estado de São Paulo (al.sp.gov.br)."
- Telas atuais de deputado/assessor/secretário permanecem inalteradas.
- Sem biblioteca de UI nova; usar Tailwind existente.

## Review Focus

- Ementa/comissão muito longas na TV não podem empurrar o QR para fora da tela → teste na Task 4 com texto longo ainda encontra o QR.
- QR gerado com `origin` precisa ser alcançável do celular; em dev, abrir a TV pelo IP da rede → `server.host: true` na Task 4.
- Anônimo/sem perfil nunca deve ver nota privada nem chamar rota autenticada → testes nas Tasks 2 e 3.
- Reunião sem presenças, votos ou blocos ainda gera PDF válido → teste de relatório vazio na Task 1.
- Todo perfil (secretário, deputado, assessor, anônimo, nulo) abre a tela correta em `/reuniao/:id` → teste de roteamento na Task 3.

---

### Task 1: Relatório público no servidor

**Files:**
- Modify: `server/src/pdf/report.js` (novas funções após `generateAssessoriaPdf`)
- Modify: `server/src/routes/meeting.js` (rota após `relatorio-assessoria.pdf`, ~linha 230)
- Create: `server/src/__tests__/publicReport.test.js`

**Interfaces:**
- Produces:
  - `statusTextoPublico(item, vistas) -> string`
  - `buildPublicReportData(idReuniao: string) -> Promise<{ raw, encerrada, presencas: Array<{name,label}>, items: Array<{id,nuOrdem,descricao,ementa,autores,relator,voto,status,simbolica,vistas:string[],nominal:Array<{deputado,voto}>}>, blocoAtivo: {itemNums,status}|null, blocos: Array<{numero,itemNums,resultado}>, resumo: {aprovados:number[],rejeitados:number[],vistas:number[],retirados:number[],naoDeliberados:number[]} }>`
  - `generatePublicoPdf(idReuniao: string) -> Promise<Buffer>`
  - `GET /api/reuniao/:id/relatorio-publico.pdf` pública, `Content-Type: application/pdf`

- [ ] **Step 1: Write the failing test**

Create `server/src/__tests__/publicReport.test.js`:

```js
import { test, expect } from 'vitest'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Um único arquivo para todo o teste: getDb() cacheia a conexão na primeira chamada.
const dbPath = `/tmp/test-public-report-${Date.now()}-${Math.random()}.db`
process.env.DB_PATH = dbPath
// Evita chamadas reais à API Legis durante o teste (conexão recusada é rápida).
process.env.LEGIS_API_BASE_URL = 'http://127.0.0.1:9'

function seed() {
  const { initDb } = require('../db.js')
  const db = initDb(dbPath)
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
  return db
}

test('public report data uses live statuses and only public information', async () => {
  const db = seed()
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
  db.close()
})

test('generatePublicoPdf returns a valid PDF for a full meeting and for an empty one', async () => {
  const db = seed()
  const { generatePublicoPdf } = require('../pdf/report.js')
  const full = await generatePublicoPdf('1')
  expect(full.slice(0,4).toString()).toBe('%PDF')
  db.prepare("INSERT OR REPLACE INTO sessions (id_reuniao, raw) VALUES ('2','{}')").run()
  const empty = await generatePublicoPdf('2')
  expect(empty.slice(0,4).toString()).toBe('%PDF')
  db.close()
})

test('GET relatorio-publico.pdf is public and returns a PDF', async () => {
  const db = seed()
  const { createApp } = require('../index.js')
  const request = (await import('supertest')).default
  const res = await request(createApp()).get('/api/reuniao/1/relatorio-publico.pdf')
  expect(res.status).toBe(200)
  expect(res.headers['content-type']).toContain('application/pdf')
  expect(res.body.slice(0,4).toString()).toBe('%PDF')
  db.close()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/publicReport.test.js` (em `server/`)
Expected: FAIL — `buildPublicReportData is not a function` / rota 404.

- [ ] **Step 3: Implement `statusTextoPublico` and `buildPublicReportData`**

Em `server/src/pdf/report.js`, `statusTextoPublico(item, vistas)` mapeia o status ao vivo com este texto exato:

| status | texto |
|---|---|
| `pendente` | `Pendente` |
| `em_discussao` | `Em discussão` |
| `em_votacao` | `Em votação` |
| `nao_deliberado` | `Não deliberado` |
| `aprovado_relator` | `Aprovado o voto do relator` |
| `rejeitado_relator` | `Rejeitado o voto do relator` |
| `aprovado_simbolico` | `Aprovado o voto do relator (votação simbólica)` |
| `rejeitado_simbolico` | `Rejeitado o voto do relator (votação simbólica)` |
| `aprovado_nominal` | `Aprovado o voto do relator (votação nominal)` |
| `rejeitado_nominal` | `Rejeitado o voto do relator (votação nominal)` |
| `aprovado_separado` | `Aprovado voto em separado` |
| `retirado` | `Retirado` |
| `vista` | `Vista — <nomes>` (ou `Vista` sem nomes) |

`buildPublicReportData` reutiliza `loadMeeting` e `buildPartyMaps` (que já devolve `pres` só com `confirmed=1` e `vistas`), consulta `blocos` e `votacao_bloco`, e monta:
- `presencas`: `{ name, label }` onde `label = displayName(name, partyMaps)`.
- `items`: `{ id, nuOrdem, descricao, ementa, autores, relator, voto, status: statusTextoPublico(...), simbolica: normalizeSymbolic(simbolicas[id], partyMaps), vistas: vistas[id] || [], nominal: (nominais[id]||[]).map(v=>({ deputado:v.deputado_name, voto:v.voto })) }`.
- `blocoAtivo`: de `votacao_bloco` com `ativo=1`; `{ itemNums, status: statusTextoPublico({status_oficial: status}, {}) }`.
- `blocos`: `{ numero, itemNums, resultado }` lidos de `blocos`, em ordem de `numero`.
- `resumo`: ids `nuOrdem` por categoria (`aprovados`, `rejeitados`, `vistas`, `retirados`, `naoDeliberados`), a partir do status de `items`.
- `raw` e `encerrada` (de `sess`).

Não incluir `notasSec` nem consultar `anotacoes_privadas`/`anotacoes_secretario` no objeto retornado.

- [ ] **Step 4: Implement `generatePublicoPdf` e a rota**

`generatePublicoPdf` usa `renderPdf` e imprime: cabeçalho (`cabecalho`), aviso exato das Global Constraints em destaque, presenças, itens (com status/simbólica/nominal/vistas), bloco ativo, blocos registrados e resumo (aprovados, rejeitados, vistas, retirados, não deliberados). Em `meeting.js`, adicionar `router.get('/reuniao/:id/relatorio-publico.pdf', ...)` sem `requireAuth`, com `Content-Disposition: attachment; filename="relatorio-publico-${id}.pdf"`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/publicReport.test.js` → PASS
Run: `npx vitest run` (em `server/`) → toda a suíte do servidor PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/pdf/report.js server/src/routes/meeting.js server/src/__tests__/publicReport.test.js
git commit -m "feat(server): add public meeting report PDF"
```

---

### Task 2: Página Acompanhamento (somente leitura)

**Files:**
- Create: `client/src/components/Acompanhamento.jsx`
- Create: `client/src/__tests__/acompanhamento.test.jsx`

**Interfaces:**
- Consumes: `useSocket(id)`, `useProcessoLinks(items)`, `proposituraUrl`, `votoUrl`.
- Produces: `export default function Acompanhamento()`; link `href="/api/reuniao/${id}/relatorio-publico.pdf"`; textos de status iguais a `PautaAssessor`.

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/acompanhamento.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Acompanhamento from '../components/Acompanhamento.jsx'

vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

test('anonymous accompaniment shows meeting info, items and public report, without private notes', async () => {
  vi.stubGlobal('fetch', async (url) => {
    if (String(url).includes('/vistas')) return { json: async () => ({}) }
    return { json: async () => ({
      tituloReuniao: '1ª Reunião Ordinária',
      dtReuniao: '2026-11-10T15:30',
      local: { txNome: 'Plenário José Bonifácio' },
      colegiadosRelacionados: [{ sigla: 'CDD', nome: 'Comissão de Defesa dos Direitos da Pessoa Humana' }],
      items: [{ id:'1', nuOrdem:1, status_oficial:'em_votacao', processoDadosView:{ txDescricao:'PL 197/2019', txEmenta:'Institui o Programa Agente Cidadão Sênior.', txNomeAutores:'Thiago Auricchio' }, documentosVoto:[{ autores:'Gil Diniz Bolsonaro', conclusao:'favorável' }] }]
    }) }
  })
  render(<MemoryRouter initialEntries={['/reuniao/1000007671']}><Routes><Route path="/reuniao/:id" element={<Acompanhamento />} /></Routes></MemoryRouter>)
  expect(await screen.findByText(/PL 197\/2019/)).toBeTruthy()
  expect(screen.getByText(/CDD/)).toBeTruthy()
  expect(screen.getByText(/1ª Reunião Ordinária/)).toBeTruthy()
  expect(screen.getByText(/Plenário José Bonifácio/)).toBeTruthy()
  expect(screen.getByText(/EM VOTAÇÃO/)).toBeTruthy()
  const report = screen.getByRole('link', { name: /Baixar relatório/i })
  expect(report.getAttribute('href')).toBe('/api/reuniao/1000007671/relatorio-publico.pdf')
  expect(screen.queryByText(/Orientação da assessoria/i)).toBeFalsy()
  expect(screen.queryByPlaceholderText(/orientação/i)).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Aceitar/i })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Recusar/i })).toBeFalsy()
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/acompanhamento.test.jsx` (em `client/`)
Expected: FAIL — módulo `Acompanhamento.jsx` não encontrado.

- [ ] **Step 3: Implement `Acompanhamento.jsx`**

Derivar de `PautaAssessor.jsx`: mesmos `STATUS_LABEL`, `STATUS_COLOR`, `cardTone`, cards por item e links Sem Papel. Cabeçalho com comissão + `tituloReuniao`/`dtReuniao`/`local`. `load()` com `fetch` público de `/api/reuniao/${id}` e `/vistas`; socket em `official_status_changed`, `active_item_changed`, `bloco_changed`. Botão "Baixar relatório" para `/api/reuniao/${id}/relatorio-publico.pdf`. Omitir notas, vínculo, presença, `AssessoresTab` e sidebar.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/acompanhamento.test.jsx` → PASS
Run: `npx vitest run` (em `client/`) → PASS (os testes existentes não podem quebrar).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Acompanhamento.jsx client/src/__tests__/acompanhamento.test.jsx
git commit -m "feat(client): add public meeting accompaniment page"
```

---

### Task 3: Identificação anônima e roteamento

**Files:**
- Modify: `client/src/App.jsx` (exportar `PautaRouter`; importar `Acompanhamento`; regras de perfil; título do header)
- Modify: `client/src/components/Identificacao.jsx` (botão anônimo)
- Create: `client/src/__tests__/pautaRouter.test.jsx`
- Modify: `client/src/__tests__/identificacao.test.jsx`

**Interfaces:**
- Produces: `export function PautaRouter()`; botão com nome acessível `"Acompanhar sem identificação"`.
- Consumes: `Acompanhamento` (Task 2), `setAuth`/`profile` do `AuthContext`.

- [ ] **Step 1: Write the failing router test**

Create `client/src/__tests__/pautaRouter.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { PautaRouter } from '../App.jsx'

vi.mock('../components/PautaSecretario.jsx', () => ({ default: () => <div>PainelSecretario</div> }))
vi.mock('../components/PautaAssessor.jsx', () => ({ default: () => <div>PainelAssessor</div> }))
vi.mock('../components/Acompanhamento.jsx', () => ({ default: () => <div>AcompanhamentoPublico</div> }))

function setup(profile) {
  if (profile) sessionStorage.setItem('c2_profile', profile)
  else sessionStorage.removeItem('c2_profile')
  render(<MemoryRouter initialEntries={['/reuniao/1000007671']}><AuthProvider><Routes><Route path="/reuniao/:id" element={<PautaRouter />} /></Routes></AuthProvider></MemoryRouter>)
}

test.each([
  ['secretario', 'PainelSecretario'],
  ['deputado', 'PainelAssessor'],
  ['assessor', 'PainelAssessor'],
  ['anonimo', 'AcompanhamentoPublico'],
  [null, 'AcompanhamentoPublico']
])('profile %s renders %s', (profile, expected) => {
  setup(profile)
  expect(screen.getByText(expected)).toBeTruthy()
  sessionStorage.clear()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/pautaRouter.test.jsx`
Expected: FAIL — `PautaRouter` não exportado / sem `Acompanhamento`.

- [ ] **Step 3: Write the failing anonymous-button test**

Adicionar em `client/src/__tests__/identificacao.test.jsx`:

```jsx
test('anonymous button sets anonimo profile and navigates to meetings', async () => {
  render(
    <MemoryRouter initialEntries={['/identificacao']}>
      <AuthProvider>
        <Routes>
          <Route path="/identificacao" element={<Identificacao />} />
          <Route path="/reunioes" element={<div>Lista de reuniões</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole('button', { name: /Acompanhar sem identificação/i }))
  expect(await screen.findByText('Lista de reuniões')).toBeTruthy()
  expect(sessionStorage.getItem('c2_profile')).toBe('anonimo')
  sessionStorage.clear()
})
```

Adicionar `fireEvent` ao import existente de `@testing-library/react` nesse arquivo (não há `@testing-library/user-event` instalado).

Run: `npx vitest run src/__tests__/identificacao.test.jsx` → FAIL (botão ausente).

- [ ] **Step 4: Implement routing and button**

`App.jsx`: `PautaRouter` → `secretario` = `PautaSecretario`; `deputado`/`assessor` = `PautaAssessor`; resto = `Acompanhamento`. Adicionar `anonimo: 'Comissões Ao Vivo - Acompanhamento'` ao mapa `base` do header. `Identificacao.jsx`: botão `type="button"` "Acompanhar sem identificação" que chama `setAuth('anonimo','Visitante',null,null)` e `navigate('/reunioes')`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/pautaRouter.test.jsx src/__tests__/identificacao.test.jsx` → PASS
Run: `npx vitest run` (em `client/`) → PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/App.jsx client/src/components/Identificacao.jsx client/src/__tests__/pautaRouter.test.jsx client/src/__tests__/identificacao.test.jsx
git commit -m "feat(client): add anonymous accompaniment option and routing"
```

---

### Task 4: TV full-screen com QR

**Files:**
- Modify: `client/package.json`, `package-lock.json` (dependência `qrcode`)
- Modify: `client/vite.config.js` (`server.host: true`)
- Modify: `client/src/App.jsx` (extrair `Layout`, exportar, sem chrome em `/tv/`)
- Modify: `client/src/components/TvDisplay.jsx` (shell full-screen + faixa do QR)
- Create: `client/src/components/TvQrBadge.jsx`
- Create: `client/src/__tests__/tvLayout.test.jsx`
- Create: `client/src/__tests__/tvQrBadge.test.jsx`
- Modify: `client/src/__tests__/tv.test.jsx` (mock `qrcode`, pois a TV passa a renderizar o QR em todos os estados)

**Interfaces:**
- Produces: `export function Layout()` em `App.jsx`; `export default function TvQrBadge()`; shell da TV com `data-testid="tv-shell"`.
- Consumes: `qrcode` (`toDataURL`), `useParams`.

- [ ] **Step 1: Write the failing layout test**

Create `client/src/__tests__/tvLayout.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { Layout } from '../App.jsx'

const { toDataURL } = vi.hoisted(() => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,QR') }))
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }))
vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

test('TV is full-screen, has no app header and keeps the QR with a long ementa', async () => {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/vistas')) return { json: async () => ({}) }
    if (u.includes('/bloco')) return { json: async () => ({ ativo: false }) }
    return { json: async () => ({ iniciada: true, items: [{ id:'1', nuOrdem:1, status_oficial:'em_votacao', processoDadosView:{ txDescricao:'PL 197/2019', txEmenta:'Ementa muito longa '.repeat(80), txNomeAutores:'Autor' } }] }) }
  })
  render(<MemoryRouter initialEntries={['/tv/1000007671']}><AuthProvider><Layout /></AuthProvider></MemoryRouter>)
  expect(await screen.findByText(/PL 197\/2019/)).toBeTruthy()
  expect(screen.queryByText(/Comissões Ao Vivo/i)).toBeFalsy()
  expect(screen.queryByRole('link', { name: /Reuniões/i })).toBeFalsy()
  const shell = screen.getByTestId('tv-shell')
  expect(shell.className).toMatch(/h-screen/)
  expect(shell.className).toMatch(/bg-black/)
  const img = await screen.findByRole('img', { name: /QR code/i })
  expect(img.parentElement.className).not.toMatch(/\bfixed\b/)
  expect(img.parentElement.className).toMatch(/items-center/)
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/tvLayout.test.jsx`
Expected: FAIL — `Layout` não exportado / QR ausente.

- [ ] **Step 3: Write the failing QR test**

Create `client/src/__tests__/tvQrBadge.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TvDisplay from '../components/TvDisplay.jsx'

const { toDataURL } = vi.hoisted(() => ({ toDataURL: vi.fn(async () => 'data:image/png;base64,QR') }))
vi.mock('qrcode', () => ({ default: { toDataURL }, toDataURL }))
vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

test('TV QR points to the meeting accompaniment page', async () => {
  vi.stubGlobal('fetch', async () => ({ json: async () => ({ items: [], active_item_id: null }) }))
  render(<MemoryRouter initialEntries={['/tv/1000007671']}><Routes><Route path="/tv/:id" element={<TvDisplay />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('img', { name: /QR code/i })).toBeTruthy()
  expect(toDataURL).toHaveBeenCalledWith(expect.stringContaining('/reuniao/1000007671'), expect.anything())
  vi.unstubAllGlobals()
})
```

Run: `npx vitest run src/__tests__/tvQrBadge.test.jsx` → FAIL.

- [ ] **Step 4: Install dependency, expose Vite on the LAN, and keep the old TV tests green**

Run (na raiz): `npm install qrcode --workspace=client`
Em `client/vite.config.js`, adicionar `host: true` em `server`.
Em `client/src/__tests__/tv.test.jsx`, adicionar no topo (antes dos testes) o mock do QR:

```jsx
vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,QR' }, toDataURL: async () => 'data:image/png;base64,QR' }))
```

- [ ] **Step 5: Implement `TvQrBadge.jsx`**

`useParams` + `QRCode.toDataURL(`${window.location.origin}/reuniao/${id}`, { width: 512, margin: 1, errorCorrectionLevel: 'M' })`; renderizar `<img>` com `alt="QR code para acompanhar a reunião"` dentro de um bloco centralizado (`flex flex-col items-center gap-2`), legenda "Aponte a câmera e acompanhe no celular".

- [ ] **Step 6: Restructure `TvDisplay.jsx`**

Shell único com `data-testid="tv-shell"`: `h-screen w-screen overflow-hidden bg-black text-white flex flex-col p-[2vh] gap-[1.5vh]`; card `flex-1 w-full` com borda/gradiente atuais, fontes `clamp()`/`vw`; faixa do QR `h-[14vh]` centralizada com `TvQrBadge`; ementa longa truncada (`overflow-hidden`). Manter os cinco estados (aguardando, splash, bloco, item, vista) e os eventos de socket existentes. O retorno antecipado atual de "Aguardando item…" também deve virar conteúdo do card dentro do shell, para o QR existir em qualquer estado.

- [ ] **Step 7: Extract `Layout` in `App.jsx`**

`Layout` usa `useLocation`; se `pathname.startsWith('/tv/')`, retorna só `<AppRoutes />`; senão, o wrapper atual com `Header`/`VinculoBar`/`main`. `App` renderiza `<Layout />` dentro de `AuthProvider`/`BrowserRouter`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/tvLayout.test.jsx src/__tests__/tvQrBadge.test.jsx src/__tests__/tv.test.jsx` → PASS
Run: `npx vitest run` (em `client/`) → PASS
Run: `npm run build` (em `client/`) → build OK.

- [ ] **Step 9: Commit**

```bash
git add client/package.json package-lock.json client/vite.config.js client/src/App.jsx client/src/components/TvDisplay.jsx client/src/components/TvQrBadge.jsx client/src/__tests__/tvLayout.test.jsx client/src/__tests__/tvQrBadge.test.jsx client/src/__tests__/tv.test.jsx
git commit -m "feat(client): full-screen TV layout with QR to the public page"
```

---

### Task 5: Verificação final

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Run both test suites**

Run: `npx vitest run` em `server/` → PASS
Run: `npx vitest run` em `client/` → PASS

- [ ] **Step 2: Build and smoke-test**

Run: `npm run build` em `client/` → OK
Com os dev servers de pé, abrir `/tv/<id>` pelo IP da rede, conferir: sem header, card grande, QR ao alcance da câmera apontando para `/reuniao/<id>`.
Abrir a página do QR no celular/outra aba: conferir pauta, ausência de notas, botão de relatório; baixar o PDF e conferir o aviso de provisoriedade.

- [ ] **Step 3: Commit final (se houver ajuste)**

Se a verificação exigir ajuste, refazer o ciclo TDD da tarefa correspondente e commitar. Sem ajustes, nada a commitar.
