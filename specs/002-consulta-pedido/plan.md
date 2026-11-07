# Implementation Plan: Consulta do pedido pelo código

**Branch**: `002-consulta-pedido` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Spec Version**: 2

**Input**: Feature specification from `/specs/002-consulta-pedido/spec.md` (versão 2, aprovada)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A versão 2 (CR-004, evidência EVD-06) acrescenta dois requisitos à página `consultar.html`:

| Requisito | Situação | Origem |
|-----------|----------|--------|
| FR-006 | novo: campo com rótulo "Código do pedido", independente do texto de exemplo | v2 (CR-004) |
| FR-007 | novo: resultado (encontrado, não encontrado, vazio) anunciado por leitores de tela, com foco previsível | v2 (CR-004) |

Na análise do código também se constatou que, com uma única entrega, a página não exibe a equipe,
exigida por FR-001 (versão 1). Como o plano implementa a especificação aprovada, a lacuna é
corrigida junto (ver research R3).

Abordagem: `<label for>` visível e região de anúncio (`role="status"`) no HTML existente, ajustes
pequenos em `public/consultar.js`; nenhuma mudança na API `GET /api/pedidos/:ticket`.

## Technical Context

**Language/Version**: JavaScript de navegador (sem build), HTML5, CSS3; servidor Node.js 20.x (sem mudança)

**Primary Dependencies**: nenhuma no front-end (princípio V); Express no servidor, sem mudança

**Storage**: N/A (consulta somente leitura via API existente)

**Testing**: testes de aceitação oficiais e ferramentas do EvoSpec-UX não estão neste workspace (pendentes, externos); aqui verificação manual na demonstração local e `node --check`

**Target Platform**: navegadores de celular e computador

**Project Type**: aplicação web (Express + páginas estáticas em `public/`)

**Performance Goals**: status encontrado em até 30 s a partir do código (SC-001) — uma requisição

**Constraints**: preservar identidade visual da página ("Estou a caminho!", logo, cartão); textos em pt-BR; WCAG 2.2 AA

**Scale/Scope**: 2 arquivos de front-end (`public/consultar.html`, `public/consultar.js`) e um bloco pequeno em `public/style.css`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Verificação | Situação |
|-----------|-------------|----------|
| I. Pedido e Pix não regridem | A consulta pelo código é comportamento protegido: preservar código em minúsculas/maiúsculas, `?codigo=` automático, mensagens "Pedido não encontrado. Confira o código." e "Digite o código do pedido.", status por entrega; API inalterada; nada de `.env`/credenciais | PASSA (reverificação oficial pendente) |
| II. Acessibilidade verificável | Implementa FR-006 e FR-007 | PASSA (verificação oficial pendente) |
| III. Especificação como fonte da verdade | `**Spec Version**: 2` aqui e em `tasks.md`; `@spec 002-consulta-pedido@2` em `consultar.html`, `consultar.js`, `style.css` e `routes/publicas.js` | PASSA |
| IV. Evolução por evidências | v2 aprovada por Lucas Matheus Silva (CR-004, EVD-06); `evidence/` e `changes/` ausentes do workspace — conferência pendente | PASSA com ressalva |
| V. Mudanças pequenas, sem dependências | só HTML/CSS/JS existentes; rótulo no estilo de rótulos já usado no site | PASSA |

**Comportamentos a preservar (princípio I)**: consulta por `GET /api/pedidos/:ticket`; código
convertido para maiúsculas; consulta automática por `?codigo=`; mensagens de vazio e de não
encontrado; lista de entregas com status de cada uma; dados digitados exibidos como texto (`esc`).

## Project Structure

### Documentation (this feature)

```text
specs/002-consulta-pedido/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-consulta.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
routes/publicas.js       # GET /api/pedidos/:ticket — sem mudança (anotação @spec já presente)
public/
├── consultar.html       # alterado: rótulo e região de anúncio
├── consultar.js         # alterado: anúncio, foco, equipe em entrega única
└── style.css            # alterado: estilo do rótulo da consulta
```

**Structure Decision**: projeto único existente; sem diretórios novos.

## Complexity Tracking

Sem violações a justificar.

## Post-Design Constitution Check

Reavaliado após a Fase 1: só atributos nativos (`<label for>`, `role="status"`, `aria-invalid`,
`aria-describedby`); API e temas preservados. Todos os princípios continuam PASSANDO, com as
mesmas pendências externas.
