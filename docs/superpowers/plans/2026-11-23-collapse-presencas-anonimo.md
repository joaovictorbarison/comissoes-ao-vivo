# Collapse de itens finalizados + painel de presenças no anônimo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolher itens finalizados nas telas de leitura (deputado/assessor/anônimo) como no secretário, enxugar o header do visualizador público, e dar ao anônimo um painel somente-leitura de presenças (elenco da comissão + outros parlamentares).

**Architecture:** Helper compartilhado de collapse (`itemCollapse.js`) reutilizado em `PautaAssessor` e `Acompanhamento`. Header condicional por perfil em `App.jsx`. Novo componente somente-leitura `PresencasPublicas.jsx` (fetch público) integrado no topo de `Acompanhamento`.

**Tech Stack:** React 18, React Router 6, Tailwind, Vite, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-collapse-presencas-anonimo-design.md`

## Global Constraints

- Não alterar `PautaSecretario.jsx` nem `PresentesTab.jsx` (o secretário mantém sua cópia inline do collapse).
- Anônimo/sem perfil não ganha ação de escrita; `PresencasPublicas` usa `fetch` público, nunca `authFetch`.
- Collapse reproduz exatamente `TERMINAL_FINAL` do secretário; `nao_deliberado` e `aprovado_separado` NÃO recolhem; `em_discussao`/`em_votacao`/`pendente` sempre abertos.
- "Presente" no painel = presença `confirmed=1` (verde ✓); demais membros neutros; pendentes não marcados como presentes.
- Header público esconde "Ver TV" e "Identificação" para `profile==='anonimo'` OU `!profile`; mantém "Reuniões".
- Telas de deputado/assessor/secretário e seus fluxos de escrita permanecem funcionalmente inalterados (só ganham o collapse visual).
- Sem nova dependência; sem mudança de schema/endpoint.

## Review Focus

- Quem escaneia o QR chega com perfil `null` (não `anonimo`): o header enxuto precisa valer para `null` também → teste de perfil nulo na Task 2.
- Item `nao_deliberado` (e `aprovado_separado`) não pode recolher → teste na Task 1.
- Painel de presenças sem membros (colegiados vazios) não pode quebrar e ainda mostra outros presentes → teste na Task 3.
- Painel de presenças nunca renderiza Confirmar/Excluir/Incluir/Limpar, mesmo com presença pendente → teste na Task 3.
- Item finalizado expandido manualmente deve poder recolher de novo (toggle ida-e-volta) → teste na Task 1.

---

### Task 1: Helper de collapse + collapse em PautaAssessor e Acompanhamento

**Files:**
- Create: `client/src/lib/itemCollapse.js`
- Create: `client/src/__tests__/itemCollapse.test.jsx`
- Modify: `client/src/components/PautaAssessor.jsx`
- Modify: `client/src/components/Acompanhamento.jsx`
- Create: `client/src/__tests__/collapseViews.test.jsx`

**Interfaces:**
- Produces (de `itemCollapse.js`):
  - `TERMINAL_FINAL: string[]` = `['aprovado_relator','aprovado_simbolico','aprovado_nominal','rejeitado_relator','rejeitado_simbolico','rejeitado_nominal','vista','retirado']`
  - `STATUS_SHORT: Record<string,string>` = `{aprovado_relator:'Aprovado',aprovado_simbolico:'Aprovado',aprovado_nominal:'Aprovado',rejeitado_relator:'Rejeitado',rejeitado_simbolico:'Rejeitado',rejeitado_nominal:'Rejeitado',vista:'Vista',retirado:'Retirado'}`
  - `isTerminalStatus(status: string): boolean`
  - `useOpenItems(): [openItems: Set<string>, toggleItem: (key: string|number) => void]`
- Consumes: nada de tarefas anteriores.
- Padrão de render (ambos os componentes): `const isTerminal = isTerminalStatus(status); const expanded = !isTerminal || openItems.has(String(it.id))`. Se `!expanded`: linha compacta `<button aria-label={`Expandir item ${it.nuOrdem}`} onClick={()=>toggleItem(it.id)}>Item {nuOrdem} — {txDescricao} [{STATUS_SHORT[status]}] ▼</button>`. Se expandido e `isTerminal`: controle `<button aria-label={`Recolher item ${it.nuOrdem}`} onClick={()=>toggleItem(it.id)}>▼</button>` no cabeçalho/banner do card.

- [ ] **Step 1: Write the failing helper test**

Create `client/src/__tests__/itemCollapse.test.jsx`:

```jsx
import { test, expect } from 'vitest'
import { TERMINAL_FINAL, STATUS_SHORT, isTerminalStatus } from '../lib/itemCollapse.js'

