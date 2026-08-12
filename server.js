// server.js
require('dotenv').config();

const express = require('express');
const path = require('path');

const rotasPublicas = require('./routes/publicas');
const rotasAdmin = require('./routes/admin');
const rotaWebhook = require('./routes/webhook');

const app = express();
const PORTA = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Atalho: /admin serve o painel do administrador (sem precisar do .html).
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use('/api', rotasPublicas);
app.use('/api/admin', rotasAdmin);
app.use('/webhook', rotaWebhook); // ex: /webhook/pix

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
  console.log(`Site do comprador: http://localhost:${PORTA}/`);
  console.log(`Painel admin:      http://localhost:${PORTA}/admin.html`);
});
