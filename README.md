# Mercado do Evento — Prototipo

Prototipo funcional do site descrito: compradores escolhem um produto,
pagam via Pix (integracao real com a Efi), recebem um ticket (numero do
pedido), e voce como administrador atribui cada pedido a uma equipe de
entrega e acompanha o status.

## Como rodar

```bash
npm install
cp .env.example .env   # preencha com suas credenciais Efi (veja abaixo)
npm start
```

### Configuracao da Efi (Pix)

1. Crie/edite uma aplicacao no painel da Efi (Area Pix > Aplicacoes) e
   gere um par de credenciais — homologacao ou producao.
2. Gere e baixe o certificado `.p12` da mesma aplicacao (so da pra baixar
   uma vez). Salve em `certs/` (pasta ja ignorada pelo git).
3. Pegue a chave Pix cadastrada na sua conta Efi (a que vai receber o
   dinheiro) — pode ser CPF/CNPJ, e-mail, telefone ou chave aleatoria.
4. Preencha o `.env`: `EFI_SANDBOX`, `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`,
   `EFI_CERT_PATH` (caminho do `.p12`, local) ou `EFI_CERT_BASE64`
   (conteudo do `.p12` em base64, usado em produção/Railway) e `EFI_PIX_KEY`.
5. Cadastre o webhook no painel da Efi (ou via API, `pixConfigWebhook`)
   apontando para:
   ```
   https://seudominio.com.br/webhook/pix?token=SEU_WEBHOOK_PIX_TOKEN&ignorar=
   ```
   O token deve ser igual ao `WEBHOOK_PIX_TOKEN` do `.env`. **O `&ignorar=`
   no final é obrigatório** — a Efi sempre acrescenta `/pix` na URL
   cadastrada antes de chamar, e isso corrompe o `token` se ele for o
   último parâmetro (ver comentário em `routes/webhook.js`).

### Deploy em produção (Railway)

O projeto já tem `Dockerfile` e `railway.json` prontos. No painel do
Railway, configure as variáveis de ambiente do serviço:

| Variável | Valor |
| --- | --- |
| `EFI_SANDBOX` | `false` |
| `EFI_CLIENT_ID` | Client ID de **produção** (par separado do de homologação) |
| `EFI_CLIENT_SECRET` | Client Secret de produção |
| `EFI_CERT_BASE64` | Conteúdo do `.p12` de produção em base64 (não use `EFI_CERT_PATH` no Railway — não há como montar o arquivo) |
| `EFI_PIX_KEY` | Chave Pix real que vai receber o dinheiro |
| `WEBHOOK_PIX_TOKEN` | Um token novo, diferente do usado em homologação |
| `ADMIN_PASSWORD` | Senha forte para o usuário `teatro` (nunca deixar no default) |
| `PORT` | Já é injetada automaticamente pelo Railway |

Depois do primeiro deploy, pegue o domínio público gerado pelo Railway
(ou o domínio próprio, se configurado) e cadastre o webhook na Efi de
produção apontando pra ele (mesmo formato do passo 5 acima).

**Risco aceito por enquanto**: o "banco" é um arquivo `data/db.json` no
disco do container. Sem um [Volume](https://docs.railway.com/reference/volumes)
configurado, esse arquivo é apagado a cada redeploy/reinício — os pedidos
voltam a zero. Ok pra um evento curto testado com calma, mas vale
configurar um Volume (ou migrar pra Postgres, item 3 da lista abaixo)
antes de qualquer evento que não possa perder dados no meio.

Depois abra:
- Site do comprador: http://localhost:3000/
- Painel do administrador: http://localhost:3000/admin.html

## O que ja funciona

- Lista de produtos com foto, nome e preco (`/api/produtos`)
- Criacao de pedido gerando um "ticket" (numero do pedido)
- Geracao de cobranca Pix real via Efi, com QR Code e "copia e cola"
  (`pix.js`)
- Endpoint de webhook (`/webhook/pix`) protegido por token, recebe a
  notificacao da Efi quando o Pix cai
- "Marcar como pago" manualmente — só dentro do painel admin, autenticado
  (aba "Todos", disponível para pedidos pendentes de pagamento)
- Consulta publica de pedido pelo ticket
- Login no painel admin (usuario fixo "teatro" = admin; equipes criadas
  pelo admin fazem login proprio)
- Painel admin: lista todos os pedidos, atribui/reserva pedidos por
  equipe, marca como entregue, controla estoque
- Fluxo de status: `pendente_pagamento -> pago -> aguardando -> entregue`
  (`aguardando` = ja pago e atribuido a um entregador, esperando a entrega)

## O que falta para ir pra producao

1. **Trocar o banco de dados**: o prototipo usa um arquivo `data/db.json`
   para ser simples de testar. As tabelas (`produtos`, `pedidos`,
   `entregadores`) foram desenhadas para ir direto pra PostgreSQL —
   so precisa reescrever as funcoes de `db.js` usando `pg` em vez de
   ler/escrever o JSON. Isso tambem remove a condicao de corrida que
   existe hoje (leitura/escrita do JSON inteiro sem lock) e o risco de
   perder dados a cada redeploy no Railway (ver secao de Deploy acima).

2. **Upload de foto dos produtos**: hoje as fotos ficam em
   `uploads/produtos/` e sao referenciadas por caminho fixo no
   `db.js`. Se quiser trocar a foto sem editar codigo, adicionar
   um endpoint de upload (ex: com `multer`) no painel admin.

3. **Cancelamento de pedidos que nao pagam**: hoje um pedido criado como
   `pendente_pagamento` fica ocupando estoque para sempre. Vale adicionar
   uma expiracao (ex: 15-30 min) que cancela pedidos nao pagos
   automaticamente, liberando o estoque.

## Estrutura de pastas

```
evento-marketplace/
  server.js          -> ponto de entrada
  db.js              -> "banco de dados" (JSON) e regras de negocio
  pix.js             -> integracao real com a API Pix da Efi
  routes/
    publicas.js      -> produtos, criar pedido, consultar ticket
    admin.js          -> painel administrativo (login + operacoes)
    webhook.js        -> recebe notificacao de pagamento da Efi
  public/
    index.html/app.js -> site do comprador
    admin.html/admin.js -> painel do administrador
  uploads/produtos/   -> fotos dos produtos
  certs/               -> certificado .p12 da Efi (gitignored)
  data/db.json         -> gerado automaticamente na primeira execucao
```
