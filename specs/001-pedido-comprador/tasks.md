---

description: "Task list for 001-pedido-comprador (spec v4)"
---

# Tasks: Pedido do comprador (cardápio, formulário e Pix)

**Input**: Design documents from `/specs/001-pedido-comprador/`

**Spec Version**: 4

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-acessibilidade.md, quickstart.md

**Tests**: a constituição exige que os testes dos novos requisitos sejam escritos por quem não
implementa; por isso não há tarefas de escrita de testes aqui. As verificações externas ficam na
fase final, como pendentes.

**Organization**: tarefas agrupadas por história de usuário (US1 cardápio, US2 formulário/Pix,
US3 confirmação do pagamento).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: história de usuário (US1, US2, US3)

## Path Conventions

Projeto único: servidor na raiz (`server.js`, `routes/`), front-end em `public/`.

---

## Phase 1: Setup

- [ ] T001 Declarar `@spec 001-pedido-comprador@4` no topo de public/index.html, public/app.js, public/style.css e routes/publicas.js (comentário, sem mudar comportamento)

---

## Phase 2: Foundational (blocking)

- [ ] T002 [P] Adicionar utilitário `.sr-only` (texto só para leitores de tela) e foco visível para `[tabindex="-1"]`/`.popup-card` em public/style.css
- [ ] T003 [P] Criar em public/app.js os auxiliares `marcarErroCampo(id, mensagem)`, `limparErrosCampos()` e o par `abrirDialogo(popup)`/`fecharDialogo(popup)` (guarda o foco anterior, aplica `inert` em header/main/footer, prende Tab, fecha com Esc, devolve o foco) — base para US2 e US3

**Checkpoint**: base pronta.

---

## Phase 3: User Story 1 - Escolher um produto no cardápio (P1)

**Goal**: cardápio com nomes, estados e contraste corretos, atualização estável e formulário na mesma aba.

**Independent Test**: filtrar uma categoria (aba com `aria-pressed="true"`, nome sem emoji), acionar "Enviar este" (lido "Enviar <produto>") → formulário abre na mesma aba; com o foco num botão, aguardar 10 s → foco e rolagem preservados.

- [ ] T004 [US1] Em public/index.html, dar ao `#abas-categorias` `role="group"` e `aria-label="Categorias"`, e ao `#estoque-info` `role="status"` (FR-016, FR-003)
- [ ] T005 [US1] Em public/app.js `criarAba`/`marcarAbaAtiva`, envolver o emoji em `<span aria-hidden="true">` e manter `aria-pressed` = "true" só na aba ativa (FR-016)
- [ ] T006 [US1] Em public/app.js `renderizarProdutos`, criar cada cartão com `data-produto-id`, emoji da etiqueta de categoria `aria-hidden`, nome/descrição escapados e botão com `aria-label` "Enviar <nome>" / "Denunciar <nome>" / "<nome> esgotado", ligado por `addEventListener` em vez de `onclick` inline (FR-001, FR-014)
- [ ] T007 [US1] Em public/app.js, separar a atualização periódica: `atualizarProdutos()` compara a lista nova com a exibida e atualiza no lugar (texto de estoque, classe `esgotado`, rótulo e estado do botão); só re-renderiza se a lista visível mudou, restaurando foco e rolagem; botão focado que fica indisponível recebe `aria-disabled="true"` até perder o foco (FR-002, FR-003; research R1)
- [ ] T008 [US1] Em public/app.js `carregarStatus`, só reescrever `#estoque-info` e o estado dos botões quando a pausa mudar, usando a mesma regra de foco de T007 (FR-002, FR-003)
- [ ] T009 [US1] Em public/app.js `abrirFormulario`/`voltarAoCardapio`, navegar na mesma aba para `/?produto=<id>` (sem `window.open`), recusar produto esgotado/pausado, e voltar pelo histórico quando a página anterior for o cardápio, senão `location.href = '/'`, removendo `window.close()` (FR-004; research R2)
- [ ] T010 [US1] Em public/style.css, garantir contraste ≥ 4,5:1 no cardápio: remover `opacity` do `.produto-card.esgotado` (cinza/esmaecido só na `.imagem`), cores próprias para botões desabilitados de `#lista-produtos` (texto `#4a4a4a` sobre `#efefec`) e vermelho `#c62828` em `.estoque-info.zerado`/`.ultimas` (FR-017; research R7)
- [ ] T011 [US1] Em public/app.js `preencherResumoPedido`, emoji da categoria do resumo em `<span aria-hidden="true">` (FR-016)

