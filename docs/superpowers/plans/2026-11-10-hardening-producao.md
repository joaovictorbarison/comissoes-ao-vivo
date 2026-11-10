# Comissões Ao Vivo 2 — Hardening para Produção Real (ALESP) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 16 approved adjustments (TV idle screen, 6s timer without auto-advance, symbolic report grouping, nominal tie → minerva vote, MAX_ROOMS 20, encerrar confirmation modal, quorum calculation, assessoria report status, save feedback, error/retry on meetings list, auth hardening, leak closure, accessibility) so the app is production-ready for the ALESP.

**Architecture:** Keep stack (React+Vite+Tailwind, Express+Socket.io, node:sqlite, PDFKit). Add signed session tokens (JWT) issued by `/auth/*` and validated by middleware on privileged routes; add `sessoes` state for encerrar/reabrir; keep TV as a state machine driven by socket events (no auto-advance except 6s result display); compute quorum server-side. Front-end gains idle TV screen, modal confirmations, error boundaries, and save-feedback ticks.

**Tech Stack:** React 18, Vite 5, Tailwind 3, Express 4, socket.io 4, node:sqlite, PDFKit, jsonwebtoken (new dep), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-comissoes-ao-vivo-2-design.md` + approved adjustments in conversation 2026-11-10 (items 1-16).

## Global Constraints

- Stack fixed: React+Vite+Tailwind (front), Node+Express+Socket.io (back), node:sqlite. One new dependency: `jsonwebtoken`.
- Secretary password `dac2027` (env `SECRETARIO_SENHA`), validated on backend, now issues a signed JWT (HS256, 8h) stored in sessionStorage; all privileged routes require `Authorization: Bearer <token>` or a valid session cookie.
- Parlamentar/Assessor identification uses type-ahead over `/api/legis/parlamentares-ativos` (94 ativos) — name is normalized and stored with `matricula` as the unique key; `cabinetKey` becomes `normalize(name) + ':' + matricula` to avoid homonyms.
- Up to **20** simultaneous meetings (`MAX_ROOMS=20`), enforced in `joinRoom` (reject beyond cap with 429-equivalent socket error).
- TV idle screen shows: "Assembleia Legislativa do Estado de São Paulo" + comissão (larger) + "1ª Reunião Ordinária" + "N itens em pauta" + pill "AGUARDANDO INÍCIO".
- TV timer: 6s only for terminal results (Aprovado/Rejeitado/Vista/Retirado); no auto-advance except after the 6s. Status changes to discussão/votação stay indefinitely. When `Outro >= 4` in nominal, TV stays on "Em votação" with no auto-advance.
- Quorum: presentes confirmados que são membros de partidos com vaga na comissão (1 voto por vaga; substitutos não votam se efetivo presente). Maioria de favorável > contrário → aprovado; contrário > favorável → rejeitado; empate → secretário decide via voto de minerva (2 botões). `Outro` não conta na soma.
- Simbólica report: lists **all** presentes (including sem-vaga) but separates "sem vaga na comissão" in its own line.
- Encerrar reunião: confirmation modal; on confirm, items without terminal status become "Não deliberado"; blocks further edits.
- Assessoria report: status "Orientações" when not encerrada, "Status: ..." when encerrada.
- Save feedback: ✔️ tick appears after successful save (anotação secretário e orientação assessor), resets on edit.
- Error/retry: meetings list shows error message + retry button on API failure.
- Accessibility: aria-labels, focus rings, ESC/backdrop close on modals.

## Review Focus

- **Auth bypass via direct API call** — a malicious user calls `POST /api/reuniao/:id/status` without token; must return 401. Pinned by Task 8 tests.
- **Private-note leak across gabinetes** — `GET /anotacoes` without valid cabinetKey must return `[]`, not all notes. Pinned by Task 9.
- **Vinculos global leak** — `GET /vinculos` requires deputadoKey or secretário token. Pinned by Task 9.
- **TV stuck after terminal** — after 6s result display, TV must remain on result (no auto-advance) until secretary changes status; pinned by Task 2.
- **Quorum with 4+ "Outro"** — secretário must decide; TV stays "Em votação"; pinned by Task 5.
- **Encerrar accidental** — modal must block; pinned by Task 6.
- **Simbólica report grouping** — all presentes listed, sem-vaga separated; pinned by Task 4.

---

## File Structure

```
server/src/
  auth.js                    # JWT sign/verify middleware (new)
  db.js                      # + tokens? no, JWT stateless
  routes/meeting.js          # auth middleware on mutations, leak fixes, quorum, minerva
  routes/legis.js            # ok as-is
  pdf/report.js              # simbólica grouping, assessoria status, votos nominais
