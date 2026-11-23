# Acompanhamento anônimo + TV full-screen com QR — Design

**Data:** 2026-11-23
**Versão base:** `a52a6da` (origin/main)
**Status:** aguardando aprovação

## Intenção

Permitir que qualquer cidadão acompanhe uma reunião de comissão sem se identificar, tanto pelo celular (QR exibido na TV) quanto navegando pela lista de reuniões. A TV do plenário deve ser legível de longe, sem elementos de navegação do app.

## Objetivos

1. TV full-screen: fundo preto, card grande centralizado, sem header azul/links do app.
2. Opção "Acompanhar sem identificação" na tela de identificação, que pula o login.
3. Página pública de acompanhamento: igual à do Deputado, mas sem notas, orientações da assessoria, vínculo, presença e aba de assessores.
4. QR na TV apontando para a página de acompanhamento da reunião.
5. Download de relatório público no acompanhamento anônimo, com presenças, deliberações, vistas, votações, votações em bloco, rejeitados e não deliberados, e aviso de provisoriedade.

## Não-objetivos

- Criar perfil/role de backend ou token para anônimo.
- Alterar as telas ou relatórios atuais de deputado, assessor e secretário.
- Notas/orientações, presença, vínculo ou sala de assessores para o anônimo.
- Mudanças de banco de dados.

## Anti-objetivos (falhas mesmo se "funcionar")

- TV ainda exibindo o header azul ou presa ao container `max-w-5xl`.
- Página anônima expondo notas privadas, anotações do secretário ou permitindo escrever.
- Relatório público contendo dados privados.
- QR apontando para a própria TV (`/tv/:id`) em vez da reunião.

## Restrições e fatos do projeto

- Stack: React + React Router + Tailwind (Vite), Express + Socket.io, SQLite.
- `GET /api/reuniao/:id`, `/vistas` e `/relatorio-assessoria.pdf` são públicos; o último funciona sem `cabinetKey` (apenas sem notas), mas **não serve** como relatório público: antes de encerrar, imprime "Orientações" no lugar do status e tem título de assessoria.
- `relatorio.pdf` inclui anotações do secretário — também não serve.
- Dados públicos disponíveis no banco: `presencas` (confirmadas), `official_status`, `vistas`, `votacao_simbolica`, `votos_nominais`, `blocos`, `votacao_bloco`.
- `GET /api/legis/reunioes` é público; a lista já funciona sem token.
- `AuthContext` guarda o perfil em `sessionStorage`; `setAuth(profile, name, dep, token)` aceita qualquer string.
- `useSocket(id)` já entrega os eventos `official_status_changed`, `active_item_changed`, `bloco_changed`.

## Abordagens consideradas

### Identidade anônima

- **A (escolhida): perfil local `anonimo`.** O botão grava `profile='anonimo'` no `AuthContext` (sem token) e navega para `/reunioes`. Simples, sem backend, e o header/`VinculoBar` já ignoram perfis desconhecidos.
- B: token de convidado no backend. Adiciona rota, assinatura e expiração sem ganho para uma página pública.
- C: usar `profile=null` como anônimo. Não distingue "ainda não escolheu" de "escolheu acompanhar". (Ainda assim, `null` será tratado como público no roteamento, para o QR funcionar.)

### Página de acompanhamento

- **A (escolhida): novo `Acompanhamento.jsx`** derivado de `PautaAssessor`, só leitura e com fetch público. Isola o risco de expor notas.
- B: condicionais dentro de `PautaAssessor`. Mistura duas audiências e aumenta o risco de vazamento.
- C: reutilizar `TvDisplay`. Layout e comportamento de TV, não de leitura no celular.

### Relatório público

- **A (escolhida): novo gerador + rota pública `GET /api/reuniao/:id/relatorio-publico.pdf`.** Usa os dados públicos ao vivo, sem notas, com aviso de provisoriedade.
- B: reaproveitar o relatório de assessoria. Não mostra status durante a reunião e tem título de assessoria.
- C: reaproveitar `relatorio.pdf`. Vaza anotações do secretário.

### Layout da TV

- **A (escolhida): `/tv/:id` fora do layout do app** (sem `Header`, `VinculoBar` e `main`), com um shell próprio full-screen.
- B: manter no layout e esconder o header via CSS. Frágil e mantém `max-w-5xl`.
- C: app separado só para TV. Excesso para uma rota.

### Posição do QR (decidida pelo usuário)

- **Card grande (~90% da altura) + faixa preta abaixo com QR centralizado e legenda.**

## Desenho

### 1. Identificação

Em `Identificacao.jsx`, abaixo do formulário, botão secundário **"Acompanhar sem identificação"**:

- `setAuth('anonimo', 'Visitante', null, null)`
- `navigate('/reunioes')`
- Não chama API nem pede nome/senha.
- Header exibe "Comissões Ao Vivo - Acompanhamento" (adicionar `anonimo` ao mapa de títulos).

### 2. Roteamento (`App.jsx`)

- `PautaRouter`:
  - `secretario` → `PautaSecretario`
  - `deputado` ou `assessor` → `PautaAssessor`
  - `anonimo` ou sem perfil → `Acompanhamento`
- Quem já está identificado e abre a reunião continua na própria tela. O QR é para o cidadão sem identificação; o cidadão que escaneia cai em `Acompanhamento`.
- Layout do app: extrair `Layout` com `useLocation`; quando `pathname` começa com `/tv/`, renderizar apenas as rotas, sem header/barra/`main`.

### 3. `Acompanhamento.jsx`

Clone enxuto de `PautaAssessor`:

- Carrega `GET /api/reuniao/:id` e `GET /api/reuniao/:id/vistas` com `fetch` público.
- Escuta `official_status_changed`, `active_item_changed` e `bloco_changed` para recarregar.
- Cabeçalho: nome da comissão + identificação compacta da reunião (título/número, data, local).
- Botão **"Baixar relatório"** → `/api/reuniao/${id}/relatorio-publico.pdf`.
- Cards por item com status oficial (mesmos labels/cores do Deputado), ITEM nº + processo (link Sem Papel), ementa, autor, relator/conclusão, pedido de vista.
- **Não** mostra: "Orientação da assessoria", campo de nota, botões Aceitar/Recusar vínculo, aba de assessores, envio de presença/vínculo.
- Não usa `authFetch`; não depende de perfil.

### 4. TV (`TvDisplay.jsx`)

Shell único para todos os estados (aguardando, splash, bloco, item ativo, pedido de vista):

- Container: `h-screen w-screen overflow-hidden bg-black text-white flex flex-col p-[2vh] gap-[1.5vh]`.
- Card: ocupa o restante da altura (`flex-1 w-full`), centralização vertical/horizontal, borda azul e gradiente atuais, tipografia escalável com `clamp()`/`vw`.
- Faixa do QR: altura ~`14vh`, fundo preto, QR centralizado (~`11vh`) + legenda "Aponte a câmera e acompanhe no celular".
- Conteúdo longo (ementa) pode ser truncado com `overflow-hidden`/line-clamp.

### 5. QR (`TvQrBadge.jsx`)

- Nova dependência `qrcode` no `client/package.json`.
- Gera `QRCode.toDataURL(`${window.location.origin}/reuniao/${id}`, { width: 512, margin: 1, errorCorrectionLevel: 'M' })`.
- Imagem branca com padding, `alt="QR code para acompanhar a reunião"`.
- Renderizado na faixa abaixo do card, centralizado.
- Para testar no celular: `server.host: true` no `client/vite.config.js`; abrir a TV pelo IP da máquina na rede (ex.: `http://192.168.x.x:5173/tv/:id`). Em produção, o domínio público aberto na TV.

### 6. Relatório público (`server`)

Nova rota pública `GET /api/reuniao/:id/relatorio-publico.pdf` → `generatePublicoPdf(id)` em `server/src/pdf/report.js`.

Conteúdo:

1. **Cabeçalho:** comissão, data, tipo/número da reunião, local.
2. **Aviso em destaque:** "Relatório provisório, sujeito à revisão da Secretaria das Comissões. Os dados oficiais estarão disponíveis oportunamente no site oficial da Assembleia Legislativa do Estado de São Paulo (al.sp.gov.br)."
3. **Presenças confirmadas:** nomes com partido (via `buildPartyMaps`).
4. **Deliberações e votações por item:** processo, ementa, autoria, relatoria, voto, status **ao vivo**, detalhamento de votação simbólica (efetivos/substitutos/outros) e nominal, e vistas com nomes.
5. **Votações em bloco:** bloco em andamento (se `votacao_bloco.ativo=1`) e blocos registrados (`blocos`: número, itens, resultado).
6. **Resumo:** contagens e listas de aprovados, rejeitados, com vista, retirados e **não deliberados**.

Status ao vivo para o público: `pendente → Pendente`, `em_discussao → Em discussão`, `em_votacao → Em votação`, `aprovado_* / rejeitado_*` com o texto atual, `vista` com nomes, `retirado → Retirado`, `nao_deliberado → Não deliberado`, `aprovado_separado → Aprovado voto em separado`.

Exclui: `anotacoes_privadas`, `anotacoes_secretario`, vínculos e qualquer token. Não grava snapshot em `relatorio_final`.

## Arquivos afetados

- `client/package.json` / `package-lock.json` (qrcode)
- `client/vite.config.js` (`server.host: true` para teste no celular)
- `client/src/App.jsx` (router + layout da TV)
- `client/src/components/Identificacao.jsx` (botão anônimo)
- `client/src/components/Acompanhamento.jsx` (novo)
- `client/src/components/TvDisplay.jsx` (full-screen + QR)
- `client/src/components/TvQrBadge.jsx` (novo)
- `server/src/pdf/report.js` (`generatePublicoPdf`)
- `server/src/routes/meeting.js` (rota pública)
- Testes novos/atualizados em `client/src/__tests__/` e `server/src/__tests__/`

## Testes (TDD)

- `acompanhamento.test.jsx`: renderiza itens/status e identificação da reunião; exibe link `relatorio-publico.pdf`; não exibe "Orientação da assessoria" nem campo de nota.
- `pautaRouter.test.jsx`: anônimo e sem perfil → `Acompanhamento`; deputado → `PautaAssessor`; secretário → `PautaSecretario`.
- `identificacao.test.jsx`: botão "Acompanhar sem identificação" define perfil `anonimo` e navega para `/reunioes`.
- `tvLayout.test.jsx`: `/tv/:id` não renderiza header; QR presente apontando para `/reuniao/:id`; card em container full-screen.
- `tv.test.jsx` continua passando.
- `server/src/__tests__/pdf.test.js`: `generatePublicoPdf` retorna PDF válido com presença/status/bloco e não inclui notas privadas.
- Rota `POST`/`GET` pública: teste de status 200 e `%PDF` (supertest).

## Decisões deixadas ao builder

- Valores exatos de `clamp()`/espaçamentos e tamanho final do QR em 1280×720 e 1920×1080.
- Truncamento de ementas muito longas.
- Texto exato da legenda do QR.
- Organização visual das seções do PDF público.