test('terminal set matches the secretary and excludes nao_deliberado/aprovado_separado', () => {
  expect(isTerminalStatus('aprovado_relator')).toBe(true)
  expect(isTerminalStatus('rejeitado_nominal')).toBe(true)
  expect(isTerminalStatus('vista')).toBe(true)
  expect(isTerminalStatus('retirado')).toBe(true)
  expect(isTerminalStatus('nao_deliberado')).toBe(false)
  expect(isTerminalStatus('aprovado_separado')).toBe(false)
  expect(isTerminalStatus('em_votacao')).toBe(false)
  expect(isTerminalStatus('pendente')).toBe(false)
  expect(STATUS_SHORT.aprovado_simbolico).toBe('Aprovado')
  expect(STATUS_SHORT.vista).toBe('Vista')
  expect(TERMINAL_FINAL).toHaveLength(8)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/itemCollapse.test.jsx` (em `client/`)
Expected: FAIL — módulo `itemCollapse.js` não encontrado.

- [ ] **Step 3: Implement `itemCollapse.js`**

Exportar `TERMINAL_FINAL`, `STATUS_SHORT`, `isTerminalStatus` (inclusão no array) e `useOpenItems` (estado `Set` + `toggleItem` que adiciona/remove `String(key)` imutavelmente). Valores exatos das Interfaces.

- [ ] **Step 4: Run helper test to verify it passes**

Run: `npx vitest run src/__tests__/itemCollapse.test.jsx` → PASS.

- [ ] **Step 5: Write the failing views test**

Create `client/src/__tests__/collapseViews.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import PautaAssessor from '../components/PautaAssessor.jsx'
import Acompanhamento from '../components/Acompanhamento.jsx'

vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))
vi.mock('../components/AssessoresTab.jsx', () => ({ default: () => null }))
vi.mock('../components/PresencasPublicas.jsx', () => ({ default: () => null }))

const items = [
  { id:'t1', nuOrdem:1, status_oficial:'aprovado_relator', processoDadosView:{ txDescricao:'PL 1/2026', txEmenta:'Ementa Aprovada', txNomeAutores:'Autor A' }, documentosVoto:[] },
  { id:'v1', nuOrdem:2, status_oficial:'em_votacao', processoDadosView:{ txDescricao:'PL 2/2026', txEmenta:'Ementa Votacao', txNomeAutores:'Autor B' }, documentosVoto:[] },
  { id:'n1', nuOrdem:3, status_oficial:'nao_deliberado', processoDadosView:{ txDescricao:'PL 3/2026', txEmenta:'Ementa Nao Deliberada', txNomeAutores:'Autor C' }, documentosVoto:[] }
]
function stubFetch() {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/vistas')) return { json: async () => ({}) }
    if (u.includes('/anotacoes')) return { json: async () => [] }
    if (u.includes('/api/reuniao/')) return { json: async () => ({ items }) }
    return { json: async () => [] }
  })
}

test('deputy view collapses terminal item, keeps voting and nao_deliberado open, toggles back', async () => {
  stubFetch()
  sessionStorage.setItem('c2_profile','deputado'); sessionStorage.setItem('c2_name','Gil')
  render(<MemoryRouter initialEntries={['/reuniao/1']}><AuthProvider><Routes><Route path="/reuniao/:id" element={<PautaAssessor />} /></Routes></AuthProvider></MemoryRouter>)
  expect(await screen.findByText('Ementa Votacao')).toBeTruthy()
  expect(screen.getByText('Ementa Nao Deliberada')).toBeTruthy()
  expect(screen.queryByText('Ementa Aprovada')).toBeFalsy()
  fireEvent.click(screen.getByRole('button', { name: /Expandir item 1/ }))
  expect(await screen.findByText('Ementa Aprovada')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Recolher item 1/ }))
  expect(screen.queryByText('Ementa Aprovada')).toBeFalsy()
  sessionStorage.clear(); vi.unstubAllGlobals()
})

