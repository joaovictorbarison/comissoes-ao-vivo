# Design — Comissões Ao Vivo 2 (Recomeço do zero)

**Data:** 2026-11-07  
**Status:** Rascunho para revisão — pendente de aprovação  
**Local novo:** `Comissões ao vivo 2/` (projeto separado, não mistura com "Projeto Comissões Ao Vivo")  
**Local deste design:** `docs/superpowers/specs/2026-11-07-comissoes-ao-vivo-2-design.md`

---

## 1. Intent e por quê

Recomeçar do zero o painel de reuniões de comissão da ALESP ("Comissões ao vivo") porque a versão anterior teve dificuldade nas telas. O novo projeto usa outro modelo de IA e uma estrutura de telas validada com dados reais da API do Legis.

Objetivo central: **eliminar o papel** durante a reunião, permitindo que secretário, assessores, deputados e TV do plenário vejam a mesma pauta, cada um com as permissões certas, em tempo real, com identidade visual moderna inspirada no site da ALESP.

---

## 2. Objetivos (goals)

- **Tela de identificação simples** (perfil + nome) como porta de entrada.
  - Perfis: Secretário de Comissão, Assessor Parlamentar, Deputado.
  - Secretário pede senha padrão `dac2027` (por enquanto, sem SSO Legis).
  - Futuro: biometria (WebAuthn/digital) no celular — não nesta versão.
- **Listagem de reuniões Convocadas** (status = Convocada) vinda da API pública do Legis, sem busca nem filtros.
  - Cada reunião exibe: número + tipo (Ordinária, Extraordinária, Especial, etc.), data e hora, local, assunto, comissões envolvidas, links para documentos (Comunicado e Pauta em PDF).
- **Pauta completa** por reunião escolhida:
  - Puxar **todos** os itens de pauta da API do Legis (sem limite de 10).
  - Cada item com: número do processo (ex. PL 197/2019), ementa completa, autor(es), status do Legis, voto do relator (conclusão), documentos de análise/voto.
- **Tela do Assessor/Deputado (Opção A aprovada)**
  - Faixa de status oficial no topo do cartão (ver seção 5).
  - Abaixo: ementa + autor/relator.
  - Área de **anotações privadas e orientações compartilhadas** entre assessor e deputado do mesmo gabinete (texto livre, ex.: "pedir vista", "votar sim").
  - Exibe também, ao vivo, o status inserido pelo secretário (em discussão, em votação, aprovado voto do relator, rejeitado voto do relator, aprovado voto em separado, vista solicitada, etc.).
- **Tela do Secretário**
  - Controle oficial: definir o que realmente aconteceu por item (aprovado/rejeitado voto do relator, aprovado voto em separado, vista, retirado, em discussão, em votação, etc.).
  - Controla o **item ativo** empurrado para a TV do plenário.
  - Registro de **presenças**: quando um Deputado/Assessor entra na reunião com nome, o nome aparece na aba **Presentes** do secretário; o secretário confirma presença.
  - Ao encerrar, gera **relatório final em PDF** completo para transcrição no Legis.
  - **Sessão permanece salva no banco de dados** para consultas posteriores após o encerramento.
- **TV do Plenário**
  - Tela cheia (kiosk), somente leitura, espelha apenas o item ativo e decisões do secretário.
- **Design responsivo**
  - Desktop (secretário), celular/tablet (assessor/deputado), TV 16:9.
- **Zero papel, sem instalação** — PWA acessada por navegador.
- **Multi-reunião simultânea sem mistura de dados** — até **10 reuniões simultâneas**, cada uma com seus secretários, assessores, deputados, TV e presenças isolados por sala.

---

## 3. Não-objetivos (non-goals)

- Integração automática de gravação no banco do Legis (relatório é em PDF para transcrição manual).
- App nativo (iOS/Android) ou app de TV dedicado.
- SSO / login oficial do Legis nesta versão (apenas perfil+nome+senha do secretário).
- Biometria nesta versão (apenas prevista como evolução).
- Busca e filtros avançados na listagem de reuniões.
- Funcionamento offline.
- Áudio/vídeo da reunião.

---

## 4. Anti-goals (falha mesmo que funcione tecnicamente)

- A listagem de convocadas exibe só 10 itens ou mistura reuniões de status diferente.
- Informações de uma reunião vazam para outra reunião simultânea (status, presenças, anotações).
- O assessor/deputado não vê o status decidido pelo secretário, ou vê decisão desatualizada.
- Anotação privada assessor↔deputado vaza para secretário ou outro gabinete.
- O secretário não consegue registrar aprovado/rejeitado/vista/retirado por item.
- A TV mostra item errado ou desatualizado.
- O relatório PDF não contém presenças, vistas e deliberações suficientes para o Legis.
- O parlamentar que entrou não aparece na aba Presentes do secretário.
- Exigir instalação de app em qualquer dispositivo.

