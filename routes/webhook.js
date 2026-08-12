// routes/webhook.js
// Endpoint que a Efi chama quando um Pix e recebido.
//
// IMPORTANTE (producao real): a Efi recomenda validar a origem da chamada via
// mTLS (apresentando a cadeia de certificados publica dela) ou whitelist de
// IP. Configurar mTLS completo no Express exige um servidor HTTPS dedicado
// (fora do escopo deste prototipo), entao aqui a protecao usada e mais
// simples: a URL cadastrada no painel da Efi inclui um token secreto como
// query param (?token=...), e a chamada e rejeitada se ele nao bater.
//
// ATENCAO ao cadastrar a webhookUrl no painel/API da Efi: ela sempre
// acrescenta "/pix" no final da URL registrada antes de chamar — e isso
// cai dentro do valor do ULTIMO query param, corrompendo-o. Por isso a
// URL deve terminar com "&ignorar=" (param descartavel) DEPOIS do
// "?token=...", assim o "/pix" gruda no "ignorar" em vez de corromper o
// token. Exemplo de webhookUrl correta a cadastrar na Efi:
//   https://seu-dominio/webhook/pix?token=SEU_TOKEN&ignorar=
//
// Nunca confiar apenas no valor recebido no payload sem cruzar com o pedido
// salvo no banco (para evitar fraude) — feito abaixo via buscarPedidoPorTxid.
//
// Payload esperado (formato real da Efi):
// { "pix": [ { "txid": "...", "valor": "...", "endToEndId": "...", ... } ] }

const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/pix', (req, res) => {
  const tokenEsperado = process.env.WEBHOOK_PIX_TOKEN;
  if (tokenEsperado && req.query.token !== tokenEsperado) {
    return res.status(403).json({ erro: 'Token invalido.' });
  }

  // Antes de salvar o webhook, a Efi faz uma chamada de validacao na URL
  // (sem o array "pix" no corpo) so pra checar que responde 2xx. Por isso,
  // corpo vazio/sem "pix" e tratado como no-op, nao como erro.
  const eventos = Array.isArray(req.body.pix) ? req.body.pix : [];

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

  // A Efi espera um 200 rapido para nao reenviar o webhook.
  res.status(200).json({ recebido: true, resultados });
});

module.exports = router;