test('anonymous view collapses terminal item and keeps voting open', async () => {
  stubFetch()
  render(<MemoryRouter initialEntries={['/reuniao/1']}><Routes><Route path="/reuniao/:id" element={<Acompanhamento />} /></Routes></MemoryRouter>)
  expect(await screen.findByText('Ementa Votacao')).toBeTruthy()
  expect(screen.queryByText('Ementa Aprovada')).toBeFalsy()
  fireEvent.click(screen.getByRole('button', { name: /Expandir item 1/ }))
  expect(await screen.findByText('Ementa Aprovada')).toBeTruthy()
  vi.unstubAllGlobals()
})
```

Nota: o mock de `PresencasPublicas` é proposital e deve ser mantido: a Task 3 passa a importar esse componente dentro de `Acompanhamento`, e o mock garante que este teste de collapse continue isolado (sem buscar presenças reais). O componente ainda não existe nesta tarefa; o mock com factory é inofensivo enquanto nada o importa.

- [ ] **Step 6: Run views test to verify it fails**

Run: `npx vitest run src/__tests__/collapseViews.test.jsx`
Expected: FAIL — itens finalizados ainda renderizam abertos (sem "Expandir item 1").

- [ ] **Step 7: Apply collapse to PautaAssessor and Acompanhamento**

Em ambos: importar `isTerminalStatus, STATUS_SHORT, useOpenItems` de `../lib/itemCollapse.js`; `const [openItems, toggleItem] = useOpenItems()`. No map de itens, calcular `isTerminal`/`expanded`; retornar a linha compacta quando `!expanded`; no card expandido de item terminal, adicionar o botão "Recolher item N". Manter todo o conteúdo existente (notas/vínculo no assessor; links no anônimo). Não tocar no secretário.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/collapseViews.test.jsx src/__tests__/itemCollapse.test.jsx` → PASS
Run: `npx vitest run` (em `client/`) → PASS (testes existentes, inclusive `pautaAssessor.test.jsx`, não podem quebrar).

- [ ] **Step 9: Commit**

```bash
git add client/src/lib/itemCollapse.js client/src/__tests__/itemCollapse.test.jsx client/src/__tests__/collapseViews.test.jsx client/src/components/PautaAssessor.jsx client/src/components/Acompanhamento.jsx
git commit -m "feat(client): collapse finalized items in deputy/assessor and anonymous views"
```

---

### Task 2: Header enxuto para o visualizador público

**Files:**
- Modify: `client/src/App.jsx` (componente `Header`)
- Create: `client/src/__tests__/headerPublico.test.jsx`

**Interfaces:**
- Produces: `Header` esconde "Ver TV" e "Identificação" quando `!profile || profile==='anonimo'`; mantém "Reuniões" e o subtítulo.
- Consumes: `useAuth().profile` (existente).

- [ ] **Step 1: Write the failing test**

Create `client/src/__tests__/headerPublico.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { Layout } from '../App.jsx'

vi.mock('../components/PautaSecretario.jsx', () => ({ default: () => <div>PainelSecretario</div> }))
vi.mock('../components/PautaAssessor.jsx', () => ({ default: () => <div>PainelAssessor</div> }))
vi.mock('../components/Acompanhamento.jsx', () => ({ default: () => <div>AcompanhamentoPublico</div> }))
vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

function setup(profile) {
  vi.stubGlobal('fetch', async () => ({ json: async () => [] }))
  if (profile) sessionStorage.setItem('c2_profile', profile)
  else sessionStorage.removeItem('c2_profile')
  render(<MemoryRouter initialEntries={['/reuniao/123']}><AuthProvider><Layout /></AuthProvider></MemoryRouter>)
}

test.each([['anonimo'], [null]])('public profile %s hides Ver TV and Identificação, keeps Reuniões', (profile) => {
  setup(profile)
  expect(screen.queryByText(/Ver TV/)).toBeFalsy()
  expect(screen.queryByRole('link', { name: /Identificação/ })).toBeFalsy()
  expect(screen.getByRole('link', { name: /Reuniões/ })).toBeTruthy()
  sessionStorage.clear(); vi.unstubAllGlobals()
})

test('deputy keeps Identificação and Ver TV', () => {
  setup('deputado')
  expect(screen.getByRole('link', { name: /Identificação/ })).toBeTruthy()
  expect(screen.getByText(/Ver TV/)).toBeTruthy()
  sessionStorage.clear(); vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/headerPublico.test.jsx`
