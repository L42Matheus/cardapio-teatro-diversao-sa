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

// GET /api/categorias -> categorias exibidas nas abas da loja
router.get('/categorias', (req, res) => {
  res.json(db.listarCategorias());
});

// GET /api/estoque -> quantas vagas ainda restam no total (limite X geral)
router.get('/estoque', (req, res) => {
  res.json(db.estoqueDisponivel());
});

// POST /api/pedidos -> cria um novo pedido e gera a cobranca Pix
router.post('/pedidos', (req, res) => {
  const { produtoId, nomeComprador, contato, nomeDestinatario, equipeDestinatario } = req.body;

  if (!produtoId || !nomeComprador || !nomeDestinatario || !equipeDestinatario) {
    return res.status(400).json({ erro: 'Preencha produto, seu nome, nome e equipe de quem vai receber.' });
  }

  try {
    const pedido = db.criarPedido({ produtoId, nomeComprador, contato, nomeDestinatario, equipeDestinatario });
    const cobranca = criarCobrancaPix(pedido); // chamada (mock) a API Pix do Inter
    return res.status(201).json({
      ticket: pedido.codigo, // código público, ex: EAC-XK7B
      id: pedido.id,         // id interno (uso do admin), NÃO usar como consulta pública
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

// Aceita tanto o código público (EAC-XXXX) quanto o id numérico legado.
// A consulta pública deve usar o código; o id fica para o admin.
function acharPorTicket(param) {
  if (!param) return null;
  const bruto = String(param).trim();
  if (bruto.toUpperCase().startsWith('EAC-')) {
    return db.buscarPedidoPorCodigo(bruto);
  }
  if (/^\d+$/.test(bruto)) {
    return db.buscarPedido(bruto);
  }
  return db.buscarPedidoPorCodigo(bruto);
}

// GET /api/pedidos/:ticket -> consulta publica de status pelo codigo do pedido
router.get('/pedidos/:ticket', (req, res) => {
  const pedido = acharPorTicket(req.params.ticket);
  if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado.' });

  // So devolve o que o comprador precisa ver (nao expoe dados internos)
  res.json({
    ticket: pedido.codigo || String(pedido.id),
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
  const pedido = acharPorTicket(req.params.ticket);
  if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado.' });

  try {
    const atualizado = db.atualizarStatusPorTxid(pedido.pixTxid, 'pago');
    res.json({ ticket: atualizado.codigo || String(atualizado.id), status: atualizado.status });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao simular pagamento.' });
  }
});

module.exports = router;
