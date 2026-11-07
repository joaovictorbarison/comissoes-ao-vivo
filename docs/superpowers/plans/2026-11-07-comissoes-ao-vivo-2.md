# Comissões Ao Vivo 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fresh PWA (React+Vite+Tailwind / Node+Express+Socket.io / SQLite) that lists all Legis "Convocada" meetings, shows the full pauta, gives assessor/deputado a private annotated view, gives the secretary an editable official-status console that drives a TV mirror, and generates a final PDF — supporting up to 10 simultaneous isolated meetings.

**Architecture:** Monorepo with `server/` (Express + Socket.io + SQLite) and `client/` (Vite + React + Tailwind). Backend proxies the Legis public API, caches meetings/pautas in SQLite on first open, and isolates all realtime state in Socket.io rooms keyed by `idReuniao`. Frontend is role-based after simple identification (profile + name; secretary password `dac2027`), with four route groups: identification, meetings list, pauta (two layouts), TV.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Node.js >=18, bash `npm`, Express 4, Socket.io 4, `better-sqlite3`, `puppeteer` (PDF), Vitest + Playwright (tests), `npm` workspaces via two package.json files (root + `client/` + `server/`).

**Spec:** `docs/superpowers/specs/2026-11-07-comissoes-ao-vivo-2-design.md`

## Global Constraints

- Stack is fixed: React + Vite + Tailwind CSS (front), Node.js + Express + Socket.io (back), SQLite — fresh codebase, no reuse from the v1 tree.
- Secretary password is `dac2027` for this MVP, validated on the backend; no Legis SSO; biometrics are future-only (WebAuthn).
- Meetings list = `status.txNome = "Convocada"` from `GET https://legis-api-portal-prd.al.sp.gov.br/colegiado/reunioes`; no search, no filters in the UI; quantity is small.
- Each meeting card shows: number + type (Ordinária/Extraordinária/Especial), date/time, local, subject, commissions, and PDF links for Comunicado and Pauta.
- Pauta is all items from `GET /colegiado/reuniao/:idReuniao/pauta` — never capped at 10.
- Assessor/Deputado card layout is Option A: official-status banner on top, then ementa/autor/relator, then private notes footer (🔒). Statuses visible live: em discussão, em votação, aprovado/rejeitado voto do relator, aprovado voto em separado, vista, retirado, pendente — discussion vs voting are distinct states with distinct colors.
- Secretary status edits (aprovado/rejeitado/retirado/vista/discussão/votação) are reversible at any time until the meeting is closed; "Pausar/Avançar" changes the active item, it is not a persisted status.
- Up to 10 simultaneous meetings, each in its own Socket.io room (`idReuniao`); no data may leak between rooms (status, presences, private notes, TV).
- Private notes are only visible to the paired assessor↔deputado of the same cabinet (normalized free-text name key + `idReuniao`); never to the secretary or other cabinets.
- When a Deputy/Assessor identifies and enters a meeting, their name appears in that meeting's "Presentes" tab for the secretary to confirm.
- Final PDF (generated on close) has: header (number, type, date, time, plenário, commission), confirmed presences, and pauta items with final deliberations and vistas. Session data persists in SQLite after closing for later consultation.
- Identity visual is modern ALESP-inspired: institutional blue `#0b2f6a` / `#1e4db7`, white, yellow accent `#facc15`, rounded cards, kiosk TV layout.
- Zero paper, no app install, PWA via browser link only.

## Review Focus

- **Legis API down / null payloads** — a person opening the app expects the meetings list to degrade gracefully (empty state + retry), not a crash; pinned by Task 3's proxy tests.
- **Cross-meeting leak** — with 10 simultaneous meetings, a person expects meeting 1's status to never appear in meeting 2's screen or TV; pinned by Task 4's room isolation tests.
- **Private-note leak** — a person expects a cabinet's note to be invisible to the secretary and other cabinets, even with similar names; pinned by Task 4's privacy tests.
- **Status edit after close / stale TV** — a person expects the TV to reflect the latest secretary decision and the PDF to be a snapshot of the final editable state, not auto-finalized at first "aprovado"; pinned by Task 8/10 tests.
- **Presence dupes / name typos** — a person expects joining twice (or "João" vs "joao") to not create two pending presences; pinned by Task 8's normalization tests.