---

## 5. Restrições e decisões validadas

- **Stack (Abordagem 1 aprovada):** React + Vite + Tailwind CSS (front), Node.js + Express + Socket.io (back), SQLite. Recomeço limpo, sem reaproveitar código da v1 além de padrões validados.
- **Tempo real e isolamento multi-reunião:** Socket.io com **salas (rooms) por `idReuniao` do Legis** — cada reunião é uma sala isolada, dimensionada para até **10 reuniões simultâneas**. Status oficial secretário → TV + assessores/deputados **daquela sala**; entrada de parlamentar → aba Presentes **daquela sala**; anotações privadas → apenas assessor e deputado do gabinete **naquela reunião**. Nenhum evento cruza entre salas.
- **Identificação:**
  - Telas: escolha de perfil + campo nome; secretário solicita senha `dac2027`.
  - Identidade de gabinete (decisão do construtor para o MVP): texto livre normalizado — nome do deputado vinculado + nome do assessor, sem roster oficial. Chave de privacidade será o par normalizado (lowercase, sem acentos) + `idReuniao`. Plausível para MVP; roster oficial pode entrar depois.
  - Presença: ao finalizar identificação, o usuário entra na reunião e o nome aparece em `Presentes` **daquela reunião**; o secretário confirma. Sem biometria agora.
- **Lista de reuniões:**
  - Fonte: `GET https://legis-api-portal-prd.al.sp.gov.br/colegiado/reunioes?size=50` (ou conforme paginação da API).
  - Filtrar `status.txNome = "Convocada"` no backend ou front.
  - Campos por cartão: `nuReuniao`, `tipoConvocacao`/`tituloReuniao`, `dtReuniao`, `local.txNome`, `txAssunto`, `colegiadosRelacionados[]` (nome+sigla), `documentosReuniao[]` (Comunicado / Pauta com `linkArquivoPDF`).
  - Sem campo de busca/filtro na UI.
- **Pauta:**
  - Fonte: `GET /colegiado/reuniao/:idReuniao/pauta`.
  - Carregar **todos** os itens (`content` array completo).
  - Campos por item: `nuOrdem`, `processoDadosView.txDescricao` (ex. PL 197/2019), `txEmenta`, `txNomeAutores`, `status.txNome`, `documentosVoto[]` (autores, conclusão, dt).
- **Pauta Assessor/Deputado — Opção A:**
  - Cada item é um cartão vertical:
    1. Faixa oficial no topo: "EM DISCUSSÃO", "EM VOTAÇÃO", "APROVADO VOTO DO RELATOR", "REJEITADO VOTO DO RELATOR", "APROVADO VOTO EM SEPARADO", "VISTA SOLICITADA", "RETIRADO", "PENDENTE", conforme status do secretário (com cores distintas para discussão vs votação: amarelo = discussão, azul = votação, verde = aprovado, vermelho = rejeitado, laranja = vista).
    2. Corpo: ordem, número do processo, ementa, autor, relator + conclusão.
    3. Rodapé privado: lista de notas do gabinete + campo "Nova orientação/observação…" + botão salvar, com ícone 🔒 e aviso de privacidade.
  - Assessor escreve; Deputado lê e pode responder; ambos no mesmo cartão.
  - Ambos veem status oficial ao vivo no topo.
- **Pauta Secretário:**
  - Lista completa; cada item com ações: "Definir como em discussão / em votação (envia para TV)", "Aprovado", "Rejeitado", "Vista", "Retirado", "Pausar/Avançar".
  - **Máquina de estados:** `pendente → em_discussao → em_votacao → aprovado_relator / rejeitado_relator / aprovado_separado / vista / retirado`. "Em discussão" e "Em votação" são estados distintos. "Pausar/Avançar" é uma ação que muda `item_ativo`, não um status. Nenhum status final é irreversível — todos editáveis a qualquer momento para correção até o encerramento.
  - Barra de presença, contadores e registro de vistas.
  - Botão "Encerrar e gerar PDF final".
- **TV Plenário:**
  - Em fullscreen, exibe item ativo e último status do secretário **daquela reunião**; botão oculto de refresh; sem edição. Cada TV entra na sala da sua reunião (seleção por reunião ou por plenário).
