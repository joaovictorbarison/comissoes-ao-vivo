# Collapse de itens finalizados + painel de presenças no anônimo — Design (curto)

**Data:** 2026-11-23
**Base:** `b59909a` (main, já com acompanhamento anônimo + TV/QR)
**Tamanho:** mudança pequena (sem builder check)
**Status:** aguardando aprovação

## Intenção / porquê

Dar às telas de leitura (deputado, assessor e cidadão anônimo) o mesmo foco que o secretário já tem: itens finalizados recolhidos para destacar o que está em andamento. E dar ao cidadão, na tela anônima, visibilidade de quem está presente na reunião (elenco da comissão + outros parlamentares), sem qualquer poder de escrita.

## Objetivos

1. **Header anônimo enxuto:** para `profile==='anonimo'`, não exibir os botões "Ver TV" e "Identificação" na barra superior.
2. **Collapse de itens finalizados** nas telas `PautaAssessor` (deputado e assessor) e `Acompanhamento` (anônimo), idêntico ao do secretário.
3. **Painel de presenças somente-leitura e recolhível** na tela `Acompanhamento` (anônimo), mostrando o elenco da comissão (efetivos + substitutos, com partido) com marcação de presença, e outros parlamentares presentes (não-membros).

## Não-objetivos

- Alterar a tela do secretário ou o `PresentesTab` interativo.
- Dar ao anônimo qualquer ação de escrita (confirmar/excluir/incluir presença, notas, vínculo).
- Mudar o relatório público, a TV ou o roteamento por perfil.
- Novo endpoint ou mudança de schema.

## Anti-objetivos (falha mesmo se "funcionar")

- Anônimo ainda vendo "Ver TV"/"Identificação", ou ganhando botões de escrita no painel de presenças.
- Collapse diferente do secretário (ex.: recolher só aprovados, ou recolher `nao_deliberado`).
- Painel de presenças expondo ações autenticadas ou usando `authFetch` no caminho anônimo.
- Itens em discussão/votação/pendentes recolhidos por padrão.

## Fatos do projeto (reconhecimento)

- `PautaSecretario.jsx`: `TERMINAL_FINAL = ['aprovado_relator','aprovado_simbolico','aprovado_nominal','rejeitado_relator','rejeitado_simbolico','rejeitado_nominal','vista','retirado']`; `STATUS_SHORT` (Aprovado/Rejeitado/Vista/Retirado); `isTerminalStatus`; `openItems` (Set) + `toggleItem`. Item finalizado recolhido = linha compacta `Item N — descrição [SHORT] ▼`; expandido = card completo com cabeçalho clicável para recolher. Não-finalizado sempre aberto. `nao_deliberado` e `aprovado_separado` NÃO recolhem.
- `App.jsx` Header: botões "Ver TV" (se `tvId`), "Reuniões", "Identificação", "Solicitar vínculo" (assessor).
- Endpoint **público** `GET /api/reuniao/:id/presencas` → `[{id,name,profile,confirmed,origem}]`.
- `PresentesTab.jsx` (secretário): busca membros via `/api/legis/colegiados/:id/membros` e partidos via `/api/legis/parlamentares-ativos` (ambos públicos); separa efetivos/substitutos/outros-presentes; usa `authFetch` e ações de escrita.
- `Acompanhamento.jsx` e `PautaAssessor.jsx` hoje listam todos os itens abertos, sem collapse.

## Abordagens (um caminho sensato por item)

1. **Header:** renderização condicional por perfil. Sem alternativa relevante.
2. **Collapse:** extrair helper compartilhado (`TERMINAL_FINAL`, `STATUS_SHORT`, `isTerminalStatus`, hook/estado `openItems`+`toggleItem`) para `client/src/lib/` e reutilizar o padrão de linha compacta nos dois componentes. Alternativa descartada: duplicar a lógica inline em cada tela (DRY). O comportamento reproduz exatamente o secretário.
3. **Painel de presenças:** componente novo somente-leitura `PresencasPublicas.jsx`, com `fetch` público de `/presencas` + membros + partidos, reproduzindo a estrutura visual efetivos/substitutos/outros-presentes do `PresentesTab`, sem ações. Alternativa descartada: prop `readOnly` no `PresentesTab` (acoplaria escrita/leitura e arriscaria vazar ações ao cidadão).

## Decisões

- **Usuário:** painel mostra todos os deputados membros (efetivos e substitutos) com partido, deixando claro quem está presente; e outros parlamentares presentes (não-membros).
- **Builder (minha chamada):** "presente" = presença **confirmada** (`confirmed=1`), verde ✓; demais membros neutros. Consistente com o relatório público. Pendentes não-confirmados não são marcados como presentes.
- **Builder:** painel no topo da página anônima, aberto por padrão, recolhível (cabeçalho "Presenças ▼/▶" com contagem de presentes).
- **Builder:** manter o botão "Reuniões" no header anônimo (só "Ver TV" e "Identificação" saem).
- **Builder:** collapse reproduz `TERMINAL_FINAL` exato do secretário (não só aprovados).
- **Builder:** "Outros presentes" = não-membros com presença confirmada, nome + partido (via portal).

## Deixado ao builder

- Nomes exatos de arquivo/função do helper compartilhado e do componente.
- Classes Tailwind específicas da linha compacta e do painel (seguir o estilo existente).
- Contagem/formato do cabeçalho do painel.

## Arquivos afetados

- `client/src/lib/itemCollapse.js` (novo helper compartilhado) — ou nome equivalente.
- `client/src/App.jsx` (header condicional para anonimo).
- `client/src/components/PautaAssessor.jsx` (collapse).
- `client/src/components/Acompanhamento.jsx` (collapse + painel de presenças).
- `client/src/components/PresencasPublicas.jsx` (novo, somente-leitura).
- Testes novos/atualizados em `client/src/__tests__/`.

## Testes (TDD)

- Header: perfil `anonimo` não renderiza "Ver TV" nem "Identificação"; mantém "Reuniões"; deputado/assessor/secretário inalterados.
- Collapse (PautaAssessor e Acompanhamento): item finalizado aparece recolhido (linha compacta) e expande ao clicar; item `em_votacao`/`pendente` sempre aberto; `nao_deliberado` não recolhe.
- PresencasPublicas: lista efetivos/substitutos com partido e marca confirmados como presentes; mostra outros parlamentares presentes; **não** renderiza botões Confirmar/Excluir/Incluir; usa fetch público (sem `authFetch`).
- Suítes client/server existentes permanecem verdes.
