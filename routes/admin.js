// routes/admin.js
// Rotas usadas pelo painel do administrador e das equipes.
//
// Autenticacao por usuario/senha (POST /login), com token de sessao em
// memoria (perdido se o servidor reiniciar — aceitavel pro porte do evento).
// Papel 'admin' (usuario fixo "teatro") tem acesso a tudo. Papel 'equipe'
// (criado pelo admin em /usuarios) tem acesso a tudo, EXCETO criar/remover
// usuarios e o botao do panico.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

const SESSAO_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
const sessoes = new Map(); // token -> { usuarioId, usuario, nome, papel, criadoEm }

function gerarToken() {
  return crypto.randomBytes(24).toString('hex');
}

function sessaoValida(sessao) {
  return !!sessao && (Date.now() - sessao.criadoEm) < SESSAO_TTL_MS;
}

function autenticar(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const sessao = token ? sessoes.get(token) : null;

  if (!sessaoValida(sessao)) {
    if (token) sessoes.delete(token);
    return res.status(401).json({ erro: 'Sessao invalida ou expirada. Faca login novamente.' });
  }

  req.usuarioAtual = sessao;
  req.token = token;
  next();
}

function exigirAdmin(req, res, next) {
  if (req.usuarioAtual.papel !== 'admin') {
    return res.status(403).json({ erro: 'Apenas o admin pode fazer isso.' });
  }
  next();
}

function equipeOperacao(req) {
  if (req.usuarioAtual.papel !== 'admin') return req.usuarioAtual.nome;

  const nome = String((req.body && req.body.equipeOperacao) || '').trim();
  const equipes = db.listarEntregadores().map(e => e.nome);
  if (!nome || !equipes.includes(nome)) {
    throw new Error('EQUIPE_OBRIGATORIA');
  }
  return nome;
}

// POST /api/admin/login { usuario, senha } -> rota publica
router.post('/login', (req, res) => {
  const { usuario, senha } = req.body || {};
  const user = db.autenticarUsuario(usuario, senha);
  if (!user) {
    return res.status(401).json({ erro: 'Usuario ou senha invalidos.' });
  }
  const token = gerarToken();
  sessoes.set(token, { usuarioId: user.id, usuario: user.usuario, nome: user.nome, papel: user.papel, criadoEm: Date.now() });
  res.json({ token, usuario: user.usuario, nome: user.nome, papel: user.papel });
});

// A partir daqui, todas as rotas exigem login.
router.use(autenticar);

// POST /api/admin/logout
router.post('/logout', (req, res) => {
  sessoes.delete(req.token);
  res.json({ ok: true });
});

// GET /api/admin/me -> dados do usuario logado (usado pra validar sessao salva)
router.get('/me', (req, res) => {
  res.json({ usuario: req.usuarioAtual.usuario, nome: req.usuarioAtual.nome, papel: req.usuarioAtual.papel });
});

// ---- Gestao de equipes (somente admin) ----

// GET /api/admin/usuarios -> lista admin + equipes
router.get('/usuarios', exigirAdmin, (req, res) => {
  res.json(db.listarUsuarios());
});

