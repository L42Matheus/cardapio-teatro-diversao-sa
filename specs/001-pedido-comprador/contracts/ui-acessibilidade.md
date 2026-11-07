# Contrato de interface: página do comprador (`/` e `/?produto=<id>`)

**Spec Version**: 4

## API (inalterada)

`GET /api/produtos`, `GET /api/categorias`, `GET /api/equipes`, `GET /api/status`,
`POST /api/pedidos`, `GET /api/pedidos/:ticket`, `POST /webhook/pix` — mesmos formatos de
requisição e resposta da versão 1 (`routes/publicas.js`, `routes/webhook.js`).

## DOM e ARIA (novos ou modificados)

| Elemento | Contrato | Requisito |
|----------|----------|-----------|
| `#abas-categorias` | `role="group"`, `aria-label="Categorias"` | FR-016 |
| `.aba` | `<button type="button" aria-pressed="true|false">`; só a ativa com `true`; emoji em `span[aria-hidden=true]`; nome lido = nome da categoria ("Todos", "Rosas"…) | FR-016 |
| `#lista-produtos .produto-card` | `data-produto-id`; não é recriado na atualização periódica se o produto não mudou | FR-003 |
| botão do produto | `aria-label` = "Enviar <nome>" / "Denunciar <nome>" (prisão) / "<nome> esgotado"; `disabled` quando esgotado ou pausado (ou `aria-disabled="true"` enquanto focado) | FR-002, FR-014 |
| acionar botão do produto | navega na mesma aba para `/?produto=<id>` | FR-004 |
| `#estoque-info` | `role="status"`; reescrito só quando muda | FR-003 |
| `#anonimo` | nome acessível "Enviar anônimo" (padrão) ou "Denúncia anônima" (prisão) | FR-015 |
| `#form-erro` | `role="alert"`; contém a mensagem do erro atual | FR-006, FR-012 |
| campo inválido | `aria-invalid="true"`, `aria-describedby="form-erro"`, recebe o foco | FR-012 |
| `#pix-copiacola` | rotulado por `<label for>` "Copia e cola" | FR-015 |
| `#secao-pix h2` | `tabindex="-1"`; recebe o foco quando o Pix é gerado | FR-008 |
| `#pix-status` | `role="status"` | FR-013 |
| `#popup-pagamento`, `#popup-obrigado`, `#popup-policia` (`.popup-card`) | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, `tabindex="-1"`; ao abrir recebe o foco e o resto da página fica `inert`; Esc ou "Entendi" fecham e devolvem o foco | FR-013 |

## Contraste (FR-017)

Todo texto dentro de `#secao-cardapio`, inclusive em `.produto-card.esgotado` e em botões
desabilitados, com razão ≥ 4,5:1 contra o fundo efetivo.