- **Relatório final em PDF (estrutura aprovada pelo parceiro):**
  - **Cabeçalho:** número, tipo, data, hora, plenário/local, comissão(s).
  - **Presenças confirmadas:** lista de parlamentares/assessores confirmados pelo secretário.
  - **Itens da pauta:** listagem com número do processo, ementa e registro da deliberação (aprovado/rejeitado voto do relator, aprovado voto em separado, vista, retirado, etc.) e vistas solicitadas.
  - Gerado pelo backend (puppeteer ou similar) ao encerrar, a partir do estado final editável. Download/share.
- **Persistência pós-encerramento:** sessão permanece salva no SQLite para consultas posteriores (histórico). PDF é snapshot do estado final no momento do encerramento.
- **Identidade visual:** moderna, inspirada no site da ALESP — azul institucional (#0b2f6a/#1e4db7), branco, amarelo de destaque, cartões arredondados, tipografia legível. Mockups validados em `fluxo-completo-v1.html` e `pauta-opcoes-v1.html` (Opção A) — arquivos atuais no projeto antigo em `.superpowers/brainstorm/`; cópias serão incluídas no repo novo na etapa de plano como referência visual.

---

## 6. Abordagens consideradas

| Abordagem | Resumo | Trade-offs | Decisão |
|-----------|--------|------------|---------|
| **1 — PWA única (escolhida)** | React+Vite+Tailwind, Node+Express+Socket.io, SQLite, deploy único | Menor complexidade, realtime simples, PDF fácil, usa padrões já validados | **Escolhida** (aprovada pelo parceiro em 2026-11-07) |
| 2 — Next.js full-stack | Next.js + Prisma + Postgres + WS separado | Realtime extra, overkill | Descartada |
| 3 — SPA + gerenciados (Supabase) | Front direto + Supabase Realtime | Ainda precisa backend para proxy Legis e persistência; custo | Descartada |

---

## 7. Modelo de dados (resumo)

| Tabela | Finalidade | Quem vê |
|--------|-----------|---------|
| `sessions` | Reunião Legis cacheada (idLegis, tipo, data, local, assunto, status, `encerrada_em`) | Todos |
| `agenda_items` | Itens de pauta Legis (ordem, processo, ementa, autor, relator, conclusão) | Todos |
| `official_status` | Status decidido pelo secretário por item (pendente, em_discussao, em_votacao, aprovado_relator, rejeitado_relator, aprovado_separado, vista, retirado) + `item_ativo` da TV, todos por `idReuniao` | Todos da reunião |
| `presencas` | Entradas de parlamentar/assessor + confirmação do secretário | Secretário (lista) |
| `anotacoes_privadas` | Notas assessor↔deputado por item, escopo por gabinete + `idReuniao` | Apenas par assessor↔deputado |
| `relatorio_final` | Snapshot para PDF ao encerrar (JSON + caminho do PDF) | Secretário (download + histórico) |

Cacheia dados do Legis na abertura da reunião para não depender da API a cada refresh.

---

## 8. Fluxo

1. Usuário abre link → **Tela 1 Identificação** (perfil+nome; secretário senha `dac2027`).
2. → **Tela 2 Convocadas** (lista completa, sem filtro).
3. Escolhe reunião → backend busca e salva pauta completa do Legis.
4. → **Tela 3** na sala daquela `idReuniao` (Secretário vê controle oficial; Assessor/Deputado veem Opção A).
5. Deputado/Assessor entra → nome aparece na aba **Presentes** do secretário → secretário confirma.
6. Secretário define item ativo e status (discussão vs votação) → Socket.io emite **apenas na sala daquela reunião** para TV e assessores/deputados.
7. Assessor/deputado anotam privadamente durante todo o fluxo (pré e ao vivo).
8. Secretário edita livremente até o fim → encerra → gera PDF final (cabeçalho + presenças + itens/deliberações/vistas).
9. Sessão permanece salva no banco para consultas posteriores. Novas reuniões simultâneas usam outras salas, sem mistura.

---

## 9. O que fica a cargo do construtor

- Escolha exata de libs (Router, testes, linter).
- Paginação/tratamento de erro da API do Legis.
- Implementação do PDF (puppeteer, pdf-lib, etc.) conforme estrutura aprovada acima.
- Mecanismo exato de vínculo gabinete (texto livre normalizado + `idReuniao`) — decisão tomada acima; roster oficial é evolução futura.
- Validação da senha do secretário (`dac2027`) — hash simples no backend, não apenas no front.
- Rooms Socket.io por `idReuniao`, guarda contra vazamento entre salas, seleção de sala para TV.
- Layout de TV em kiosk, splash idle, modo offline gracioso.

---

## 10. Próximo passo

Após aprovação deste design doc, invoco a skill **writing-plans** e crio o projeto novo `Comissões ao vivo 2` (scaffold limpo, sem misturar com v1).