client/src/
  context/AuthContext.jsx    # store token, send Authorization header
  components/Identificacao.jsx
  components/ListaReunioes.jsx  # error/retry
  components/PautaSecretario.jsx # simbólica aprovado/rejeitado, minerva, save tick, encerrar modal
  components/PautaAssessor.jsx  # save tick, vinculo bar
  components/TvDisplay.jsx      # idle screen, 6s timer, no auto-advance
  components/PresentesTab.jsx   # aria, compact
  App.jsx                      # VinculoBar, header
```

---

### Task 1: TV idle screen (initial state)

**Files:** Modify `client/src/components/TvDisplay.jsx`. Test: `client/src/__tests__/tv.test.jsx`.

- [ ] **Step 1: Write failing test** — render with empty items → shows "AGUARDANDO INÍCIO" pill and "N itens em pauta".
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement idle screen** — when no terminal and no em_votacao/em_discussao, show idle: ALESP header, comissão (larger), "1ª Reunião Ordinária" (from `tituloReuniao`), "N itens em pauta", pill "AGUARDANDO INÍCIO". Otherwise normal.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: TV idle screen`.

### Task 2: TV 6s timer without auto-advance

**Files:** Modify `client/src/components/TvDisplay.jsx`. Test update.

- [ ] **Step 1: Write failing test** — terminal item shows result for 6s then stays on result (no advance to next item).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — on terminal status, set `resultItemId`, start `setTimeout(6000)` that only clears `resultItemId` (does NOT change `currentId`). Advance to next item only when secretary changes status to em_discussao/em_votacao (socket event). Remove `forcedNext`.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: TV 6s without auto-advance`.

### Task 3: Simbólica report grouping (all presentes, sem-vaga separated)

**Files:** Modify `server/src/pdf/report.js` + `server/src/routes/meeting.js` (votacao-simbolica already saves grouped; ensure report reads new format). Test: `server/src/__tests__/pdf.test.js` (extend).

- [ ] **Step 1: Write failing test** — PDF text contains "Efetivos:" line and "Outros:" line.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — `normalizeSymbolic` already handles `{efetivos,substitutos,outros}`. Ensure `generatePdf` prints all three lines even when empty ("—"). Ensure simbólica saves grouped format (already in 9b07a71). Add `votacao_simbolica` row for the test meeting.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: simbólica report grouping`.

### Task 4: Votação nominal — minerva (empate) + quorum + 4+ Outro

**Files:** Modify `server/src/routes/meeting.js` (`votacao-nominal/finalizar`) + `client/src/components/PautaSecretario.jsx`. Test: `server/src/__tests__/votacao.test.js` (new).

- [ ] **Step 1: Write failing test** — finalizar com fav=contra e outro<4 returns `{needsMinerva:true}` (not auto-decide); with `decisaoManual='aprovado'` returns aprovado.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement backend** — compute quorum = presentes confirmados que são membros de partidos com vaga (1 por vaga, substitutos só se efetivo ausente). fav>contra → aprovado; contra>fav → rejeitado; fav===contra → `needsMinerva:true` (unless decisaoManual). outro>=4 → `needsManual:true` (existing). Store status only when decided.
- [ ] **Step 4: Implement front** — when `needsMinerva`, show "Empate — voto de minerva do presidente" with 2 botões (Aprovado/Rejeitado) that call finalizar with decisaoManual. TV stays "Em votação" until decided.
- [ ] **Step 5: Run tests, expect PASS.**
- [ ] **Step 6: Commit** `feat: nominal minerva + quorum`.

### Task 5: MAX_ROOMS 20

**Files:** Modify `server/src/socket/rooms.js`. Test: `server/src/__tests__/rooms.test.js` (extend).

- [ ] **Step 1: Write failing test** — 21st room join is rejected.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — `MAX_ROOMS=20`; `joinRoom` returns `{ok:false, error:'max_rooms'}` and does not join when at cap.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: MAX_ROOMS 20`.

### Task 6: Modal de confirmação ao encerrar

**Files:** Modify `client/src/components/PautaSecretario.jsx`. Test: `client/src/__tests__/pautaSecretario.test.jsx` (extend).

- [ ] **Step 1: Write failing test** — clicking "Encerrar reunião" opens modal; confirming calls `/encerrar`; canceling does not.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — `confirmEncerrar` state; modal with Cancelar/Encerrar; close on ESC and backdrop click.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: modal encerrar`.

### Task 7: Assessoria report status "Orientações" when not encerrada

**Files:** Modify `server/src/pdf/report.js` (`generateAssessoriaPdf`). Test extend.

- [ ] **Step 1: Write failing test** — PDF for non-encerrada meeting contains "Orientações" and does NOT contain "Status: pendente".
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — when `!encerrada`, print `Status: Orientações` (and the notes) instead of `Status: pendente`. Already partially there; fix statusTxt.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `fix: assessoria report status`.

