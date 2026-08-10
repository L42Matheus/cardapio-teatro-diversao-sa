// routes/admin.js
// Rotas usadas pelo painel do administrador (voce).
//
// ATENCAO (producao): estas rotas hoje NAO tem autenticacao — qualquer
// pessoa que acesse /admin.html consegue usar. Antes de usar no evento de
// verdade, adicionar login (usuario/senha ou token) protegendo tudo que
// comeca com /api/admin.

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/admin/pedidos -> lista todos os pedidos, mais recentes primeiro
router.get('/pedidos', (req, res) => {
  const pedidos = db.listarPedidos().slice().sort((a, b) => b.id - a.id);
  res.json(pedidos);
});

// GET /api/admin/entregadores -> lista os 2 entregadores
router.get('/entregadores', (req, res) => {
  res.json(db.listarEntregadores());
});

// POST /api/admin/pedidos/:id/atribuir { entregadorId }
router.post('/pedidos/:id/atribuir', (req, res) => {
  const { entregadorId } = req.body;
  try {
    const pedido = db.atribuirEntregador(req.params.id, entregadorId);
    res.json(pedido);
  } catch (err) {
    const mapa = {
      PEDIDO_NAO_ENCONTRADO: [404, 'Pedido nao encontrado.'],
      PEDIDO_AINDA_NAO_PAGO: [409, 'Este pedido ainda nao foi pago.'],
      ENTREGADOR_INVALIDO: [400, 'Entregador invalido.']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao atribuir entregador.'];
    res.status(codigo).json({ erro: msg });
  }
});

// POST /api/admin/pedidos/:id/entregar -> marca como entregue
router.post('/pedidos/:id/entregar', (req, res) => {
  try {
    const pedido = db.marcarEntregue(req.params.id);
    res.json(pedido);
  } catch (err) {
    const mapa = {
      PEDIDO_NAO_ENCONTRADO: [404, 'Pedido nao encontrado.'],
      PEDIDO_NAO_ESTA_AGUARDANDO: [409, 'Pedido precisa estar "aguardando" (ja atribuido) para ser marcado como entregue.']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao marcar como entregue.'];
    res.status(codigo).json({ erro: msg });
  }
});

module.exports = router;
