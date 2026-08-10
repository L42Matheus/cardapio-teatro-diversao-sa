# Mercado do Evento — Prototipo

Prototipo funcional do site descrito: compradores escolhem um produto,
pagam via Pix (integracao com Banco Inter mockada por enquanto), recebem
um ticket (numero do pedido), e voce como administrador atribui cada
pedido a um dos 2 entregadores e acompanha o status.

## Como rodar

```bash
npm install
npm start
```

Depois abra:
- Site do comprador: http://localhost:3000/
- Painel do administrador: http://localhost:3000/admin.html

## O que ja funciona

- Lista de produtos com foto, nome e preco (`/api/produtos`)
- Limite geral de vagas (X) configuravel em `db.js` (`LIMITE_TOTAL_PEDIDOS`)
- Criacao de pedido gerando um "ticket" (numero do pedido)
- Geracao de cobranca Pix (MOCKADA — veja `pix.js`)
- Endpoint de webhook (`/webhook/pix`) pronto para receber a notificacao
  real do Inter quando o Pix cair
- Botao "Simular pagamento" no site — so para teste, sem precisar do Inter
  de verdade
- Consulta publica de pedido pelo ticket
- Painel admin: lista todos os pedidos, atribui a um dos 2 entregadores,
  marca como entregue
- Fluxo de status: `pendente_pagamento -> pago -> aguardando -> entregue`
  (`aguardando` = ja pago e atribuido a um entregador, esperando a entrega)

## O que falta para ir pra producao

1. **Integrar a API Pix real do Inter** (`pix.js`):
   - Vai precisar de certificado mTLS + client_id/client_secret do Inter,
     cadastrados no Internet Banking (area de API/Developers).
   - Trocar `criarCobrancaPix` para chamar
     `POST /pix/v2/cob` (cobranca imediata) de verdade, e usar o QR Code
     e "copia e cola" que o Inter devolve.
   - Cadastrar a URL do seu servidor (`/webhook/pix`) como webhook Pix
     no Inter, para ele te avisar quando cair o pagamento.
   - Validar a autenticidade do webhook (o Inter tem um processo de
     validacao do endpoint antes de comecar a mandar eventos).

2. **Autenticacao no painel admin** — hoje `/admin.html` e as rotas
   `/api/admin/*` estao abertas para qualquer pessoa que ache a URL.
   Adicionar um login simples antes do evento.

3. **Trocar o banco de dados**: o prototipo usa um arquivo `data/db.json`
   para ser simples de testar. As tabelas (`produtos`, `pedidos`,
   `entregadores`) foram desenhadas para ir direto pra PostgreSQL —
   so precisa reescrever as funcoes de `db.js` usando `pg` em vez de
   ler/escrever o JSON.

4. **Upload de foto dos produtos**: hoje as fotos ficam em
   `uploads/produtos/` e sao referenciadas por caminho fixo no
   `db.js`. Se quiser trocar a foto sem editar codigo, adicionar
   um endpoint de upload (ex: com `multer`) no painel admin.

5. **Cancelamento de pedidos que nao pagam**: hoje um pedido criado como
   `pendente_pagamento` fica ocupando uma vaga do limite X para sempre.
   Vale adicionar uma expiracao (ex: 15-30 min) que cancela pedidos nao
   pagos automaticamente, liberando a vaga.

## Estrutura de pastas

```
evento-marketplace/
  server.js          -> ponto de entrada
  db.js              -> "banco de dados" (JSON) e regras de negocio
  pix.js             -> integracao com o Pix (mockada)
  routes/
    publicas.js      -> produtos, criar pedido, consultar ticket
    admin.js          -> painel administrativo
    webhook.js        -> recebe notificacao do Inter
  public/
    index.html/app.js -> site do comprador
    admin.html/admin.js -> painel do administrador
  uploads/produtos/   -> fotos dos produtos
  data/db.json         -> gerado automaticamente na primeira execucao
```
