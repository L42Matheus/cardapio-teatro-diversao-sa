// routes/admin.js
// Rotas usadas pelo painel do administrador e das equipes.
//
// Autenticacao por usuario/senha (POST /login), com token de sessao em
// memoria (perdido se o servidor reiniciar — aceitavel pro porte do evento).
// Papel 'admin' (usuario fixo "teatro") tem acesso a tudo. Papel 'equipe'
// (criado pelo admin em /usuarios) tem acesso a tudo, EXCETO criar/remover
// usuarios e o botao do panico.

const router = require('./router')();
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

async function equipeOperacao(req) {
  if (req.usuarioAtual.papel !== 'admin') return req.usuarioAtual.nome;

  const nome = String((req.body && req.body.equipeOperacao) || '').trim();
  const entregadores = await db.listarEntregadores();
  const equipes = entregadores.map(e => e.nome);
  if (!nome || !equipes.includes(nome)) {
    throw new Error('EQUIPE_OBRIGATORIA');
  }
  return nome;
}

// POST /api/admin/login { usuario, senha } -> rota publica
router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body || {};
  const user = await db.autenticarUsuario(usuario, senha);
  if (!user) {
    return res.status(401).json({ erro: 'Usuario ou senha invalidos.' });
  }
  const token = gerarToken();
  sessoes.set(token, { usuarioId: user.id, usuario: user.usuario, nome: user.nome, papel: user.papel, criadoEm: Date.now() });
  res.json({ token, usuario: user.usuario, nome: user.nome, papel: user.papel });
});

// A partir daqui, todas as rotas exigem login.
router.use(autenticar);

// A conta da Policia so usa a pagina /prisao: fora /me, /logout e /prisao/*,
// nada do painel (pedidos, estoque, relatorio...) fica disponivel para ela.
router.use((req, res, next) => {
  if (req.usuarioAtual.papel !== 'policia') return next();
  if (req.path === '/me' || req.path === '/logout' || req.path.startsWith('/prisao/')) return next();
  res.status(403).json({ erro: 'A conta da Polícia só acessa a página da prisão.' });
});

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
router.get('/usuarios', exigirAdmin, async (req, res) => {
  res.json(await db.listarUsuarios());
});