---

## File Structure

```
Comissões ao vivo 2/
├── package.json                 # root scripts (dev, build, test), workspaces
├── .gitignore
├── README.md
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # router: /, /identificacao, /reunioes, /reuniao/:id, /tv/:id
│       ├── index.css
│       ├── context/AuthContext.jsx
│       ├── hooks/useSocket.js
│       ├── hooks/useLegisApi.js
│       ├── components/
│       │   ├── Identificacao.jsx
│       │   ├── ListaReunioes.jsx
│       │   ├── PautaAssessor.jsx      # Option A
│       │   ├── PautaSecretario.jsx
│       │   ├── TvDisplay.jsx
│       │   └── PresentesTab.jsx
│       └── __tests__/
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.js             # app + HTTP + Socket.io bootstrap
│   │   ├── db.js                # better-sqlite3 init + schema
│   │   ├── routes/legis.js      # proxy to Legis API
│   │   ├── routes/meeting.js    # meeting/pauta cache endpoints
│   │   ├── socket/rooms.js      # room join/leave + isolation
│   │   ├── socket/meetingHandler.js
│   │   └── pdf/report.js        # final PDF generation
│   └── __tests__/
├── docs/superpowers/specs/2026-11-07-comissoes-ao-vivo-2-design.md  (existing)
└── docs/superpowers/plans/2026-11-07-comissoes-ao-vivo-2.md          (this plan)
```

Core interfaces locked here so later tasks never rename:
- `AuthContext`: `{ profile: 'secretario'|'assessor'|'deputado', name: string, cabinetKey: string, setAuth(p,n), clearAuth() }`
- Socket rooms: `socket.join('reuniao:'+idReuniao)`, events `official_status_changed`, `presence_pending`, `presence_confirmed`, `note_created`, `active_item_changed`
- REST: `GET /api/legis/reunioes`, `GET /api/legis/reuniao/:id/pauta`, `GET /api/reuniao/:id`, `POST /api/reuniao/:id/presenca`, `POST /api/reuniao/:id/status`, `POST /api/reuniao/:id/anotacao`, `GET /api/reuniao/:id/relatorio.pdf`

---

### Task 1: Project scaffold (clean, no v1 code)

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`
- Create: `client/package.json`, `client/vite.config.js`, `client/tailwind.config.js`, `client/postcss.config.js`, `client/index.html`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/index.css`
- Create: `server/package.json`, `server/src/index.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run dev` (Vite + Express on separate ports), `client/src/App.jsx` renders "Comissões Ao Vivo 2" placeholder, `server/src/index.js` serves JSON `{"ok":true}` at `/health`.

- [ ] **Step 1: Write the failing scaffold check**

```js
// client/src/__tests__/scaffold.test.jsx
import { render, screen } from '@testing-library/react'
test('placeholder renders', () => {
  render(<div>Comissões Ao Vivo 2</div>)
  expect(screen.getByText('Comissões Ao Vivo 2')).toBeTruthy()
})
```

- [ ] **Step 2: Run tests to verify behavior**

Run: `npm test --workspace=client -- --run src/__tests__/scaffold.test.jsx`
Expected: PASS only after files exist; before, FAIL "file not found" (proves TDD cycle).

- [ ] **Step 3: Implement scaffold files**

Create the minimal Vite React + Tailwind + Express files listed above (placeholder App, health endpoint, root scripts `dev`, `build`, `test`). Exact dependency versions: `react@18`, `vite@5`, `tailwindcss@3`, `express@4`, `socket.io@4`, `better-sqlite3`, `puppeteer`.

- [ ] **Step 4: Run scaffold tests**

Run: `npm test --workspace=client -- --run src/__tests__/scaffold.test.jsx && curl -s http://localhost:3000/health`
Expected: PASS + `{"ok":true}`

- [ ] **Step 5: Commit**

```bash
git add package.json client/ server/ .gitignore README.md
git commit -m "feat: scaffold Comissoes ao vivo 2"
```

---

### Task 2: SQLite schema + init

**Files:**
- Create: `server/src/db.js`
- Create: `server/src/__tests__/db.test.js`

