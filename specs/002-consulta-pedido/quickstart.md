# Quickstart: validar a feature 002 (Spec Version 2)

**Spec Version**: 2

```bash
mkdir -p .pgdata-demo && chown postgres:postgres .pgdata-demo   # quando rodando como root
npm run demo          # porta 3000, Pix simulado, nunca produção
```

A demonstração cria pedidos de exemplo; pegue um código no painel (`/admin`, `teatro`/`demo`) ou
gere um pedido pela loja.

1. **Rótulo (FR-006)**: abrir `http://localhost:3000/consultar.html`; o campo mostra o rótulo
   visível "Código do pedido" e o inspetor de acessibilidade lê esse nome.
2. **Vazio (FR-003, FR-007)**: acionar "Consultar" sem código → "Digite o código do pedido."
   anunciado (região `role="status"`), foco no campo, `aria-invalid="true"`.
3. **Não encontrado (FR-002, FR-007)**: `EAC-ZZZZ` → "Pedido não encontrado. Confira o código."
   anunciado; foco continua no formulário.
4. **Encontrado (FR-001)**: código existente em minúsculas → código, produto, destinatário,
   equipe e status exibidos e anunciados.
5. **Automático (FR-004)**: `consultar.html?codigo=<código>` → consulta feita ao abrir.

Contrato: [contracts/ui-consulta.md](./contracts/ui-consulta.md). Testes oficiais e ferramentas
do EvoSpec-UX: pendentes, aplicados por outra pessoa.