// POST /api/admin/usuarios { usuario, senha, nome } -> cria uma equipe nova
router.post('/usuarios', exigirAdmin, async (req, res) => {
  const { usuario, senha, nome } = req.body || {};
  try {
    const novo = await db.criarUsuario({ usuario, senha, nome });
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
router.delete('/usuarios/:id', exigirAdmin, async (req, res) => {
  try {
    await db.removerUsuario(req.params.id);
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
router.get('/produtos', exigirAdmin, async (req, res) => {
  res.json(await db.listarProdutosAdmin());
});

const ERROS_PRODUTO = {
  PRODUTO_INVALIDO: [404, 'Produto nao encontrado.'],
  ESTOQUE_INVALIDO: [400, 'Estoque invalido: informe um numero inteiro (0 ou mais).'],
  PRECO_INVALIDO: [400, 'Preco invalido: informe um valor entre R$ 0,01 e R$ 1.000,00.'],
  NADA_PARA_ATUALIZAR: [400, 'Informe o preco e/ou o estoque.']
};

function responderErroProduto(res, err) {
  const [codigo, msg] = ERROS_PRODUTO[err.message] || [500, 'Erro ao atualizar produto.'];
  res.status(codigo).json({ erro: msg });
}

// PUT /api/admin/produtos/:id { preco?, estoque? } -> altera preco e/ou estoque
router.put('/produtos/:id', exigirAdmin, async (req, res) => {
  const { preco, estoque } = req.body || {};
  try {
    res.json(await db.atualizarProduto(req.params.id, { preco, estoque }));
  } catch (err) {
    responderErroProduto(res, err);
  }
});

// PUT /api/admin/produtos/:id/estoque { estoque }
router.put('/produtos/:id/estoque', exigirAdmin, async (req, res) => {
  const { estoque } = req.body || {};
  try {
    res.json(await db.atualizarEstoque(req.params.id, estoque));
  } catch (err) {
    responderErroProduto(res, err);
  }
});

// ---- Botão do pânico (somente admin) ----

// GET /api/admin/status -> estado atual do botao do panico
router.get('/status', exigirAdmin, async (req, res) => {
  res.json(await db.statusPedidos());
});

// POST /api/admin/panico { ativar } -> liga/desliga o botao do panico,
// pausando ou retomando a criacao de novos pedidos no site principal
router.post('/panico', exigirAdmin, async (req, res) => {
  const { ativar } = req.body || {};
  const status = ativar ? await db.pausarPedidos() : await db.retomarPedidos();
  res.json(status);
});

// ---- Pedidos (admin + equipes) ----

// GET /api/admin/pedidos -> lista todos os pedidos, mais recentes primeiro
// (as equipes de entrega nao recebem os pedidos de prisao: quem cuida
// deles e a Policia, na pagina /prisao; o admin continua vendo tudo).
router.get('/pedidos', async (req, res) => {
  let pedidos = (await db.listarPedidos()).slice().sort((a, b) => b.id - a.id);
  if (req.usuarioAtual.papel !== 'admin') pedidos = pedidos.filter(p => p.categoria !== 'prisao');
  res.json(pedidos);
});

// GET /api/admin/entregadores -> lista os 2 entregadores
router.get('/entregadores', async (req, res) => {
  res.json(await db.listarEntregadores());
});

// POST /api/admin/pedidos/:id/atribuir { entregadorId }
router.post('/pedidos/:id/atribuir', async (req, res) => {
  const { entregadorId } = req.body;
  try {
    const pedido = await db.atribuirEntregador(req.params.id, entregadorId);
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
router.post('/pedidos/:id/pegar', async (req, res) => {
  try {
    const equipe = await equipeOperacao(req);
    const pedido = await db.pegarPedido(req.params.id, equipe);
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
router.post('/pedidos/:id/liberar', async (req, res) => {
  const { forcado } = req.body || {};
  try {
    const equipe = await equipeOperacao(req);
    const pedido = await db.liberarPedido(req.params.id, equipe, !!forcado);
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
router.post('/pedidos/:id/entregar', async (req, res) => {
  try {
    const equipe = await equipeOperacao(req);
    const pedido = await db.marcarEntregue(req.params.id, equipe);
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

// POST /api/admin/pedidos/:id/simular-pagamento -> marca manualmente como
// pago, sem passar pela Efi. Somente admin (nao equipe). Uso: corrigir um
// pedido cujo pagamento caiu mas o webhook nao chegou, ou testar o fluxo.
router.post('/pedidos/:id/simular-pagamento', exigirAdmin, async (req, res) => {
  const pedido = await db.buscarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido nao encontrado.' });

  try {
    const atualizado = await db.atualizarStatusPorTxid(pedido.pixTxid, 'pago', {
      origem: 'manual',
      valor: pedido.valor
    });
    res.json(atualizado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao marcar pedido como pago.' });
  }
});

// POST /api/admin/pedidos/arquivar-todos { confirmacao: 'APAGAR' } -> tira
// todos os pedidos do painel (move para pedidos_arquivados). Somente admin.
// Uso: limpar os pedidos de teste antes do evento. O estoque nao muda.
router.post('/pedidos/arquivar-todos', exigirAdmin, async (req, res) => {
  const { confirmacao } = req.body || {};
  if (confirmacao !== 'APAGAR') {
    return res.status(400).json({ erro: 'Digite APAGAR para confirmar.' });
  }
  try {
    const total = await db.arquivarTodosPedidos();
    res.json({ arquivados: total });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao limpar os pedidos.' });
  }
});

// ---- Prisao (pagina /prisao: conta da Policia e admin) ----

function exigirPolicia(req, res, next) {
  if (req.usuarioAtual.papel !== 'policia' && req.usuarioAtual.papel !== 'admin') {
    return res.status(403).json({ erro: 'Apenas a Polícia pode fazer isso.' });
  }
  next();
}

// So o que a Policia precisa para achar a pessoa. Quem pediu a prisao
// aparece como "denunciante", a menos que tenha pedido anonimato.
function mandadoParaPolicia(p) {
  return {
    id: p.id,
    codigo: p.codigo,
    crime: p.produtoNome,
    nome: p.nomeDestinatario,
    equipe: p.equipeDestinatario,
    denunciante: p.anonimo ? null : p.nomeComprador,
    mensagem: p.mensagemEspecial || null,
    preso: p.status === 'entregue',
    criadoEm: p.criadoEm,
    presoEm: p.status === 'entregue' ? p.atualizadoEm : null
  };
}

// GET /api/admin/prisao/mandados -> procurados e presos
router.get('/prisao/mandados', exigirPolicia, async (req, res) => {
  const mandados = await db.listarMandadosPrisao();
  res.json(mandados.map(mandadoParaPolicia));
});

// POST /api/admin/prisao/mandados/:id/capturar -> a pessoa foi presa: conta
// como entregue (pela "Polícia") no painel e no resumo.
router.post('/prisao/mandados/:id/capturar', exigirPolicia, async (req, res) => {
  const pedido = await db.buscarPedido(req.params.id);
  if (!pedido || pedido.categoria !== 'prisao') {
    return res.status(404).json({ erro: 'Mandado não encontrado.' });
  }
  if (pedido.status === 'entregue') {
    return res.status(409).json({ erro: 'Essa pessoa já foi presa.' });
  }
  try {
    const atualizado = await db.marcarEntregue(pedido.id, 'Polícia');
    res.json(mandadoParaPolicia(atualizado));
  } catch (err) {
    const mapa = { PEDIDO_NAO_PAGO: [409, 'Esse mandado ainda não foi pago.'] };
    const [codigo, msg] = mapa[err.message] || [500, 'Erro ao registrar a prisão.'];
    res.status(codigo).json({ erro: msg });
  }
});

module.exports = router;
