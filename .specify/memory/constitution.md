# Cardápio, Teatro e Diversão SA Constitution

## Core Principles

### I. Pagamento e pedidos não podem regredir (NÃO NEGOCIÁVEL)

O fluxo de pedido e de pagamento Pix (criação do pedido, cobrança, confirmação por webhook,
consulta pelo código e estoque) MUST continuar funcionando a cada mudança. Toda proposta de mudança
MUST listar os comportamentos de pedido e pagamento que precisam ser preservados, e eles MUST ser
reverificados antes da integração na `main`. Credenciais e certificados da Efí MUST NOT ser lidos,
alterados ou versionados.

*Justificativa*: o site é usado por um evento real com dinheiro real; uma regressão afeta pessoas e
o caixa do evento.

### II. Acessibilidade verificável

As páginas públicas (cardápio, pedido, pagamento e consulta) MUST atender, no mínimo, à WCAG 2.2
nível AA. A conformidade automática é um piso, não uma prova: quando uma dificuldade observada em
inspeção ou com pessoas com deficiência contradiz uma verificação automática, a observação prevalece
e MUST ser tratada como defeito ou lacuna da especificação.

*Justificativa*: barreiras de foco, anúncio e nome acessível não são detectadas pelas ferramentas
automáticas usadas no projeto.

### III. Especificação como fonte da verdade

O comportamento das páginas públicas MUST estar descrito em `specs/<feature>/spec.md`. Mudanças são
implementadas a partir da especificação aprovada. Arquivos de código que implementam uma feature
MUST declarar a versão implementada com a anotação `@spec <feature>@<versão>`, e `plan.md` e
`tasks.md` MUST registrar a versão da especificação da qual foram gerados (`**Spec Version**: N`).

*Justificativa*: o sistema já existe; a especificação brownfield registra o comportamento atual e
permite detectar divergências entre especificação, plano, tarefas e código.

### IV. Evolução orientada por evidências

Após a versão inicial, nenhuma alteração de especificação MAY ser feita sem: (a) uma evidência em
`evidence/` com a fonte declarada (teste com usuário, inspeção especialista, percurso cognitivo,
verificação automática); (b) uma proposta em `changes/` que separe o observado do inferido; e (c)
uma decisão humana registrada, com responsável e data.

*Justificativa*: rastreabilidade da origem de cada requisito e controle humano sobre propostas
redigidas com apoio de LLM.

### V. Mudanças pequenas, sem novas dependências

Correções MUST usar HTML, CSS e JavaScript já presentes no projeto, sem frameworks ou bibliotecas
novas no front-end. Mudanças de comportamento visual ou de texto MUST preservar a identidade do
evento (temas de trote, prisão e obrigado), salvo decisão registrada.

*Justificativa*: o site está em produção e é mantido por voluntários.

## Restrições do projeto

- Textos da interface MUST estar em português do Brasil.
- Dados de participantes e de compradores MUST NOT aparecer em evidências ou testes; usar
  identificadores (P1, P2…) e dados fictícios.
- O trabalho de pesquisa acontece fora da `main` (branch `evospec/acessibilidade`); o deploy do
  Railway a partir da `main` só recebe mudanças aprovadas e verificadas.

## Fluxo de desenvolvimento e portões de qualidade

1. Especificação brownfield do comportamento atual: `/speckit-specify` (versão 1, descrevendo o que
   existe), seguido de `/speckit-plan` e `/speckit-tasks` quando houver mudança a implementar.
2. Evolução: evidência → proposta → decisão humana → especificação versionada → plano e tarefas
   regenerados → testes dos novos requisitos (escritos por quem não implementa) →
   `/speckit-implement`.
3. Portões: validação de governança do EvoSpec-UX sem erros e verificação sem regressões, incluindo
   os comportamentos de pedido e pagamento do princípio I, antes de integrar na `main`.

## Governance

Esta constituição prevalece sobre outras práticas do repositório para as páginas públicas. Emendas
exigem proposta escrita e aprovação do responsável pelo site, com atualização de versão: MAJOR para
remoção ou redefinição de princípios, MINOR para novos princípios ou seções, PATCH para ajustes de
redação.

**Version**: 1.0.0 | **Ratified**: 2026-11-07 | **Last Amended**: 2026-11-07