**Interfaces:**
- Consumes: Task 1 server bootstrap.
- Produces: `initDb(path): Database`, `getDb(): Database` — tables `sessions`, `agenda_items`, `official_status`, `presencas`, `anotacoes_privadas`, `relatorio_final` per spec Section 7, all with `id_reuniao TEXT NOT NULL` for isolation.

- [ ] **Step 1: Write failing test**

```js
// server/src/__tests__/db.test.js
test('schema creates all 6 tables keyed by meeting', () => {
  const { initDb } = require('../db.js')
  const db = initDb(':memory:')
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name)
  expect(tables).toContain('sessions')
  expect(tables).toContain('agenda_items')
  expect(tables).toContain('official_status')
  expect(tables).toContain('presencas')
  expect(tables).toContain('anotacoes_privadas')
  expect(tables).toContain('relatorio_final')
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test --workspace=server -- --run src/__tests__/db.test.js`
Expected: FAIL "Cannot find module '../db.js'"

- [ ] **Step 3: Implement `initDb`**

Create `server/src/db.js` with `better-sqlite3`, pragma `journal_mode=WAL`, `CREATE TABLE IF NOT EXISTS` for the 6 tables above with `id_reuniao` FK/index.

- [ ] **Step 4: Run test, expect PASS**

Run: `npm test --workspace=server -- --run src/__tests__/db.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db.js server/src/__tests__/db.test.js
git commit -m "feat: sqlite schema"
```

---

### Task 3: Legis API proxy + agenda cache

**Files:**
- Create: `server/src/routes/legis.js`, `server/src/routes/meeting.js`
- Create: `server/src/__tests__/legis.test.js`
- Modify: `server/src/index.js` (mount routes)

**Interfaces:**
- Consumes: `GET https://legis-api-portal-prd.al.sp.gov.br/colegiado/reunioes?size=50`, `GET /colegiado/reuniao/:id/pauta` (via `fetchLegis`).
- Produces: `GET /api/legis/reunioes → {content:[...], total}`, `GET /api/legis/reuniao/:id/pauta → [...]` (all items, never truncated), `GET /api/reuniao/:id` saves to SQLite then returns cached rows.

- [ ] **Step 1: Write failing test**

```js
// server/src/__tests__/legis.test.js
test('proxy returns all pauta items without 10-item cap', async () => {
  const items = await fetch('/api/legis/reuniao/1000007671/pauta').then(r=>r.json())
  expect(Array.isArray(items)).toBe(true)
  expect(items.length).toBeGreaterThan(10)
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test --workspace=server -- --run src/__tests__/legis.test.js`
Expected: FAIL "route not found"

- [ ] **Step 3: Implement proxy routes**

In `legis.js`: `fetchLegis(path)` with `Accept: application/json`, return parsed JSON or `null` on error. In `meeting.js`: on `GET /api/reuniao/:id`, fetch pauta, `INSERT OR REPLACE` into `sessions`/`agenda_items`, return rows. Mount both in `index.js`.

- [ ] **Step 4: Run test against live Legis, expect PASS**

