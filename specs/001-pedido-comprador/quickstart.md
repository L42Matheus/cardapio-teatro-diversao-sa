# Quickstart: validar a feature 001 (Spec Version 4)

**Spec Version**: 4

## Pré-requisitos

- Node.js 20, `npm install` feito. Nunca usar produção: a demonstração usa Pix simulado e banco
  local em `.pgdata-demo/`.

```bash
mkdir -p .pgdata-demo && chown postgres:postgres .pgdata-demo   # quando rodando como root
npm run demo          # porta 3000; deixar rodando
```

## Cenários

1. **Fluxo de pedido (regressão, princípio I)**: abrir `http://localhost:3000/`, filtrar por
   categoria, acionar "Enviar este" → o formulário abre **na mesma aba** (`/?produto=<id>`).
   Preencher dados válidos e gerar o Pix → código, valor, copia e cola e contagem aparecem.
2. **Pagamento confirmado**: no painel (`/admin`, `teatro`/`demo`), aba "Todos", marcar o pedido
   como pago (ou chamar o webhook simulado, ver `scripts/demo-local.js`). Em até ~2 s o diálogo
   aparece, recebe o foco, é anunciado; Esc/"Entendi" devolve o foco à página (FR-010, FR-013).
3. **Erros (FR-012)**: gerar o Pix com nome de 2 letras → foco vai para "Seu nome", campo com
   `aria-invalid="true"`, mensagem em `#form-erro` (`role="alert"`).
4. **Atualização estável (FR-003)**: focar com Tab o botão de um produto e esperar > 5 s → o foco
   e a rolagem permanecem; alterar o estoque no painel → o cartão muda sem perder o foco.
5. **Nomes e estados (FR-014–FR-016)**: no inspetor de acessibilidade, botão do produto lido como
   "Enviar <produto>"; checkbox lido como "Enviar anônimo" (ou "Denúncia anônima" na prisão); aba
   ativa com `aria-pressed="true"` e nome sem emoji.
6. **Contraste (FR-017)**: zerar o estoque de um produto e conferir o texto do cartão esgotado
   (≥ 4,5:1) com o verificador de contraste do navegador.

Os testes de aceitação oficiais e as ferramentas do EvoSpec-UX não estão neste workspace; serão
aplicados por outra pessoa. Contrato detalhado: [contracts/ui-acessibilidade.md](./contracts/ui-acessibilidade.md).
