// routes/webhook.js
// Endpoint que o Banco Inter chama quando um Pix e recebido.
//
// IMPORTANTE (producao): o Inter exige que voce cadastre essa URL como
// webhook Pix na propria API dele, e ele passa a enviar um POST aqui
// sempre que uma cobranca associada a sua chave Pix for paga. Voce deve:
//   1) Validar que a chamada realmente vem do Inter (mTLS do lado deles
//      + IP/whitelist, e o payload traz o txid da cobranca original).
//   2) Nunca confiar so no valor recebido no payload sem cruzar com o
//      pedido salvo no banco (para evitar fraude).
//
// Neste prototipo o payload esperado e simplificado:
// { "pix": [ { "txid": "...", "valor": "..." } ] }
// (formato inspirado no que o Inter/Bacen usam de fato)

const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/pix', (req, res) => {
  const eventos = req.body.pix;

  if (!Array.isArray(eventos)) {
    return res.status(400).json({ erro: 'Formato de webhook invalido.' });
  }

  const resultados = [];

  for (const evento of eventos) {
    const pedido = db.buscarPedidoPorTxid(evento.txid);
    if (!pedido) {
      resultados.push({ txid: evento.txid, ok: false, motivo: 'pedido nao encontrado' });
      continue;
    }
    try {
      db.atualizarStatusPorTxid(evento.txid, 'pago');
      resultados.push({ txid: evento.txid, ok: true });
    } catch (err) {
      resultados.push({ txid: evento.txid, ok: false, motivo: err.message });
    }
  }

  // O Inter espera um 200 rapido para nao reenviar o webhook.
  res.status(200).json({ recebido: true, resultados });
});

module.exports = router;