### Task 8: Auth hardening (JWT)

**Files:** Create `server/src/auth.js`; modify `server/src/index.js`, `server/src/routes/meeting.js`, `client/src/context/AuthContext.jsx`, `client/src/components/Identificacao.jsx`. Test: `server/src/__tests__/auth.test.js` (new).

- [ ] **Step 1: Write failing test** — `POST /api/reuniao/1/status` without Authorization returns 401; with valid token returns 200.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement backend** — `auth.js`: `signToken(payload)` (HS256, 8h, secret from env `JWT_SECRET`), `requireAuth(req,res,next)` validates Bearer token and sets `req.user`. Apply middleware to all mutation routes in `meeting.js` (status, vista, presenca, iniciar/encerrar/reabrir/limpar, votacao-*, voto-nominal*, item-nota, vinculo aceitar/recusar/delete). `/auth/secretario` issues token with `{role:'secretario'}`.
- [ ] **Step 4: Implement frontend** — `AuthContext` stores token in sessionStorage, sends `Authorization: Bearer` on all fetches; `Identificacao` for secretário calls `/auth/secretario` and stores returned token. Parlamentar/Assessor get a lightweight token from a new `/auth/identificar` endpoint (name+profile, no password) — at least a signed session so mutations are attributable.
- [ ] **Step 5: Run tests, expect PASS.**
- [ ] **Step 6: Commit** `feat: JWT auth`.

### Task 9: Leak closure

**Files:** Modify `server/src/routes/meeting.js` (`GET /anotacoes`, `GET /vinculos`). Test: `server/src/__tests__/leak.test.js` (new).

- [ ] **Step 1: Write failing test** — `GET /api/reuniao/1/anotacoes` (no cabinetKey) returns `[]`; `GET /api/vinculos` (no deputadoKey, no token) returns 401/`[]`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — `/anotacoes` returns `[]` when no cabinetKey (already does when key missing? check: currently returns ALL when no key — fix to `[]`). `/vinculos` without deputadoKey requires secretário token; otherwise 401.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `fix: close leaks`.

### Task 10: Save feedback + error/retry + accessibility (visual decisions first)

**Before coding, present mockups for approval:**
- Save tick ✔️ on orientação do assessor (replicating secretário).
- Error message + retry button on meetings list.
- Aria-labels on ×/✓/✕ buttons.
- Modal close on ESC/backdrop.

- [ ] **Step 1 (design):** Show visual options for save tick, error/retry, aria. Get approval.
- [ ] **Step 2: Implement save tick** in `PautaAssessor.jsx` (✔️ after save, reset on edit). Test.
- [ ] **Step 3: Implement error/retry** in `ListaReunioes.jsx` (try/catch + retry button). Test.
- [ ] **Step 4: Implement aria-labels** on PresentesTab buttons and PautaSecretario buttons.
- [ ] **Step 5: Implement ESC/backdrop close** on modals (confirmClear, pendingAction, confirmDelete, confirmClearAll).
- [ ] **Step 6: Run all tests, expect PASS.**
- [ ] **Step 7: Commit** `feat: feedback + a11y`.

### Task 11: Visual design decisions (present before coding)

**Present to user for approval:**
- Status color palette (current: verde aprovado, vermelho rejeitado, laranja vista, cinza retirado, amarelo discussão, azul votação). Propose keeping but unifying across card/button/pill.
- TV layout: larger typography (48px title), remove opacity on author/relator, idle screen design.
- Presentes compact layout on mobile.

Get approval, then adjust Tailwind classes.

### Task 12: Deploy verification

- [ ] **Step 1:** Push to GitHub, redeploy Render, smoke-test `/health`, `/reunioes`, `/tv/:id`, PDF download.
- [ ] **Step 2:** Test with 2 simultaneous meetings (no leak).
- [ ] **Step 3:** Test encerrar/reabrir + não deliberado in report.
- [ ] **Step 4:** Commit `chore: production deploy verified`.

---

## Self-Review Notes

- Spec coverage: items 1-16 each map to tasks (1→1, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7, 8→4, 9→7, 10→11, 11→10, 12→10, 13→10, 14→8, 15→9, 16→10).
- Interfaces consistent: JWT token flows through AuthContext; `votacao-nominal/finalizar` returns `needsMinerva`/`needsManual`; simbólica saves grouped format already consumed by report.
- TV idle + 6s + no auto-advance changes TvDisplay state machine — test updates required.
- Auth middleware must not break existing tests that call routes without token — update tests to pass token or mark routes public where needed (e.g., GET /reunioes, /reuniao/:id, /tv).