Run: `npm test --workspace=server -- --run src/__tests__/legis.test.js`
Expected: PASS (live API returns >10 items for 1000007671)

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/ server/src/__tests__/legis.test.js server/src/index.js
git commit -m "feat: legis proxy + cache"
```

---

### Task 4: Socket.io rooms + isolation + privacy

**Files:**
- Create: `server/src/socket/rooms.js`, `server/src/socket/meetingHandler.js`
- Create: `server/src/__tests__/rooms.test.js`
- Modify: `server/src/index.js` (attach Socket.io, register handler)

**Interfaces:**
- Consumes: `socket.join('reuniao:'+idReuniao)` (max 10 active rooms guard), `initDb`.
- Produces: events `official_status_changed`, `presence_pending`, `presence_confirmed`, `note_created`, `active_item_changed` — all emitted **only** to `io.to('reuniao:'+idReuniao)`. Notes query filters by `cabinet_key + id_reuniao`.

- [ ] **Step 1: Write failing isolation test**

```js
// server/src/__tests__/rooms.test.js
test('status in meeting A does not reach meeting B', async () => {
  // connect two clients, join reuniao:1 and reuniao:2, emit status on :1
  // expect client B received no event
  expect(false).toBe(true) // fails until implemented
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npm test --workspace=server -- --run src/__tests__/rooms.test.js`
Expected: FAIL as written

- [ ] **Step 3: Implement rooms + handler**

Create `rooms.js` (join/leave, room registry, 10-room soft cap warning). Create `meetingHandler.js` validating `idReuniao` exists, writing `official_status`/`presencas`/`anotacoes_privadas`, emitting only to that room. Private-note query always filters `cabinet_key`.

- [ ] **Step 4: Run tests, expect PASS**

Run: `npm test --workspace=server -- --run src/__tests__/rooms.test.js`
Expected: PASS; also temp test that `note_created` is absent for other cabinet.

- [ ] **Step 5: Commit**

```bash
git add server/src/socket/ server/src/__tests__/rooms.test.js server/src/index.js
git commit -m "feat: socket rooms isolation"
```

---

### Task 5: Identification + AuthContext

**Files:**
- Create: `client/src/context/AuthContext.jsx`, `client/src/components/Identificacao.jsx`
- Create: `client/src/__tests__/identificacao.test.jsx`
- Modify: `client/src/App.jsx` (routes `/`, `/identificacao`, `/reunioes`, `/reuniao/:id`, `/tv/:id`)

**Interfaces:**
- Consumes: `setAuth(profile,name)`, `cabinetKey = normalize(name)`; secretary gated by backend check of password `dac2027` via `POST /api/auth/secretario`.
- Produces: `AuthContext` value and protected-route redirect to `/identificacao`.

- [ ] **Step 1: Write failing test**

```jsx
// client/src/__tests__/identificacao.test.jsx
test('secretario without password is blocked', () => {
  render(<Identificacao />)
  expect(screen.getByText(/Secretário/i)).toBeTruthy()
  expect(screen.queryByText(/Continuar/i)).toBeFalsy() // until name+password valid
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test --workspace=client -- --run src/__tests__/identificacao.test.jsx`
Expected: FAIL (component missing)

- [ ] **Step 3: Implement Identificacao**

Three profile cards (Secretário / Assessor / Deputado), name input, password field only for Secretary, emits `setAuth`, normalizes cabinet key (`toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()`).

- [ ] **Step 4: Run, expect PASS**

Run: `npm test --workspace=client -- --run src/__tests__/identificacao.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/context/ client/src/components/Identificacao.jsx client/src/__tests__/identificacao.test.jsx client/src/App.jsx
git commit -m "feat: identification screen"
```

---

### Task 6: Meetings list (no filters)

**Files:**
- Create: `client/src/components/ListaReunioes.jsx`, `client/src/hooks/useLegisApi.js`
- Create: `client/src/__tests__/lista.test.jsx`
- Modify: `client/src/App.jsx` (route `/reunioes`)

**Interfaces:**
- Consumes: `GET /api/legis/reunioes#auth`, `useLegisApi('/api/legis/reunioes')`.
- Produces: card per meeting (nuReuniao, tipo, dt, local, assunto, commissions, Comunicado/Pauta PDF links) linking to `/reuniao/:id`.

- [ ] **Step 1: Write failing test**

```jsx
test('renders convocada meeting 1000007671', async () => {
  render(<ListaReunioes />)
  await screen.findByText(/José Bonifácio/i)
  expect(screen.getAllByRole('link')).toBeTruthy()
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test --workspace=client -- --run src/__tests__/lista.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement ListaReunioes**

Fetch `/api/legis/reunioes`, filter `status.txNome==='Convocada'`, render ALESP-blue cards. No search input.

- [ ] **Step 4: Run, expect PASS**

Run: `npm test --workspace=client -- --run src/__tests__/lista.test.jsx`
Expected: PASS (mocked fetch returns the real sample JSON).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ListaReunioes.jsx client/src/hooks/useLegisApi.js client/src/__tests__/lista.test.jsx
git commit -m "feat: meetings list"
```

---

### Task 7: Pauta Assessor/Deputado — Option A

**Files:**
- Create: `client/src/components/PautaAssessor.jsx`
- Create: `client/src/__tests__/pautaAssessor.test.jsx`
- Modify: `client/src/App.jsx` (route `/reuniao/:id` by role), `client/src/hooks/useSocket.js`

**Interfaces:**
- Consumes: `GET /api/reuniao/:id`, socket `reuniao:` room, `official_status` field per item (`pendente|em_discussao|em_votacao|aprovado_relator|rejeitado_relator|aprovado_separado|vista|retirado`).
- Produces: vertical cards with top banner (color-coded: amarelo discussão, azul votação, verde aprovado, vermelho rejeitado, laranja vista), body (ordem/processo/ementa/autor/relator), footer private notes (`anotacoes_privadas` filtered by cabinetKey).

- [ ] **Step 1: Write failing test**

```jsx
test('item 1 PL 197/2019 shows EM VOTACAO banner and private note input', async () => {
  render(<PautaAssessor idReuniao="1000007671" />)
  await screen.findByText(/PL 197\/2019/)
  expect(screen.getByText(/EM VOTAÇÃO|EM DISCUSSÃO|APROVADO/i)).toBeTruthy()
  expect(screen.getByPlaceholderText(/orientação|observação/i)).toBeTruthy()
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test --workspace=client -- --run src/__tests__/pautaAssessor.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement PautaAssessor**

Fetch meeting + socket subscription for `official_status_changed` and `note_created` (scoped). Render Option A exactly as mocked. Note submit calls `POST /api/reuniao/:id/anotacao`.

- [ ] **Step 4: Run, expect PASS**

Run: `npm test --workspace=client -- --run src/__tests__/pautaAssessor.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PautaAssessor.jsx client/src/__tests__/pautaAssessor.test.jsx
git commit -m "feat: assessor pauta option A"
```

---

### Task 8: Pauta Secretário + Presentes

**Files:**
- Create: `client/src/components/PautaSecretario.jsx`, `client/src/components/PresentesTab.jsx`
- Create: `client/src/__tests__/pautaSecretario.test.jsx`
- Modify: `server/src/socket/meetingHandler.js` (status + presence confirm), `client/src/App.jsx`

**Interfaces:**
- Consumes: Buttons "Em discussão / Em votação / Aprovar / Rejeitar / Retirar / Vista" → `POST /api/reuniao/:id/status`; "Enviar para TV" → `active_item_changed`.
- Produces: `official_status` persists reversible until close; pending presence from Task 5 appears in `PresentesTab`, secretary confirms → `presence_confirmed` event.

- [ ] **Step 1: Write failing test**

```jsx
test('secretary can change status and sees pending presence', async () => {
  render(<PautaSecretario idReuniao="1000007671" />)
  await screen.findByText(/PL 197\/2019/)
  expect(screen.getByRole('button', {name:/Em discussão/i})).toBeTruthy()
  expect(screen.getByText(/Presentes/i)).toBeTruthy()
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test --workspace=client -- --run src/__tests__/pautaSecretario.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement PautaSecretario + PresentesTab**

Render item list with status buttons and active-item highlight. On presence pending, show name with "Confirmar" button. Persist status via API + socket emit.

- [ ] **Step 4: Run, expect PASS**

Run: `npm test --workspace=client -- --run src/__tests__/pautaSecretario.test.jsx`
Expected: PASS; backend test also proves status stays editable (edit after "aprovado" succeeds).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/PautaSecretario.jsx client/src/components/PresentesTab.jsx client/src/__tests__/pautaSecretario.test.jsx
git commit -m "feat: secretary pauta + presencas"
```

---

### Task 9: TV display (kiosk)

**Files:**
- Create: `client/src/components/TvDisplay.jsx`
- Create: `client/src/__tests__/tv.test.jsx`

**Interfaces:**
- Consumes: route `/tv/:id`, socket `reuniao:` room, `official_status` + `active_item`.
- Produces: fullscreen readonly card showing active item (PL 197/2019 etc.), status banner, and "Sincronizado agora". No edit controls.

- [ ] **Step 1: Write failing test**

```jsx
test('tv shows active item readonly', async () => {
  render(<TvDisplay idReuniao="1000007671" />)
  await screen.findByText(/INSTITUI O PROGRAMA/i)
  expect(screen.queryByRole('button', {name:/Aprovado/i})).toBeFalsy()
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test --workspace=client -- --run src/__tests__/tv.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement TvDisplay**

Kiosk layout (black bg, blue frame, yellow item pill), socket updates, auto-hide cursor. Idle splash when no active item.

- [ ] **Step 4: Run, expect PASS**

Run: `npm test --workspace=client -- --run src/__tests__/tv.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/TvDisplay.jsx client/src/__tests__/tv.test.jsx
git commit -m "feat: tv display"
```

---

### Task 10: Final PDF + persistence/history

**Files:**
- Create: `server/src/pdf/report.js`
- Create: `server/src/__tests__/pdf.test.js`
- Modify: `server/src/socket/meetingHandler.js` (close), `server/src/routes/meeting.js` (GET relatorio)
- Modify: `client/src/components/PautaSecretario.jsx` (Encerrar button)

**Interfaces:**
- Consumes: `official_status`, `presencas` (confirmed), `agenda_items` of the meeting. Produces: `GET /api/reuniao/:id/relatorio.pdf` streams PDF with header (nuReuniao, tipo, dt, local, commission), presenças confirmadas, items with final deliberations/vistas. Saves snapshot to `relatorio_final` + `sessions.encerrada_em`.

- [ ] **Step 1: Write failing test**

```js
// server/src/__tests__/pdf.test.js
test('pdf contains header + presencas + items', async () => {
  const res = await fetch('/api/reuniao/1000007671/relatorio.pdf')
  expect(res.headers.get('content-type')).toBe('application/pdf')
  const buf = Buffer.from(await res.arrayBuffer())
  expect(buf.slice(0,4).toString()).toBe('%PDF')
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test --workspace=server -- --run src/__tests__/pdf.test.js`
Expected: FAIL 404

- [ ] **Step 3: Implement PDF**

`report.js` uses `puppeteer` to render HTML template (header, presenças, tabela de itens) to PDF buffer. Close endpoint writes `official_status` snapshot + `relatorio_final` row; route serves generated file.

- [ ] **Step 4: Run, expect PASS**

Run: `npm test --workspace=server -- --run src/__tests__/pdf.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/pdf/ server/src/__tests__/pdf.test.js server/src/routes/meeting.js
git commit -m "feat: final pdf report"
```

---

### Task 11: Deploy + E2E smoke

**Files:**
- Create: `Procfile` or `Dockerfile`, `.env.example`, `README.md` (deploy section)
- Create: `client/src/__tests__/e2e.smoke.test.jsx` (Playwright optional)

**Interfaces:**
- Consumes: Tasks 1-10. Produces: production build `npm run build`, served static + API from Express, `GET /health` returns `{"ok":true}`.

- [ ] **Step 1: Write smoke test**

```js
// ops check
test('prod build exists', () => {
  expect(require('fs').existsSync('client/dist/index.html')).toBe(true)
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npm test --workspace=client -- --run src/__tests__/e2e.smoke.test.jsx`
Expected: FAIL until build run

- [ ] **Step 3: Implement deploy files**

Add `Procfile` (`web: node server/src/index.js`), production static serving from `client/dist`, `.env.example` (`PORT`, `LEGS_API_BASE_URL`, `DB_PATH`).

- [ ] **Step 4: Run smoke + build**

Run: `npm run build && npm test --workspace=client -- --run src/__tests__/e2e.smoke.test.jsx`
Expected: PASS, `client/dist/index.html` exists

- [ ] **Step 5: Commit**

```bash
git add Procfile .env.example README.md client/dist
git commit -m "feat: deploy config"
```

---

## Self-Review Notes

- Every spec section maps to a task (1 Goals→Tasks 5-10, 2 identification→5, 3 list→6, 4 pauta→7-8, 5 TV→9, 6 PDF/persistence→10, multi-room→4).
- Each step is one action with a command and expected output.
- Interfaces are consistent across tasks (AuthContext, socket rooms, REST paths).
- Spot-checked Review Focus: Legis nulls (Task 3), leak isolation (Task 4), privacy (Task 4), editable status/PDF snapshot (Task 8/10), presence dupe normalization (Task 8).