Expected: FAIL — perfil público ainda mostra "Ver TV"/"Identificação".

- [ ] **Step 3: Implement conditional header**

Em `Header` (`App.jsx`): `const publico = !profile || profile==='anonimo'`. Renderizar o link "Ver TV" apenas quando `tvId && !publico`; o link "Identificação" apenas quando `!publico`. "Reuniões" permanece. Não alterar o botão "Solicitar vínculo" (assessor).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/headerPublico.test.jsx` → PASS
Run: `npx vitest run` (em `client/`) → PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/__tests__/headerPublico.test.jsx
git commit -m "feat(client): hide TV and identification links for public viewers"
```

---

### Task 3: Painel de presenças somente-leitura no anônimo

**Files:**
- Create: `client/src/components/PresencasPublicas.jsx`
- Create: `client/src/__tests__/presencasPublicas.test.jsx`
- Modify: `client/src/components/Acompanhamento.jsx`
- Modify: `client/src/__tests__/acompanhamento.test.jsx`

**Interfaces:**
- Produces: `export default function PresencasPublicas({ idReuniao })`. Busca pública: `GET /api/reuniao/${idReuniao}/presencas`, `GET /api/reuniao/${idReuniao}` (→ `colegiadosRelacionados[].id`), `GET /api/legis/colegiados/${cid}/membros`, `GET /api/legis/parlamentares-ativos`. Socket `presence_pending`/`presence_confirmed` → recarrega presenças. Cabeçalho recolhível `Presenças (N presentes) ▼/▶`, aberto por padrão. Seções Efetivos / Substitutos / Outros presentes (não-membros). Presente = `confirmed=1` (verde ✓). Sem botões de escrita.
- Consumes: `useSocket(id)` (existente).

- [ ] **Step 1: Write the failing component test**

Create `client/src/__tests__/presencasPublicas.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import PresencasPublicas from '../components/PresencasPublicas.jsx'

vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ on: () => {}, off: () => {} }) }))

function stub() {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/presencas')) return { json: async () => [
      { id:1, name:'Gil Diniz', profile:'deputado', confirmed:true, origem:'login' },
      { id:2, name:'Maria Souza', profile:'deputado', confirmed:false, origem:'login' },
      { id:3, name:'Outro Parlamentar', profile:'deputado', confirmed:true, origem:'manual' }
    ] }
    if (u.includes('/colegiados/')) return { json: async () => [
      { parlamentar:'Gil Diniz', ocupacao:'Efetivo', federacao:'PA' },
      { parlamentar:'Maria Souza', ocupacao:'Efetivo', federacao:'PB' },
      { parlamentar:'Joao Sub', ocupacao:'Substituto', federacao:'PC' }
    ] }
    if (u.includes('/parlamentares-ativos')) return { json: async () => [{ nome:'Outro Parlamentar', partido:'PD' }] }
    if (u.includes('/api/reuniao/')) return { json: async () => ({ colegiadosRelacionados:[{ id:'c1', sigla:'CDD', nome:'Comissão X' }] }) }
    return { json: async () => [] }
  })
}

test('shows roster with party, marks confirmed present, lists other present parliamentarians, no write actions', async () => {
  stub()
  render(<PresencasPublicas idReuniao="1" />)
  expect(await screen.findByText(/Gil Diniz/)).toBeTruthy()
  expect(screen.getByText(/Maria Souza/)).toBeTruthy()
  expect(screen.getByText(/Joao Sub/)).toBeTruthy()
  expect(screen.getByText(/Outro Parlamentar/)).toBeTruthy()
  expect(screen.getByText(/Efetivos/)).toBeTruthy()
  expect(screen.getByText(/Substitutos/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Confirmar/ })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Excluir/ })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Incluir/ })).toBeFalsy()
  expect(screen.queryByRole('button', { name: /Limpar/ })).toBeFalsy()
  vi.unstubAllGlobals()
})

test('panel collapses and expands', async () => {
  stub()
  render(<PresencasPublicas idReuniao="1" />)
  expect(await screen.findByText(/Gil Diniz/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Presenças/ }))
  expect(screen.queryByText(/Gil Diniz/)).toBeFalsy()
  fireEvent.click(screen.getByRole('button', { name: /Presenças/ }))
  expect(await screen.findByText(/Gil Diniz/)).toBeTruthy()
  vi.unstubAllGlobals()
})

test('empty roster still renders other present parliamentarians without crashing', async () => {
  vi.stubGlobal('fetch', async (url) => {
    const u = String(url)
    if (u.includes('/presencas')) return { json: async () => [{ id:3, name:'Outro Parlamentar', confirmed:true, origem:'manual' }] }
    if (u.includes('/parlamentares-ativos')) return { json: async () => [{ nome:'Outro Parlamentar', partido:'PD' }] }
    if (u.includes('/api/reuniao/')) return { json: async () => ({ colegiadosRelacionados:[] }) }
    return { json: async () => [] }
  })
  render(<PresencasPublicas idReuniao="1" />)
  expect(await screen.findByText(/Outro Parlamentar/)).toBeTruthy()
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/presencasPublicas.test.jsx`
Expected: FAIL — módulo `PresencasPublicas.jsx` não encontrado.

