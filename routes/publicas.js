// routes/publicas.js
// Rotas que o site do comprador usa: ver produtos, criar pedido,
// consultar status pelo ticket (numero do pedido) e ver estoque restante.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { criarCobrancaPix } = require('../pix');

function nomeValido(nome) {
  return String(nome || '').trim().length >= 4;
}

function telefoneValido(contato) {
  const digitos = String(contato || '').replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11;
}

// GET /api/produtos -> lista produtos disponiveis para compra
router.get('/produtos', (req, res) => {
  res.json(db.listarProdutosAtivos());
});

// GET /api/categorias -> categorias exibidas nas abas da loja
router.get('/categorias', (req, res) => {
  res.json(db.listarCategorias());
});

// GET /api/status -> se os pedidos estao pausados (botao do panico do admin)
router.get('/status', (req, res) => {
  res.json(db.statusPedidos());
});

// POST /api/pedidos -> cria um novo pedido e gera a cobranca Pix
router.post('/pedidos', (req, res) => {
  const { produtoId, nomeComprador, contato, nomeDestinatario, equipeDestinatario } = req.body;
  const destinatarios = Array.isArray(req.body.destinatarios)
    ? req.body.destinatarios
        .map(d => ({
          nomeDestinatario: String(d.nomeDestinatario || '').trim(),
          equipeDestinatario: String(d.equipeDestinatario || '').trim(),
          anonimo: !!d.anonimo,
          mensagemEspecial: String(d.mensagemEspecial || '').trim().slice(0, 50)
        }))
        .filter(d => d.nomeDestinatario && d.equipeDestinatario)
    : null;

  if (!produtoId || !nomeComprador || (!destinatarios && (!nomeDestinatario || !equipeDestinatario))) {
    return res.status(400).json({ erro: 'Preencha produto, seu nome, nome e equipe de quem vai receber.' });
  }
  if (!nomeValido(nomeComprador)) {
    return res.status(400).json({ erro: 'Seu nome precisa ter pelo menos 4 caracteres.' });
  }
  if (!telefoneValido(contato)) {
    return res.status(400).json({ erro: 'Informe um WhatsApp valido com DDD.' });
  }
  if (destinatarios && destinatarios.length === 0) {
    return res.status(400).json({ erro: 'Adicione pelo menos uma pessoa para receber.' });
  }
  const destinatariosParaValidar = destinatarios || [{ nomeDestinatario, equipeDestinatario }];
  if (destinatariosParaValidar.some(d => !nomeValido(d.nomeDestinatario))) {
    return res.status(400).json({ erro: 'O nome de quem vai receber precisa ter pelo menos 4 caracteres.' });
  }

  try {
    const grupo = destinatarios
      ? db.criarPedidosMultiplos({ produtoId, nomeComprador, contato, destinatarios })
      : { pedidos: [db.criarPedido({ produtoId, nomeComprador, contato, nomeDestinatario, equipeDestinatario })] };

    const pedidoBase = destinatarios
      ? { codigo: grupo.codigo, pixTxid: grupo.pixTxid, valor: grupo.valor }
      : grupo.pedidos[0];
    const cobranca = criarCobrancaPix(pedidoBase); // chamada (mock) a API Pix do Inter
    return res.status(201).json({
      ticket: pedidoBase.codigo, // código público, ex: EAC-XK7B
      id: grupo.pedidos[0].id,   // id interno (uso do admin), NÃO usar como consulta pública
      status: grupo.pedidos[0].status,
      quantidade: grupo.pedidos.length,
      itens: grupo.pedidos.map(p => ({
        produto: p.produtoNome,
        destinatario: p.nomeDestinatario,
        equipe: p.equipeDestinatario,
        anonimo: !!p.anonimo,
        mensagemEspecial: p.mensagemEspecial || '',
        valor: p.valor
      })),
      pix: cobranca
    });
  } catch (err) {
    if (err.message === 'PEDIDOS_PAUSADOS') {
      return res.status(503).json({ erro: 'Os pedidos estao pausados no momento. Tente novamente em instantes.' });
    }
    if (err.message === 'PRODUTO_SEM_ESTOQUE') {
      return res.status(409).json({ erro: 'Este produto esta esgotado.' });
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
  const grupo = pedido.codigo ? db.listarPedidosPorCodigo(pedido.codigo) : [pedido];

  // So devolve o que o comprador precisa ver (nao expoe dados internos)
  res.json({
    ticket: pedido.codigo || String(pedido.id),
    produto: pedido.produtoNome,
    destinatario: pedido.nomeDestinatario,
    status: pedido.status,
    atualizadoEm: pedido.atualizadoEm,
    quantidade: grupo.length,
    itens: grupo.map(p => ({
      produto: p.produtoNome,
      destinatario: p.nomeDestinatario,
      equipe: p.equipeDestinatario,
      anonimo: !!p.anonimo,
      status: p.status
    }))
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
