// routes/publicas.js
// Rotas que o site do comprador usa: ver produtos, criar pedido,
// consultar status pelo ticket (numero do pedido) e ver estoque restante.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { criarCobrancaPix } = require('../pix');

// GET /api/produtos -> lista produtos disponiveis para compra
router.get('/produtos', (req, res) => {
  res.json(db.listarProdutosAtivos());
});

// GET /api/estoque -> quantas vagas ainda restam no total (limite X geral)
router.get('/estoque', (req, res) => {
  res.json(db.estoqueDisponivel());
});

// POST /api/pedidos -> cria um novo pedido e gera a cobranca Pix
router.post('/pedidos', (req, res) => {
  const { produtoId, nomeComprador, contato, nomeDestinatario } = req.body;

  if (!produtoId || !nomeComprador || !nomeDestinatario) {
    return res.status(400).json({ erro: 'Preencha produto, seu nome e o nome de quem vai receber.' });
  }

  try {
    const pedido = db.criarPedido({ produtoId, nomeComprador, contato, nomeDestinatario });
    const cobranca = criarCobrancaPix(pedido); // chamada (mock) a API Pix do Inter
    return res.status(201).json({
      ticket: pedido.id,
      status: pedido.status,
      pix: cobranca
    });
  } catch (err) {
    if (err.message === 'ESTOQUE_ESGOTADO') {
      return res.status(409).json({ erro: 'Todas as vagas de compra deste evento ja foram utilizadas.' });
    }
    if (err.message === 'PRODUTO_INVALIDO') {
      return res.status(400).json({ erro: 'Produto invalido ou indisponivel.' });
    }
    console.error(err);
    return res.status(500).json({ erro: 'Erro ao criar pedido.' });
  }
});

// GET /api/pedidos/:ticket -> consulta publica de status pelo numero do pedido
router.get('/pedidos/:ticket', (req, res) => {
  const pedido = db.buscarPedido(req.params.ticket);
  if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado.' });

  // So devolve o que o comprador precisa ver (nao expoe dados internos)
  res.json({
    ticket: pedido.id,
    produto: pedido.produtoNome,
    destinatario: pedido.nomeDestinatario,
    status: pedido.status,
    atualizadoEm: pedido.atualizadoEm
  });
});

// POST /api/pedidos/:ticket/simular-pagamento
// Endpoint SOMENTE PARA DEMONSTRACAO — simula o webhook do Inter chegando.
// Remover/desativar quando integrar a API real do Pix.
router.post('/pedidos/:ticket/simular-pagamento', (req, res) => {
  const pedido = db.buscarPedido(req.params.ticket);
  if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado.' });

  try {
    const atualizado = db.atualizarStatusPorTxid(pedido.pixTxid, 'pago');
    res.json({ ticket: atualizado.id, status: atualizado.status });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao simular pagamento.' });
  }
});

module.exports = router;
