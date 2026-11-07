# Feature Specification: Pedido do comprador (cardápio, formulário e Pix)

**Feature Branch**: `001-pedido-comprador`

**Created**: 2026-11-07

**Status**: Approved

**Version**: 1

**Input**: User description: "Especificação brownfield do fluxo público de pedido do site Cardápio, Teatro e Diversão SA, descrevendo o comportamento em produção em 2026-11-07 (commit d4e635b): escolha do produto no cardápio, formulário de pedido, cobrança Pix e confirmação do pagamento."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolher um produto no cardápio (Priority: P1)

O participante do evento vê os produtos disponíveis (rosas, botons, trotes, prisão), com foto,
descrição, preço e estoque, filtra por categoria e escolhe o que quer enviar.

**Why this priority**: é a porta de entrada de todas as vendas.

**Independent Test**: abrir o cardápio, filtrar por uma categoria e acionar o botão de um produto
disponível; o formulário de pedido daquele produto é aberto.

**Acceptance Scenarios**:

1. **Given** o cardápio aberto, **When** o participante escolhe uma categoria, **Then** apenas os
   produtos daquela categoria são exibidos e a categoria escolhida aparece como ativa.
2. **Given** um produto com estoque zerado, **When** o cardápio é exibido, **Then** o produto aparece
   como "Esgotado" e não pode ser escolhido.
3. **Given** um produto disponível, **When** o participante aciona "Enviar este" (ou "Denunciar", na
   prisão), **Then** o formulário de pedido do produto é aberto.

---

### User Story 2 - Preencher o pedido e gerar o Pix (Priority: P1)

O participante informa seus dados e os de quem vai receber (uma ou mais pessoas), aciona "Gerar
cobrança Pix" e recebe o código do pedido, o valor e o código Pix copia e cola.

**Why this priority**: sem o pedido válido não há pagamento nem entrega.

**Independent Test**: preencher o formulário com dados válidos e gerar o Pix; o código do pedido, o
valor e o copia e cola são exibidos.

**Acceptance Scenarios**:

1. **Given** o formulário com dados válidos, **When** o participante aciona "Gerar cobrança Pix",
   **Then** o pedido é criado e são exibidos o código do pedido, o valor, o copia e cola e o tempo
   restante para pagar.
2. **Given** um dado inválido (nome com menos de 4 caracteres, WhatsApp sem DDD, destinatário ou
   equipe ausentes), **When** o participante aciona "Gerar cobrança Pix", **Then** o pedido não é
   criado e uma mensagem explica o que corrigir.
3. **Given** mais de uma pessoa adicionada, **When** o Pix é gerado, **Then** um único pagamento
   cobre todas as entregas, listadas com nome, equipe e valor.

---

### User Story 3 - Saber que o pagamento foi confirmado (Priority: P1)

Depois de pagar, o participante vê a confirmação na própria página e guarda o código para
acompanhar a entrega.

**Why this priority**: o participante precisa saber que o pagamento deu certo para não pagar duas
vezes nem desistir.

**Independent Test**: com um pedido aguardando pagamento, confirmar o pagamento (em ambiente de
demonstração, pelo Pix simulado); a confirmação aparece sem recarregar a página.

**Acceptance Scenarios**:

1. **Given** um pedido aguardando pagamento, **When** o pagamento é confirmado, **Then** o status
   muda para pago e uma janela de confirmação com o código do pedido é exibida, no tema do produto
   (obrigado, polícia ou padrão).

---

### Edge Cases

- Pedidos pausados pelo administrador: os botões dos produtos ficam desabilitados e uma tentativa de
  abrir o formulário avisa que os pedidos estão pausados.
- Cliques repetidos em "Gerar cobrança Pix" não criam pedidos duplicados.
- Pix expirado: a página informa que o código expirou e orienta a gerar outro.
- Falha de conexão ao gerar o Pix: mensagem de falha e possibilidade de tentar novamente.
- Produto inexistente no endereço do pedido: mensagem "Produto não encontrado" e retorno ao cardápio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exibir os produtos com foto, nome, descrição, preço e situação do
  estoque, com filtro por categoria.
- **FR-002**: O sistema MUST impedir a escolha de produtos esgotados e de qualquer produto enquanto os
  pedidos estiverem pausados.
- **FR-003**: O sistema MUST atualizar o estoque e a situação dos pedidos no cardápio periodicamente,
  sem que o participante recarregue a página.
- **FR-004**: Ao escolher um produto disponível, o sistema MUST abrir o formulário de pedido daquele
  produto, com resumo do produto e valor.
- **FR-005**: O formulário MUST coletar nome de quem envia (mínimo de 4 caracteres), WhatsApp com DDD
  (10 ou 11 dígitos), nome de quem recebe (mínimo de 4 caracteres), equipe de quem recebe (de uma
  lista), opção de envio anônimo e mensagem de até 50 caracteres.
- **FR-006**: Quando um dado do formulário for inválido, o sistema MUST impedir a criação do pedido e
  exibir uma mensagem que explique o que corrigir.
- **FR-007**: O sistema MUST permitir incluir mais de uma pessoa no mesmo pedido, com uma única
  cobrança.
- **FR-008**: Ao gerar o Pix, o sistema MUST exibir o código do pedido, o valor, o código copia e
  cola com opção de copiar e o tempo restante até a expiração.
- **FR-009**: O sistema MUST impedir a criação de pedidos duplicados por acionamentos repetidos.
- **FR-010**: O sistema MUST detectar a confirmação do pagamento sem recarregar a página e exibir uma
  confirmação com o código do pedido, no tema do produto.
- **FR-011**: Para produtos da categoria prisão, o sistema MUST apresentar o formulário como
  "denúncia" (textos de suspeito, crime e mandado), mantendo as mesmas regras de validação.

### Key Entities *(include if feature involves data)*

- **Produto**: nome, descrição, foto, preço, categoria, estoque.
- **Pedido**: código (ex.: EAC-XK7B), comprador (nome, WhatsApp), entregas, valor total, status
  (aguardando pagamento, pago, aguardando entrega, entregue, cancelado), cobrança Pix e expiração.
- **Entrega**: destinatário, equipe, anônimo, mensagem, valor e status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O participante conclui um pedido, do cardápio ao Pix gerado, em até 3 minutos.
- **SC-002**: 100% dos pagamentos confirmados aparecem para o participante na própria página em até
  10 segundos.
- **SC-003**: Nenhum pedido duplicado é criado por acionamentos repetidos.
- **SC-004**: O participante identifica e corrige um dado inválido sem ajuda externa em pelo menos 90%
  das tentativas.

## Assumptions

- Especificação brownfield: descreve o comportamento observado no código em produção (commit
  d4e635b), não um comportamento desejado.
- O pagamento real usa a API Pix da Efí; em demonstração local, o Pix é simulado
  (`npm run demo`).
- O painel do administrador, a página de entregas e a página da prisão estão fora do escopo desta
  feature.
- A acessibilidade segue a constituição do projeto (WCAG 2.2 AA como piso); esta versão não contém
  requisitos de acessibilidade explícitos porque o sistema atual não os define.

## Histórico de versões (EvoSpec)

| Versão | Mudança | Proposta | Evidência | Aprovada por |
|--------|---------|----------|-----------|--------------|
| 1 | Versão inicial (brownfield, commit d4e635b) | — | — | — |