// POST /api/admin/usuarios { usuario, senha, nome } -> cria uma equipe nova
router.post('/usuarios', exigirAdmin, (req, res) => {
  const { usuario, senha, nome } = req.body || {};
  try {
    const novo = db.criarUsuario({ usuario, senha, nome });
    res.status(201).json(novo);
  } catch (err) {
    const mapa = {
      USUARIO_OBRIGATORIO: [400, 'Informe o usuario da equipe.'],
      SENHA_OBRIGATORIA:   [400, 'Informe a senha da equipe.'],
      USUARIO_JA_EXISTE:   [409, 'Ja existe uma equipe com esse usuario.']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao criar equipe.'];
    res.status(codigo).json({ erro: msg });
  }
});

// DELETE /api/admin/usuarios/:id -> remove uma equipe (nao remove o admin)
router.delete('/usuarios/:id', exigirAdmin, (req, res) => {
  try {
    db.removerUsuario(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    const mapa = {
      USUARIO_NAO_ENCONTRADO: [404, 'Equipe nao encontrada.'],
      ADMIN_NAO_REMOVIVEL:    [400, 'Nao e possivel remover o usuario admin.']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao remover equipe.'];
    res.status(codigo).json({ erro: msg });
  }
});

// ---- Estoque dos produtos (somente admin) ----

// GET /api/admin/produtos -> lista todos os produtos com estoque
router.get('/produtos', exigirAdmin, (req, res) => {
  res.json(db.listarProdutosAdmin());
});

// PUT /api/admin/produtos/:id/estoque { estoque }
router.put('/produtos/:id/estoque', exigirAdmin, (req, res) => {
  const { estoque } = req.body || {};
  try {
    const produto = db.atualizarEstoque(req.params.id, estoque);
    res.json(produto);
  } catch (err) {
    const mapa = {
      PRODUTO_INVALIDO: [404, 'Produto nao encontrado.'],
      ESTOQUE_INVALIDO: [400, 'Informe um numero valido (0 ou mais).']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao atualizar estoque.'];
    res.status(codigo).json({ erro: msg });
  }
});

// ---- Botão do pânico (somente admin) ----

// GET /api/admin/status -> estado atual do botao do panico
router.get('/status', exigirAdmin, (req, res) => {
  res.json(db.statusPedidos());
});

// POST /api/admin/panico { ativar } -> liga/desliga o botao do panico,
// pausando ou retomando a criacao de novos pedidos no site principal
router.post('/panico', exigirAdmin, (req, res) => {
  const { ativar } = req.body || {};
  const status = ativar ? db.pausarPedidos() : db.retomarPedidos();
  res.json(status);
});

// ---- Pedidos (admin + equipes) ----

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

// POST /api/admin/pedidos/:id/pegar -> reserva o pedido pra equipe logada
router.post('/pedidos/:id/pegar', (req, res) => {
  try {
    const pedido = db.pegarPedido(req.params.id, equipeOperacao(req));
    res.json(pedido);
  } catch (err) {
    const mapa = {
      PEDIDO_NAO_ENCONTRADO:  [404, 'Pedido nao encontrado.'],
      PEDIDO_NAO_DISPONIVEL:  [409, 'Pedido nao esta disponivel para ser pego.'],
      PEDIDO_JA_PEGO:         [409, 'Este pedido ja foi pego por outra equipe.'],
      EQUIPE_OBRIGATORIA:     [400, 'Escolha a equipe de entrega antes de pegar o pedido.']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao pegar o pedido.'];
    res.status(codigo).json({ erro: msg });
  }
});

// POST /api/admin/pedidos/:id/liberar { forcado } -> libera a reserva
router.post('/pedidos/:id/liberar', (req, res) => {
  const { forcado } = req.body || {};
  try {
    const pedido = db.liberarPedido(req.params.id, equipeOperacao(req), !!forcado);
    res.json(pedido);
  } catch (err) {
    const mapa = {
      PEDIDO_NAO_ENCONTRADO: [404, 'Pedido nao encontrado.'],
      PEDIDO_JA_ENTREGUE:    [409, 'Pedido ja foi entregue.'],
      PEDIDO_NAO_SEU:        [409, 'Este pedido esta com outra equipe.'],
      EQUIPE_OBRIGATORIA:    [400, 'Escolha a equipe de entrega antes de liberar o pedido.']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao liberar o pedido.'];
    res.status(codigo).json({ erro: msg });
  }
});

// POST /api/admin/pedidos/:id/entregar -> marca como entregue
router.post('/pedidos/:id/entregar', (req, res) => {
  try {
    const pedido = db.marcarEntregue(req.params.id, equipeOperacao(req));
    res.json(pedido);
  } catch (err) {
    const mapa = {
      PEDIDO_NAO_ENCONTRADO:   [404, 'Pedido nao encontrado.'],
      PEDIDO_NAO_PAGO:         [409, 'Pedido precisa estar pago para ser marcado como entregue.'],
      PEDIDO_DE_OUTRA_EQUIPE:  [409, 'Este pedido esta reservado por outra equipe.'],
      EQUIPE_OBRIGATORIA:      [400, 'Escolha a equipe de entrega antes de marcar como entregue.']
    };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao marcar como entregue.'];
    res.status(codigo).json({ erro: msg });
  }
});

module.exports = router;
