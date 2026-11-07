# Data Model: Pedido do comprador (Spec Version 4)

**Spec Version**: 4

As versões 2–4 da especificação não alteram entidades nem o esquema do banco. Mantidos como na
versão 1 (ver `db.js`):

- **Produto**: `id`, `nome`, `descricao`, `foto`, `preco`, `categoria` (`rosa`, `boton`, `trote`,
  `prisao`…), `estoque`. Esgotado quando `estoque <= 0`.
- **Pedido**: `codigo` (ex.: `EAC-XK7B`, compartilhado pelas entregas de um mesmo Pix), comprador
  (`nomeComprador`, `contato`), entregas, valor total, `status`
  (`pendente_pagamento` → `pago` → `aguardando` → `entregue`; ou `cancelado`), cobrança Pix
  (`txid`, copia e cola, `expiraEm`).
- **Entrega**: `nomeDestinatario`, `equipeDestinatario`, `anonimo`, `mensagemEspecial` (≤ 50),
  `valor`, `status`.

## Regras de validação (inalteradas, cliente e servidor)

| Campo | Regra | Campo focado em erro (FR-012) |
|-------|-------|-------------------------------|
| Nome de quem envia | ≥ 4 caracteres | `#nomeComprador` |
| WhatsApp | 10 ou 11 dígitos | `#contato` |
| Nome de quem recebe | ≥ 4 caracteres | `#nomeDestinatario` |
| Equipe de quem recebe | valor da lista `/api/equipes` | `#equipeDestinatario` |
| Mensagem | ≤ 50 caracteres (`maxlength`) | — |

## Estado de interface (novo, só no navegador)

- **Botão de produto**: `disponível` | `esgotado` | `pausado`; aplicado no lugar a cada
  atualização (R1). Focado + indisponível → `aria-disabled="true"` até perder o foco.
- **Diálogo de confirmação**: `fechado` → `aberto` (foco no diálogo, página `inert`) →
  `pronto` (temas obrigado/polícia: botão "Entendi" visível e focado) → `fechado` (foco devolvido).
