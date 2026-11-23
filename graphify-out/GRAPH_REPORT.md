# Graph Report - Comissões ao vivo 2  (2026-11-23)

## Corpus Check
- Corpus is ~36,189 words - fits in a single context window. You may not need a graph.

## Summary
- 414 nodes · 761 edges · 63 communities (14 shown, 49 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Public Accompaniment Page
- App Shell & Routes
- Auth Crypto Helpers
- Node Builtin Refs
- Public PDF Reports
- Client Dev Dependencies
- Server Runtime Libraries
- Client React Dependencies
- Anonymous & TV Profiles
- Root Dev Dependencies
- Product Vision & Requirements
- Logo Assets
- React Vite Template
- Identification & Gabinete
- Monorepo Architecture
- Final PDF Report
- Presence Workflow
- Multi-Meeting Isolation
- Agenda Item States
- TV Plenário Display
- TV Result Timing
- Collapse & Presence Plans
- HTML Entry Point
- React Logo Asset
- Full Stack Blueprint
- Legis API Proxy
- Meeting Cards
- Assessor Pauta View
- Pauta Data Sync
- Private Notes Scope
- REST API Surface
- Socket.io Events
- Tech Stack
- Voto Separado Removal
- Secretário Item Metadata
- Proposal Links
- Sem Papel Links
- Secretary Card Header
- Presence & Vista Rules
- Accessibility Fixes
- Advisor Report Status
- JWT Authentication
- Meeting Closure Flow
- Meeting List Retry
- Leak Closures
- MAX_ROOMS Limit
- Quorum Calculation
- Save Feedback
- Symbolic Report
- TV Idle State
- Votação Nominal Finish
- Minerva Tie Handling
- Anti-Goals
- Assessor Role
- Deputado Role
- Legis Meeting Listing
- Meeting Card Fields
- Non-Goals
- Post-Close Persistence
- Secretário Role

## God Nodes (most connected - your core abstractions)
1. `react-router-dom` - 23 edges
2. `react` - 21 edges
3. `useAuth()` - 21 edges
4. `useSocket()` - 19 edges
5. `@testing-library/react` - 15 edges
6. `Acompanhamento()` - 14 edges
7. `PautaAssessor()` - 14 edges
8. `PautaSecretario()` - 14 edges
9. `AuthProvider()` - 14 edges
10. `TvDisplay()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Comissões Ao Vivo 2` --references--> `Comissões Ao Vivo 2 — PWA (React+Vite+Tailwind / Node+Express+Socket.io / SQLite): lista reuniões Legis 'Convocada', pauta completa, vista privada assessor/deputado, console secretário com TV mirror, até 10 reuniões simultâneas isoladas`  [EXTRACTED]
  README.md → docs/superpowers/plans/2026-11-07-comissoes-ao-vivo-2.md
- `Comissões Ao Vivo 2` --references--> `Intent: eliminar o papel durante a reunião — painel de reuniões de comissão da ALESP para secretário, assessores, deputados e TV do plenário, em tempo real, identidade visual moderna inspirada no site da ALESP`  [EXTRACTED]
  README.md → docs/superpowers/specs/2026-11-07-comissoes-ao-vivo-2-design.md
- `TV: resultado (APROVADO/REJEITADO/VISTA: <nomes>/RETIRADO) por 8s, depois avança para próximo nuOrdem, depois volta a em_votacao > em_discussao > primeiro` --semantically_similar_to--> `TV timer: 6s apenas em resultados terminais; on terminal, set resultItemId + start setTimeout(6000) que só limpa resultItemId (não muda currentId); avança só quando secretário muda status para em_discussao/em_votacao; elimina forcedNext`  [INFERRED] [semantically similar]
  docs/superpowers/plans/2026-11-08-ajustes-7.md → docs/superpowers/plans/2026-11-10-hardening-producao.md
- `buildPublicReportData` --shares_data_with--> `Dados públicos disponíveis no banco`  [INFERRED]
  docs/superpowers/plans/2026-11-23-acompanhamento-anonimo-tv.md → docs/superpowers/specs/2026-11-23-acompanhamento-anonimo-tv-design.md
- `Nenhuma exposição de notas privadas no caminho anônimo` --semantically_similar_to--> `Exclusão de dados privados do relatório público`  [INFERRED] [semantically similar]
  docs/superpowers/plans/2026-11-23-acompanhamento-anonimo-tv.md → docs/superpowers/specs/2026-11-23-acompanhamento-anonimo-tv-design.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Comissões Ao Vivo 2 MVP: PWA sem papel, painel de reuniões da ALESP, pauta completa, roles secretário/assessor/deputado, TV e relatórios final** — docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_goal, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_architecture, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_tech_stack, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_file_structure, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_pauta, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_opcao_a, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_pdf_final, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_private_notes, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_sala_isolation, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_presencas, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_tv_plenario, docs_superpowers_plans_2026_11_07_comissoes_ao_vivo_2_status_machine [EXTRACTED 1.00]
- **7 approved adjustments to Comissões Ao Vivo 2: hyphen do header secretário, autoria/relator/conclusão, links Sem Papel e voto, presença/vista deputados, gabinete vinculado, TV 8s, remoção do voto separado** — docs_superpowers_plans_2026_11_08_ajustes_7_goal, docs_superpowers_plans_2026_11_08_ajustes_7_pl_header_hyphen, docs_superpowers_plans_2026_11_08_ajustes_7_autoria_secretario, docs_superpowers_plans_2026_11_08_ajustes_7_links_sem_papel, docs_superpowers_plans_2026_11_08_ajustes_7_link_voto, docs_superpowers_plans_2026_11_08_ajustes_7_presenca_deputados, docs_superpowers_plans_2026_11_08_ajustes_7_gabinete_vinculado, docs_superpowers_plans_2026_11_08_ajustes_7_tv_8s_result, docs_superpowers_plans_2026_11_08_ajustes_7_aprovado_separado_removido [EXTRACTED 1.00]
- **16 approved production-hardening adjustments for ALESP: TV idle/6s sem auto-advance, simbólica grouping, voto nominal→minerva, MAX_ROOMS 20, encerrar modal, quorum, assessoria report, save feedback, error/retry, JWT auth, leak closure, accessibility** — docs_superpowers_plans_2026_11_10_hardening_producao_goal, docs_superpowers_plans_2026_11_10_hardening_producao_tv_idle_screen, docs_superpowers_plans_2026_11_10_hardening_producao_tv_6s_timer, docs_superpowers_plans_2026_11_10_hardening_producao_simbolica_report_grouping, docs_superpowers_plans_2026_11_10_hardening_producao_votacao_nominal_minerva, docs_superpowers_plans_2026_11_10_hardening_producao_votacao_nominal_finalizar, docs_superpowers_plans_2026_11_10_hardening_producao_quorum_calculo, docs_superpowers_plans_2026_11_10_hardening_producao_max_rooms_20, docs_superpowers_plans_2026_11_10_hardening_producao_encerrar_modal, docs_superpowers_plans_2026_11_10_hardening_producao_assessoria_report_status, docs_superpowers_plans_2026_11_10_hardening_producao_save_feedback_tick, docs_superpowers_plans_2026_11_10_hardening_producao_erro_retry_reuniaes, docs_superpowers_plans_2026_11_10_hardening_producao_auth_jwt, docs_superpowers_plans_2026_11_10_hardening_producao_leak_closure, docs_superpowers_plans_2026_11_10_hardening_producao_acessibilidade [EXTRACTED 1.00]
- **Pipeline do relatório público no servidor** — docs_superpowers_plans_2026_11_23_acompanhamento_anonimo_tv_relatorio_publico_pdf_route, docs_superpowers_plans_2026_11_23_acompanhamento_anonimo_tv_generate_publico_pdf, docs_superpowers_plans_2026_11_23_acompanhamento_anonimo_tv_build_public_report_data, docs_superpowers_plans_2026_11_23_acompanhamento_anonimo_tv_status_texto_publico [EXTRACTED 1.00]
- **Mecanismo compartilhado de collapse de itens** — docs_superpowers_plans_2026_11_23_collapse_presencas_anonimo_item_collapse_js, docs_superpowers_plans_2026_11_23_collapse_presencas_anonimo_terminal_final, docs_superpowers_plans_2026_11_23_collapse_presencas_anonimo_is_terminal_status, docs_superpowers_plans_2026_11_23_collapse_presencas_anonimo_use_open_items, docs_superpowers_plans_2026_11_23_collapse_presencas_anonimo_compact_item_row [EXTRACTED 1.00]
- **Abordagens escolhidas no design de acompanhamento anônimo e TV** — docs_superpowers_specs_2026_11_23_acompanhamento_anonimo_tv_design_local_anonimo_approach, docs_superpowers_specs_2026_11_23_acompanhamento_anonimo_tv_design_dedicated_acompanhamento_approach, docs_superpowers_specs_2026_11_23_acompanhamento_anonimo_tv_design_dedicated_public_report_approach, docs_superpowers_specs_2026_11_23_acompanhamento_anonimo_tv_design_tv_outside_layout_approach [EXTRACTED 1.00]

## Communities (63 total, 49 thin omitted)

### Community 0 - "Public Accompaniment Page"
Cohesion: 0.09
Nodes (39): Acompanhamento(), cardTone(), formatDataBR(), STATUS_COLOR, STATUS_LABEL, AssessoresTab(), cardTone(), PautaAssessor() (+31 more)

### Community 1 - "App Shell & Routes"
Cohesion: 0.13
Nodes (25): App(), AppRoutes(), AuthExpiredHandler(), Header(), Layout(), PautaRouter(), VinculoBar(), Identificacao() (+17 more)

### Community 2 - "Auth Crypto Helpers"
Cohesion: 0.10
Nodes (32): base64url(), crypto, requireAuth(), signToken(), verifyToken(), getDb(), _cache, fetch (+24 more)

### Community 3 - "Node Builtin Refs"
Cohesion: 0.08
Nodes (26): supertest, { DatabaseSync }, fs, initDb(), path, resolveDbPath(), cors, createApp() (+18 more)

### Community 4 - "Public PDF Reports"
Cohesion: 0.06
Nodes (27): Acompanhamento.jsx — página pública somente leitura, buildPublicReportData, generatePublicoPdf, Acompanhamento anônimo + TV full-screen com QR — Implementation Plan, Aviso de provisoriedade do relatório público, publicReport.test.js — teste do relatório público no servidor, Rota pública GET /api/reuniao/:id/relatorio-publico.pdf, statusTextoPublico (+19 more)

### Community 5 - "Client Dev Dependencies"
Cohesion: 0.09
Nodes (27): devDependencies, autoprefixer@^10.4.20, jsdom@^24.1.0, postcss@^8.4.47, tailwindcss@^3.4.13, @testing-library/jest-dom@^6.4.8, @testing-library/react@^16.0.0, vite@^5.4.10 (+19 more)

### Community 6 - "Server Runtime Libraries"
Cohesion: 0.09
Nodes (28): cors, express, node-fetch, pdfkit, puppeteer, socket.io, dependencies, cors@^2.8.5 (+20 more)

### Community 7 - "Client React Dependencies"
Cohesion: 0.14
Nodes (18): dependencies, qrcode@^1.5.4, react@^18.3.1, react-dom@^18.3.1, react-router-dom@^6.26.0, socket.io-client@^4.7.5, socket.io-client, Card() (+10 more)

### Community 8 - "Anonymous & TV Profiles"
Cohesion: 0.13
Nodes (7): Perfil local anonimo (sem token de backend), Botão Acompanhar sem identificação, Layout (App.jsx) — sem chrome em /tv/, PautaRouter — roteamento por perfil em /reuniao/:id, TvDisplay.jsx — shell full-screen da TV, TvQrBadge.jsx — QR da TV, Header enxuto para visualizador público

### Community 9 - "Root Dev Dependencies"
Cohesion: 0.15
Nodes (13): devDependencies, concurrently@^8.2.0, engines, node, name, private, scripts, build (+5 more)

### Community 11 - "Product Vision & Requirements"
Cohesion: 0.53
Nodes (6): Comissões Ao Vivo 2 — PWA (React+Vite+Tailwind / Node+Express+Socket.io / SQLite): lista reuniões Legis 'Convocada', pauta completa, vista privada assessor/deputado, console secretário com TV mirror, até 10 reuniões simultâneas isoladas, Ajustes 7: implementar os 7 ajustes aprovados ao Comissões Ao Vivo 2: header do cartão secretário com hífen, secretário mostra autoria/relator/conclusão, links de proposição (Sem Papel/Legis), remoção do botão 'Aprovado voto em separado', presença/vista filtradas a deputados, gabinete per deputy com pendente/aceito, TV com resultado de 8s e avanço para próximo nuOrdem, Hardening: 16 ajustes para produção real (ALESP): TV idle com splash 'AGUARDANDO INÍCIO'; timer de 6s só para resultados terminais (sem auto-advance); grouping simbólica da simbólica report; voto nominal → empate vira voto de minerva (2 botões); MAX_ROOMS 20; modal de confirmação do encerrar; cálculo de quorum; status 'Orientações'/'Status:' do relatório de assessoria; ✔️ tick de save; erro+retry na lista de reuniões; autenticação JWT (HS256, 8h); fechamento de leaks; acessibilidade (aria, ESC/backdrop), Objetivos: tela de identificação simples (perfil + nome; secretário senha dac2027); listagem de reuniões Convocadas (status = 'Convocada'); pauta completa (sem limite de 10); tela Assessor/Deputado (Opção A); tela Secretário; TV do Plenário; design responsivo, Intent: eliminar o papel durante a reunião — painel de reuniões de comissão da ALESP para secretário, assessores, deputados e TV do plenário, em tempo real, identidade visual moderna inspirada no site da ALESP, Comissões Ao Vivo 2

### Community 12 - "Logo Assets"
Cohesion: 0.40
Nodes (5): Cyan (#41D1FF) to purple (#BD34FE) gradient, Orange (#FFEA83) to yellow (#FFDD35) to orange (#FFA800) gradient, Main logo shape, Upper logo shape, Vite logo SVG

### Community 13 - "React Vite Template"
Cohesion: 0.67
Nodes (3): React + Vite template, @vitejs/plugin-react, @vitejs/plugin-swc

### Community 14 - "Identification & Gabinete"
Cohesion: 0.67
Nodes (3): Identificação: perfil (Secretário/Assessor/Deputado) + nome; senha dac2027 do secretário validada no backend; cabinetKey = normalize(nome) (lowercase, sem acentos), Gabinete per deputy: cabinetKey = normalize(deputado); POST /vinculo + /vinculo/:id/aceitar; deputy vê banner Aceitar/Recusar; notas privadas só após aceite, Chave de privacidade do gabinete (evolução: par normalizado + idReuniao, posteriormente normalize(deputado)+':'+matricula)

## Knowledge Gaps
- **70 isolated node(s):** `@vitejs/plugin-react`, `@vitejs/plugin-swc`, `Comissões Ao Vivo 2 (title, #root, entry /src/main.jsx)`, `Monorepo: server/ (Express + Socket.io + SQLite) e client/ (Vite + React + Tailwind); backend proxia Legis, cacheia reuniões/pautas no SQLite, isolamento do realtime em salas keyadas por idReuniao; frontend role-based após identificação (perfil + nome; senha dac2027), 4 grupos de rotas`, `React 18, Vite 5, Tailwind CSS 3, Node.js >=18, Express 4, Socket.io 4, better-sqlite3, puppeteer (PDF), Vitest + Playwright (tests), npm workspaces (root + client + server)` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 159 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-router-dom` connect `App Shell & Routes` to `Public Accompaniment Page`, `Client Dev Dependencies`, `Client React Dependencies`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `@vitejs/plugin-react`, `@vitejs/plugin-swc`, `Comissões Ao Vivo 2 (title, #root, entry /src/main.jsx)` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Public Accompaniment Page` be split into smaller, more focused modules?**
  _Cohesion score 0.09480519480519481 - nodes in this community are weakly interconnected._
- **Why does `@testing-library/react` connect `App Shell & Routes` to `Public Accompaniment Page`, `Client Dev Dependencies`, `Client React Dependencies`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `App Shell & Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.12657004830917876 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Public Accompaniment Page` to `App Shell & Routes`, `Client Dev Dependencies`, `Client React Dependencies`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `Auth Crypto Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.10409745293466224 - nodes in this community are weakly interconnected._