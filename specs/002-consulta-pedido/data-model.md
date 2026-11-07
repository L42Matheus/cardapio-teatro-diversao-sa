# Data Model: Consulta do pedido (Spec Version 2)

**Spec Version**: 2

Sem mudanças de entidades. **Pedido** e **Entrega** são os mesmos da feature
`001-pedido-comprador` (ver `specs/001-pedido-comprador/data-model.md`).

Resposta usada de `GET /api/pedidos/:ticket` (inalterada): `ticket`, `produto`, `destinatario`,
`status`, `quantidade`, `itens[]` (`produto`, `destinatario`, `equipe`, `anonimo`, `status`).

## Estados da região de resultado (`#resultado-consulta`)

| Estado | Conteúdo | Foco |
|--------|----------|------|
| vazio | "Digite o código do pedido." | campo `#ticketConsulta`, `aria-invalid="true"` |
| consultando | "Consultando..." | inalterado |
| não encontrado | "Pedido não encontrado. Confira o código." | inalterado |
| encontrado | código, produto(s), destinatário(s), equipe(s), status | inalterado |
| falha de conexão | "Falha de conexão. Verifique sua internet e tente novamente." | inalterado |
