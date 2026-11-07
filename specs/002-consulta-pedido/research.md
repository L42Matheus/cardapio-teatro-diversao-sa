# Research: Consulta do pedido (Spec Version 2)

**Spec Version**: 2

Sem itens "NEEDS CLARIFICATION". Sem usuário disponível: cada decisão registra a opção
considerada mais razoável.

## R1 — Rótulo do campo (FR-006)

- **Decision**: `<label for="ticketConsulta">Código do pedido</label>` **visível**, acima do
  campo, no estilo dos rótulos já usados no formulário do site; o placeholder `EAC-XK7B`
  permanece como exemplo.
- **Rationale**: rótulo visível beneficia também quem não usa leitor de tela (o placeholder some
  ao digitar) e satisfaz "rótulo que o identifique, independente do texto de exemplo".
- **Alternatives considered**: `aria-label` ou rótulo `.sr-only` — invisível para quem enxerga e
  depende de memória quando o exemplo some.

## R2 — Anúncio do resultado e foco (FR-007)

- **Decision**: `#resultado-consulta` vira região `role="status"` (`aria-live="polite"`,
  `aria-atomic="true"`), sempre presente no DOM. Cada resultado limpa a região e escreve o novo
  conteúdo, para que o mesmo resultado repetido seja anunciado de novo. O foco permanece no
  formulário: no campo vazio o foco vai (ou fica) no campo, marcado com `aria-invalid="true"` e
  `aria-describedby="resultado-consulta"`; em "não encontrado" e "encontrado" o foco não é
  movido (fica no botão ou no campo, onde o participante agiu); a consulta automática por
  `?codigo=` não move o foco. A mensagem intermediária "Consultando..." continua visível, mas o
  anúncio final é o resultado.
- **Rationale**: posição previsível (o participante continua onde estava e pode corrigir o código)
  e anúncio sem precisar procurar.
- **Alternatives considered**: mover o foco para o resultado — perde a posição para nova consulta;
  `role="alert"` — interrompe e é excessivo para resultado esperado.

## R3 — Equipe em pedido com uma entrega (FR-001, versão 1)

- **Decision**: exibir a equipe também quando há uma só entrega (de `itens[0].equipe`, já
  retornado pela API).
- **Rationale**: FR-001 exige a equipe; o código só a mostrava com várias entregas.

## R4 — Falha de conexão (SC-002)

- **Decision**: envolver o `fetch` em `try/catch` e anunciar "Falha de conexão. Verifique sua
  internet e tente novamente." em vez de deixar "Consultando..." indefinidamente.