**Checkpoint**: US1 testável sozinha.

---

## Phase 4: User Story 2 - Preencher o pedido e gerar o Pix (P1)

**Goal**: erros que levam o foco ao campo e são anunciados; controles com nome acessível.

**Independent Test**: gerar o Pix com nome "Ab" → foco em "Seu nome", `aria-invalid="true"`, mensagem anunciada; com dados válidos o Pix é gerado e o foco vai para "Pagamento Pix".

- [ ] T012 [US2] Em public/index.html, `#form-erro` com `role="alert"`; opção anônima com texto `.sr-only` `#txt-anonimo` dentro do `<label>` (sem `aria-label` no label); "Copia e cola" como `<label for="pix-copiacola">`; emoji do botão copiar `aria-hidden`; título `#secao-pix h2` com `tabindex="-1"` (FR-012, FR-015)
- [ ] T013 [US2] Em public/app.js `aplicarTemaFormulario`, trocar o texto de `#txt-anonimo` ("Enviar anônimo" / "Denúncia anônima") além do `title` (FR-011, FR-015)
- [ ] T014 [US2] Em public/app.js `enviarPedido` e `adicionarDestinatario`, usar `marcarErroCampo` para cada regra — nome "≥ 4 caracteres" → `#nomeComprador`; WhatsApp "10 ou 11 dígitos" → `#contato`; destinatário "≥ 4 caracteres" → `#nomeDestinatario`; equipe "valor da lista" → `#equipeDestinatario` — com mensagens que digam o que corrigir (usando os textos do tema), e associar erros do servidor ao campo pelo conteúdo da mensagem (FR-006, FR-012; research R3)
- [ ] T015 [US2] Em public/app.js, limpar `aria-invalid` de um campo quando ele for alterado e ao abrir o formulário (FR-012)
- [ ] T016 [US2] Em public/app.js `renderizarDestinatariosPedido`, botões "Remover" com `aria-label` "Remover <nome>" (FR-015)
- [ ] T017 [US2] Em public/app.js `enviarPedido`, após gerar o Pix, levar o foco ao título "Pagamento Pix" (o botão focado some com o formulário), mantendo a trava `enviandoPedido` (FR-008, FR-009)

**Checkpoint**: US1 e US2 funcionando.

---

## Phase 5: User Story 3 - Saber que o pagamento foi confirmado (P1)

**Goal**: confirmação anunciada; diálogo identificado, com foco de ida e volta, nos três temas.

**Independent Test**: com um Pix aguardando, marcar como pago no painel da demo → diálogo recebe o foco e é anunciado; "Entendi"/Esc fecha e o foco volta à página.

- [ ] T018 [US3] Em public/index.html, `#popup-pagamento`, `#popup-obrigado` e `#popup-policia`: `.popup-card` com `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (título) e `aria-describedby` (texto), `tabindex="-1"`; ícone ✅ decorativo `aria-hidden`; `#pix-status` com `role="status"` (FR-013)
- [ ] T019 [US3] Em public/app.js `mostrarPopupPagamento`, `mostrarPopupObrigado`, `mostrarPopupPolicia` e `fechar*`, usar `abrirDialogo`/`fecharDialogo`; nos temas obrigado/polícia, quando a classe `pronto` é aplicada (3,5 s), levar o foco ao botão "Entendi" (FR-010, FR-013)

**Checkpoint**: as três histórias funcionando.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T020 Checagem de sintaxe (`node --check public/app.js`) e percurso manual do quickstart.md na demonstração local (`npm run demo`), cobrindo os comportamentos de pedido e pagamento do princípio I listados em plan.md
- [ ] T021 Verificação oficial (pendente, externa): testes de aceitação dos novos requisitos escritos por outra pessoa, validação de governança do EvoSpec-UX e verificação automática/inspeção de acessibilidade — ferramentas não disponíveis neste workspace

---

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002, T003) → US1 → US2 → US3 → Polish.
- US1, US2 e US3 tocam os mesmos arquivos (public/app.js, public/index.html); executar em sequência.
- T019 depende de T003 e T018; T014 depende de T003 e T012.

### Parallel Opportunities

- T002 (style.css) ‖ T003 (app.js).
- T010 (style.css) pode rodar em paralelo com T005–T009 (app.js).

## Implementation Strategy

MVP = US1 (cardápio estável e nomeado, mesma aba). Depois US2 (erros) e US3 (confirmação). Cada
história é verificável pelo seu "Independent Test" na demonstração local.
