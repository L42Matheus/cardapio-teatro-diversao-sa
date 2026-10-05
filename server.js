// server.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const rotasPublicas = require('./routes/publicas');
const rotasAdmin = require('./routes/admin');
const rotaWebhook = require('./routes/webhook');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(express.json());

// Cada deploy usa um endereco novo para o CSS e o JS (style.css?v=...).
// Sem isso o navegador podia juntar um style.css antigo com um admin.js novo
// logo depois de um deploy, e a tela aparecia quebrada.
const VERSAO = (process.env.RAILWAY_GIT_COMMIT_SHA || String(Date.now())).slice(0, 12);
const PAGINAS = { '/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html', '/admin.html': 'admin.html', '/consultar.html': 'consultar.html' };
const htmlComVersao = {};
for (const arquivo of new Set(Object.values(PAGINAS))) {
  htmlComVersao[arquivo] = fs.readFileSync(path.join(__dirname, 'public', arquivo), 'utf8')
    .replace(/(href|src)="(style\.css|app\.js|admin\.js|consultar\.js)"/g, `$1="$2?v=${VERSAO}"`);
}
app.get(Object.keys(PAGINAS), (req, res) => {
  res.set('Cache-Control', 'no-cache').type('html').send(htmlComVersao[PAGINAS[req.path]]);
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, caminho) {
    if (/\.(html|css|js)$/.test(caminho)) res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use('/api', rotasPublicas);
app.use('/api/admin', rotasAdmin);
app.use('/webhook', rotaWebhook); // ex: /webhook/pix

// Erro inesperado em qualquer rota (banco fora, entrada estranha...): loga e
// responde 500 em vez de derrubar o servidor. JSON malformado no corpo vem
// do express.json() com status 400.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(`Erro em ${req.method} ${req.originalUrl}:`, err.message);
  if (res.headersSent) return next(err);
  res.status(status).json({ erro: status >= 500 ? 'Erro interno. Tente novamente em instantes.' : 'Requisicao invalida.' });
});

// O banco precisa estar pronto (tabelas criadas + seed) antes de aceitar
// requisicoes — praticamente toda rota depende dele. Se DATABASE_URL nao
// estiver configurada ou a conexao falhar, falha rapido com log claro em
// vez de subir um site que da erro em tudo.
db.iniciarBancoDados()
  .then(() => {
    app.listen(PORTA, () => {
      console.log(`Servidor rodando em http://localhost:${PORTA}`);
      console.log(`Site do comprador: http://localhost:${PORTA}/`);
      console.log(`Painel admin:      http://localhost:${PORTA}/admin.html`);
    });
  })
  .catch(err => {
    console.error('Falha ao conectar/preparar o banco de dados (DATABASE_URL configurada?):', err.message);
    process.exit(1);
  });