- [ ] **Step 3: Implement `PresencasPublicas.jsx`**

Componente somente-leitura conforme Interfaces. Reutilizar a estrutura visual do `PresentesTab` (efetivos/substitutos/outros-presentes, `formatName`/`normalizeName` locais), mas: `fetch` público (sem `authFetch`); marca presente apenas com `confirmed=1` (verde ✓); sem botões Confirmar/Excluir/Incluir/Limpar nem inputs. `loadMembros` itera `colegiadosRelacionados[].id` (dedup por matrícula, efetivo prioriza substituto) e busca partidos em `/parlamentares-ativos`. Cabeçalho `<button>Presenças ({presentCount} presentes) {open?'▼':'▶'}</button>` com `open` inicial `true`.

- [ ] **Step 4: Run component test to verify it passes**

Run: `npx vitest run src/__tests__/presencasPublicas.test.jsx` → PASS.

- [ ] **Step 5: Write the failing integration test**

Em `client/src/__tests__/acompanhamento.test.jsx`: adicionar no topo `vi.mock('../components/PresencasPublicas.jsx', () => ({ default: () => <div>PainelPresencasPublicas</div> }))` e, no teste existente, após renderizar, `expect(await screen.findByText('PainelPresencasPublicas')).toBeTruthy()`.

Run: `npx vitest run src/__tests__/acompanhamento.test.jsx`
Expected: FAIL — `Acompanhamento` ainda não renderiza o painel.

- [ ] **Step 6: Integrate panel into Acompanhamento**

Importar `PresencasPublicas` e renderizar `<PresencasPublicas idReuniao={id} />` logo após o cabeçalho/aviso e antes da lista de itens.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/acompanhamento.test.jsx src/__tests__/presencasPublicas.test.jsx` → PASS
Run: `npx vitest run` (em `client/`) → PASS
Run: `npm run build` (em `client/`) → OK.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/PresencasPublicas.jsx client/src/__tests__/presencasPublicas.test.jsx client/src/components/Acompanhamento.jsx client/src/__tests__/acompanhamento.test.jsx
git commit -m "feat(client): read-only collapsible presence panel for anonymous view"
```

---

### Task 4: Verificação final

**Files:** nenhum (apenas verificação).

- [ ] **Step 1: Run both suites + build**

Run: `npx vitest run` em `client/` → PASS
Run: `npx vitest run` em `server/` → PASS
Run: `npm run build` em `client/` → OK

- [ ] **Step 2: Smoke-test**

Com os dev servers de pé: abrir `/reuniao/<id>` como anônimo (e via QR/perfil nulo) → header sem "Ver TV"/"Identificação", itens finalizados recolhidos, painel de presenças recolhível com elenco + partidos. Abrir como deputado/assessor → itens finalizados recolhidos, demais fluxos intactos. Secretário inalterado.

- [ ] **Step 3: Commit final (se houver ajuste)**

Se a verificação exigir ajuste, refazer o ciclo TDD da tarefa correspondente e commitar. Sem ajustes, nada a commitar.
