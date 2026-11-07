# Feature Specification: Consulta do pedido pelo código

**Feature Branch**: `002-consulta-pedido`

**Created**: 2026-11-07

**Status**: Approved

**Version**: 1

**Input**: User description: "Especificação brownfield da página pública de consulta de pedidos (consultar.html), descrevendo o comportamento em produção em 2026-11-07 (commit d4e635b)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acompanhar a entrega pelo código (Priority: P1)

O participante digita o código recebido no Pix (ex.: EAC-XK7B) e vê o produto, para quem vai e o
status da entrega.

**Why this priority**: é a forma de o participante acompanhar o pedido depois de pagar.

**Independent Test**: informar um código existente e acionar "Consultar"; produto, destinatário(s) e
status são exibidos.

**Acceptance Scenarios**:

1. **Given** um código existente, **When** o participante aciona "Consultar", **Then** são exibidos o
   código, o(s) produto(s), o(s) destinatário(s), a(s) equipe(s) e o status.
2. **Given** um código inexistente, **When** o participante aciona "Consultar", **Then** a mensagem
   "Pedido não encontrado. Confira o código." é exibida.
3. **Given** o campo vazio, **When** o participante aciona "Consultar", **Then** a mensagem "Digite o
   código do pedido." é exibida.
4. **Given** um endereço com `?codigo=EAC-XXXX`, **When** a página abre, **Then** a consulta é feita
   automaticamente.

---

### Edge Cases

- O código é aceito em letras minúsculas ou maiúsculas.
- Pedidos com várias entregas mostram o status de cada uma.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir consultar um pedido pelo código e exibir código, produto(s),
  destinatário(s), equipe(s) e status.
- **FR-002**: Quando o código não existir, o sistema MUST informar que o pedido não foi encontrado.
- **FR-003**: Quando o campo estiver vazio, o sistema MUST pedir que o código seja informado.
- **FR-004**: O sistema MUST consultar automaticamente o código recebido no endereço da página.
- **FR-005**: Os dados digitados por compradores (nomes, equipes) MUST ser exibidos como texto, sem
  interpretação como código da página.

### Key Entities *(include if feature involves data)*

- **Pedido** e **Entrega**: os mesmos da feature `001-pedido-comprador`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O participante encontra o status do pedido em até 30 segundos a partir do código.
- **SC-002**: 100% dos códigos inexistentes resultam em mensagem clara, sem página em branco.

## Assumptions

- Especificação brownfield (commit d4e635b). A consulta não exige login: quem tem o código vê o
  pedido.

## Histórico de versões (EvoSpec)

| Versão | Mudança | Proposta | Evidência | Aprovada por |
|--------|---------|----------|-----------|--------------|
| 1 | Versão inicial (brownfield, commit d4e635b) | — | — | — |
