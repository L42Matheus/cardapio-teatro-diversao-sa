---

description: "Task list for 002-consulta-pedido (spec v2)"
---

# Tasks: Consulta do pedido pelo código

**Input**: Design documents from `/specs/002-consulta-pedido/`

**Spec Version**: 2

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-consulta.md, quickstart.md

**Tests**: testes dos novos requisitos são escritos por quem não implementa (constituição); sem
tarefas de escrita de testes. Verificações externas ficam como pendentes na fase final.

**Organization**: uma história (US1 — acompanhar a entrega pelo código).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

Projeto único: `routes/` no servidor, páginas em `public/`.

---

## Phase 1: Setup

- [X] T001 Declarar `@spec 002-consulta-pedido@2` no topo de public/consultar.html e public/consultar.js (public/style.css e routes/publicas.js já anotados)

---

## Phase 2: Foundational

- [X] T002 [P] Em public/style.css, estilo do rótulo da consulta (`.consultar-form label`: largura total, centralizado, mesmo padrão de `label` do site) sem alterar o cartão "Estou a caminho!"

---

## Phase 3: User Story 1 - Acompanhar a entrega pelo código (P1)

**Goal**: campo rotulado e resultado anunciado, com foco previsível, sem regressão da consulta.

**Independent Test**: em `/consultar.html`, o campo é lido como "Código do pedido"; vazio → "Digite o código do pedido." anunciado e foco no campo; código inexistente → "Pedido não encontrado. Confira o código." anunciado; código existente (minúsculas) → código, produto, destinatário, equipe e status.

- [X] T003 [US1] Em public/consultar.html, adicionar `<label for="ticketConsulta">Código do pedido</label>` visível no formulário, mantendo o placeholder `EAC-XK7B` (FR-006)
- [X] T004 [US1] Em public/consultar.html, `#resultado-consulta` com `role="status"`, `aria-live="polite"` e `aria-atomic="true"` (FR-007)
- [X] T005 [US1] Em public/consultar.js, função `mostrarResultado(html)` que limpa e reescreve a região para que resultados repetidos sejam anunciados; usar em todos os estados (vazio, consultando, não encontrado, encontrado) (FR-007)
- [X] T006 [US1] Em public/consultar.js, campo vazio: foco no `#ticketConsulta` com `aria-invalid="true"` e `aria-describedby="resultado-consulta"`; limpar a marcação ao digitar e em nova consulta; nos demais resultados não mover o foco (FR-003, FR-007)
- [X] T007 [US1] Em public/consultar.js, exibir a equipe também no pedido com uma só entrega (`itens[0].equipe`), mantendo `esc()` em todo dado digitado (FR-001, FR-005)
- [X] T008 [US1] Em public/consultar.js, tratar falha de conexão com mensagem anunciada em vez de "Consultando..." permanente (SC-002)

---

## Phase 4: Polish & Cross-Cutting

- [X] T009 `node --check public/consultar.js` e percurso do quickstart.md na demonstração local, incluindo `?codigo=` e código em minúsculas (princípio I)
- [ ] T010 **PENDENTE** Verificação oficial (externa): testes de aceitação de FR-006/FR-007 escritos por outra pessoa, validação de governança do EvoSpec-UX e verificação de acessibilidade — não disponíveis neste workspace

---

## Dependencies & Execution Order

T001 → T002 ‖ T003–T004 (HTML) → T005 → T006–T008 (mesmo arquivo, em sequência) → T009 → T010.

### Parallel Opportunities

T002 (style.css) em paralelo com T003–T004 (consultar.html).

## Implementation Strategy

Entrega única (MVP = US1), verificável pelo "Independent Test" na demonstração local.
