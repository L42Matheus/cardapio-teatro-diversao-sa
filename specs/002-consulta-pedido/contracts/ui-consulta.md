# Contrato de interface: `/consultar.html`

**Spec Version**: 2

## API (inalterada)

`GET /api/pedidos/:ticket` → 200 com o pedido, 404 `{ erro }` quando não existe.

## DOM e ARIA

| Elemento | Contrato | Requisito |
|----------|----------|-----------|
| `label[for=ticketConsulta]` | texto visível "Código do pedido" | FR-006 |
| `#ticketConsulta` | nome acessível "Código do pedido"; placeholder `EAC-XK7B` só como exemplo; `aria-invalid="true"` e `aria-describedby="resultado-consulta"` quando vazio na consulta | FR-003, FR-006, FR-007 |
| `#resultado-consulta` | `role="status"`, `aria-live="polite"`, `aria-atomic="true"`; contém a mensagem de vazio, não encontrado, falha ou o resultado | FR-001–FR-003, FR-007 |
| resultado encontrado | código, produto(s), destinatário(s), equipe(s) e status (por entrega quando houver várias); dados digitados como texto | FR-001, FR-005 |
| `?codigo=EAC-XXXX` | consulta automática; foco não é movido | FR-004 |
