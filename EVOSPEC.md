# EvoSpec-UX neste repositório (branch `evospec/acessibilidade`)

Estudo de caso brownfield da pesquisa *Spec-Driven Development Orientado por Evidências de
Usabilidade* (PPGTI/IFPB). **Nada aqui está na `main` nem no site em produção.**

## O que foi feito (2026-11-07)

1. GitHub Spec Kit inicializado (`specify init --integration claude`) e constituição do projeto em
   `.specify/memory/constitution.md` (princípio I: pedidos e pagamento não podem regredir).
2. Especificações brownfield, versão 1, descrevendo o comportamento atual (commit `d4e635b`):
   - `specs/001-pedido-comprador/spec.md` — cardápio, formulário, Pix e confirmação (FR-001 a FR-011)
   - `specs/002-consulta-pedido/spec.md` — consulta pelo código (FR-001 a FR-005)
3. Oito evidências de **inspeção especialista** (`evidence/EVD-01` a `EVD-08`), sete confirmadas no
   site em produção sem criar pedidos e uma por leitura do código. O axe-core (WCAG 2.2 AA) detectou
   apenas uma delas (EVD-08, contraste).
4. Quatro propostas de mudança **pendentes de decisão humana** (`changes/CR-001` a `CR-004`).

## Evidências e propostas

| Proposta | Evidências | Mudança proposta | axe-core detecta? |
|---|---|---|---|
| CR-001 | EVD-01, EVD-04 | Erros do formulário e confirmação do pagamento percebidos por leitores de tela (FR-012, FR-013) | não |
| CR-002 | EVD-03, EVD-05 | Cardápio atualizado sem perder o foco; formulário sem nova aba inesperada; botões identificam o produto (FR-003*, FR-004*, FR-014) | não |
| CR-003 | EVD-02, EVD-07, EVD-08 | Nome acessível dos controles, categoria ativa informada, contraste (FR-015 a FR-017) | só EVD-08 |
| CR-004 | EVD-06 | Campo de código rotulado e resultado da consulta anunciado (002/FR-006, FR-007) | não |

\* requisito existente modificado.

## Situação da governança (`evospec validate`)

As propostas passam nas regras de rastreabilidade e admissibilidade (R1–R3). A validação aponta
22 pendências de **linha de base**, esperadas na adoção do SDD num sistema existente:

- **R4** — os 16 requisitos atuais não têm testes de aceitação;
- **R6** — o código ainda não declara `@spec <feature>@<versão>`;
- **R7** — não há `plan.md` nem `tasks.md`.

## Próximos passos

1. Revisar e decidir cada proposta (aprovar, ajustar, pedir esclarecimento, postergar ou rejeitar).
2. Criar a linha de base: testes de aceitação do comportamento atual, rodando em `npm run demo`
   (Pix simulado, banco local), incluindo os comportamentos de pedido e pagamento a preservar.
3. Para as propostas aprovadas: `/speckit-plan`, `/speckit-tasks` e `/speckit-implement` por um
   agente sem contexto; verificação independente; integração na `main` só sem regressões.
4. Confirmar as evidências com 2 ou 3 usuários de leitor de tela antes ou depois das mudanças.

Ferramenta: [EvoSpec-UX](https://github.com/L42Matheus/evospec-ux) —
`EVOSPEC_ROOT=<este repositório> python evospec.py validate`.
