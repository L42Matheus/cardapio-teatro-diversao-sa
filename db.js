// db.js
// Camada de dados do PROTOTIPO. Usa um arquivo JSON como banco de dados
// para nao depender de instalar/configurar PostgreSQL so para testar o fluxo.
// A estrutura das tabelas (produtos, pedidos, entregadores) foi pensada
// para migrar direto para PostgreSQL depois, sem mudar o resto do codigo
// (so troca-se a implementacao das funcoes abaixo).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function hashSenha(senha) {
  return crypto.createHash('sha256').update(String(senha)).digest('hex');
}

// Categorias oferecidas na loja do EAC. A ordem aqui define a ordem das abas
// que aparecem na tela de vendas.
// Ordem das abas e da listagem "Todos": trotes primeiro (carro-chefe),
// depois rosas, chocolates e botons.
const CATEGORIAS = [
  { id: 'trote',     nome: 'Trotes',     emoji: '💌' },
  { id: 'rosa',      nome: 'Rosas',      emoji: '🌹' },
  { id: 'chocolate', nome: 'Chocolates', emoji: '🍫' },
  { id: 'boton',     nome: 'Botons',     emoji: '📛' }
];

function estadoInicial() {
  return {
    config: {
      pedidosPausados: false
    },
    // Usuario admin fixo (usuario: teatro). Tem acesso total, incluindo
    // criar equipes e o botao do panico. Equipes criadas pelo admin entram
    // aqui com papel 'equipe'. A senha inicial e a mesma do usuario antigo
    // ('neymar') — pra ficar consistente com o que ja esta em producao.
    usuarios: [
      { id: 1, usuario: 'teatro', senhaHash: hashSenha('neymar'), papel: 'admin', nome: 'Admin' }
    ],
    proximoUsuarioId: 2,
    // Estoque por produto (editavel apenas pelo admin, no painel). Ajuste os
    // valores iniciais abaixo conforme a quantidade real disponivel.
    produtos: [
      // ----- Trotes (carro-chefe — nomes fictícios, ajustar com a equipe) -----
      { id: 7,  categoria: 'trote',     nome: 'Trote do Anjo da Guarda', preco: 4.00, foto: '/uploads/produtos/trote-anjo.svg',
        descricao: 'Um "anjinho" surpresa entrega uma mensagem carinhosa.', ativo: true, estoque: 30 },
      { id: 8,  categoria: 'trote',     nome: 'Serenata do Coração',     preco: 5.00, foto: '/uploads/produtos/trote-serenata.svg',
        descricao: 'A pessoa recebe uma canção ao vivo dos servos.', ativo: true, estoque: 30 },
      { id: 9,  categoria: 'trote',     nome: 'Missão Fraterna',         preco: 3.00, foto: '/uploads/produtos/trote-missao.svg',
        descricao: 'Um bilhete anônimo com uma oração é entregue à pessoa.', ativo: true, estoque: 30 },
      { id: 10, categoria: 'trote',     nome: 'Abraço em Cristo',        preco: 4.00, foto: '/uploads/produtos/trote-abraco.svg',
        descricao: 'Um grupo de servos vai até a pessoa entregar um abraço coletivo.', ativo: true, estoque: 30 },
      { id: 11, categoria: 'trote',     nome: 'Dança da Alegria',        preco: 6.00, foto: '/uploads/produtos/trote-danca.svg',
        descricao: 'Mini apresentação de dança feita para alegrar o encontrista.', ativo: true, estoque: 30 },

      // ----- Rosas -----
      { id: 1,  categoria: 'rosa',      nome: 'Rosa Única',           preco: 5.00, foto: '/uploads/produtos/rosa.svg',
        descricao: 'Uma rosa vermelha entregue com carinho para quem você escolher.', ativo: true, estoque: 30 },
      { id: 2,  categoria: 'rosa',      nome: 'Buquê de 3 Rosas',     preco: 7.00, foto: '/uploads/produtos/buque.svg',
        descricao: 'Buquê com três rosas para uma surpresa especial.', ativo: true, estoque: 30 },

      // ----- Chocolates -----
      { id: 3,  categoria: 'chocolate', nome: 'Chocolate com Rosa',   preco: 7.00, foto: '/uploads/produtos/chocolate.svg',
        descricao: 'Uma barra de chocolate acompanhada de uma rosa.', ativo: true, estoque: 30 },
      { id: 4,  categoria: 'chocolate', nome: 'Chocolate Coração',    preco: 5.00, foto: '/uploads/produtos/chocolate-coracao.svg',
        descricao: 'Chocolate em formato de coração para adoçar o encontro.', ativo: true, estoque: 30 },

      // ----- Botons -----
      { id: 5,  categoria: 'boton',     nome: 'Boton EAC',            preco: 3.00, foto: '/uploads/produtos/boton.svg',
        descricao: 'Boton oficial do EAC Santo Antônio.', ativo: true, estoque: 30 },
      { id: 6,  categoria: 'boton',     nome: 'Kit 3 Botons',         preco: 7.00, foto: '/uploads/produtos/boton-kit.svg',
        descricao: 'Trio de botons coloridos do EAC.', ativo: true, estoque: 30 }
    ],
    entregadores: [
      { id: 1, nome: 'Equipe Trote 1' },
      { id: 2, nome: 'Equipe Trote 2' }
    ],
    pedidos: [],
    proximoPedidoId: 1
  };
}

function carregar() {
  if (!fs.existsSync(DB_PATH)) {
    salvar(estadoInicial());
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const dados = JSON.parse(raw);
  aplicarMigracoes(dados);
  return dados;
}

// Migracoes leves aplicadas a bancos ja existentes. Rodam a cada carga
// mas so alteram/salvam se ainda nao foram aplicadas — idempotentes.
function aplicarMigracoes(dados) {
  let alterou = false;

  // Bancos antigos (anteriores ao suporte a login) nao tem 'usuarios'.
  if (!Array.isArray(dados.usuarios)) {
    dados.usuarios = [
      { id: 1, usuario: 'teatro', senhaHash: hashSenha('neymar'), papel: 'admin', nome: 'Admin' }
    ];
    dados.proximoUsuarioId = dados.proximoUsuarioId || 2;
    alterou = true;
  } else {
    // Renomeia o antigo admin "neymar" -> "teatro" mantendo a mesma senha.
    const antigoAdmin = dados.usuarios.find(u => u.usuario === 'neymar' && u.papel === 'admin');
    if (antigoAdmin) {
      antigoAdmin.usuario = 'teatro';
      alterou = true;
    }
  }

  if (alterou) salvar(dados);
}

function salvar(dados) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2), 'utf-8');
}

// ---- Produtos ----

function listarProdutosAtivos() {
  const dados = carregar();
  return dados.produtos.filter(p => p.ativo);
}

function buscarProduto(id) {
  const dados = carregar();
  return dados.produtos.find(p => p.id === Number(id));
}

// Lista completa (inclui inativos), usada no painel admin pra editar estoque.
function listarProdutosAdmin() {
  const dados = carregar();
  return dados.produtos;
}

function atualizarEstoque(produtoId, novoEstoque) {
  const dados = carregar();
  const produto = dados.produtos.find(p => p.id === Number(produtoId));
  if (!produto) throw new Error('PRODUTO_INVALIDO');

  const valor = Number(novoEstoque);
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error('ESTOQUE_INVALIDO');
  }

  produto.estoque = valor;
  salvar(dados);
  return produto;
}

// ---- Botão do pânico (pausa imediata de novos pedidos) ----

function statusPedidos() {
  const dados = carregar();
  return { pausado: !!dados.config.pedidosPausados };
}

function pausarPedidos() {
  const dados = carregar();
  dados.config.pedidosPausados = true;
  salvar(dados);
  return statusPedidos();
}

function retomarPedidos() {
  const dados = carregar();
  dados.config.pedidosPausados = false;
  salvar(dados);
  return statusPedidos();
}

// ---- Pedidos ----

// Gera um código público curto, tipo "EAC-XK7B", para o comprador consultar
// o pedido. Evita usar o id sequencial (1, 2, 3...) que qualquer um adivinha.
// Sem caracteres ambíguos (0/O, 1/I) para ficar fácil de ditar por voz.
function gerarCodigoPedido(dados) {
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existentes = new Set(dados.pedidos.map(p => p.codigo).filter(Boolean));
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    let codigo = 'EAC-';
    for (let i = 0; i < 4; i++) {
      codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    }
    if (!existentes.has(codigo)) return codigo;
  }
  // Fallback praticamente impossível: adiciona sufixo com timestamp.
  return `EAC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function criarPedido({ produtoId, nomeComprador, contato, nomeDestinatario, equipeDestinatario }) {
  const dados = carregar();

  if (dados.config.pedidosPausados) {
    throw new Error('PEDIDOS_PAUSADOS');
  }

  const produto = dados.produtos.find(p => p.id === Number(produtoId) && p.ativo);
  if (!produto) {
    throw new Error('PRODUTO_INVALIDO');
  }
  if (produto.estoque <= 0) {
    throw new Error('PRODUTO_SEM_ESTOQUE');
  }

  const id = dados.proximoPedidoId++;
  const codigo = gerarCodigoPedido(dados);
  const pedido = {
    id,
    codigo,
    produtoId: produto.id,
    produtoNome: produto.nome,
    categoria: produto.categoria || null,
    valor: produto.preco,
    nomeComprador,
    contato,
    nomeDestinatario,
    equipeDestinatario: equipeDestinatario || null,
    status: 'pendente_pagamento', // pendente_pagamento -> pago -> aguardando -> entregue (ou cancelado)
    pixTxid: `TXID-${id}-${Date.now()}`,
    entregadorId: null,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  produto.estoque -= 1;
  dados.pedidos.push(pedido);
  salvar(dados);
  return pedido;
}

function buscarPedido(id) {
  const dados = carregar();
  return dados.pedidos.find(p => p.id === Number(id));
}

function buscarPedidoPorTxid(txid) {
  const dados = carregar();
  return dados.pedidos.find(p => p.pixTxid === txid);
}

function buscarPedidoPorCodigo(codigo) {
  if (!codigo) return null;
  const alvo = String(codigo).trim().toUpperCase();
  const dados = carregar();
  return dados.pedidos.find(p => (p.codigo || '').toUpperCase() === alvo);
}

function listarPedidos() {
  const dados = carregar();
  return dados.pedidos;
}

function atualizarStatusPorTxid(txid, novoStatus) {
  const dados = carregar();
  const pedido = dados.pedidos.find(p => p.pixTxid === txid);
  if (!pedido) throw new Error('PEDIDO_NAO_ENCONTRADO');
  pedido.status = novoStatus;
  pedido.atualizadoEm = new Date().toISOString();
  salvar(dados);
  return pedido;
}

function atribuirEntregador(pedidoId, entregadorId) {
  const dados = carregar();
  const pedido = dados.pedidos.find(p => p.id === Number(pedidoId));
  if (!pedido) throw new Error('PEDIDO_NAO_ENCONTRADO');
  if (pedido.status !== 'pago' && pedido.status !== 'aguardando') {
    throw new Error('PEDIDO_AINDA_NAO_PAGO');
  }
  const entregador = dados.entregadores.find(e => e.id === Number(entregadorId));
  if (!entregador) throw new Error('ENTREGADOR_INVALIDO');

  pedido.entregadorId = entregador.id;
  pedido.status = 'aguardando';
  pedido.atualizadoEm = new Date().toISOString();
  salvar(dados);
  return pedido;
}

// Tempo (ms) que uma reserva ("peguei") dura antes de expirar sozinha,
// liberando o pedido pra outra equipe. Evita pedidos "presos" quando
// uma equipe clica em "Peguei" e esquece.
const RESERVA_TTL_MS = 10 * 60 * 1000; // 10 minutos

function reservaEstaAtiva(pedido) {
  if (!pedido.claimedBy || !pedido.claimedAt) return false;
  return (Date.now() - new Date(pedido.claimedAt).getTime()) < RESERVA_TTL_MS;
}

function pegarPedido(pedidoId, equipe) {
  if (!equipe) throw new Error('EQUIPE_OBRIGATORIA');
  const dados = carregar();
  const pedido = dados.pedidos.find(p => p.id === Number(pedidoId));
  if (!pedido) throw new Error('PEDIDO_NAO_ENCONTRADO');
  if (pedido.status !== 'pago' && pedido.status !== 'aguardando') {
    throw new Error('PEDIDO_NAO_DISPONIVEL');
  }
  if (pedido.claimedBy && pedido.claimedBy !== equipe && reservaEstaAtiva(pedido)) {
    throw new Error('PEDIDO_JA_PEGO');
  }
  pedido.claimedBy = equipe;
  pedido.claimedAt = new Date().toISOString();
  pedido.status = 'aguardando';
  pedido.atualizadoEm = new Date().toISOString();
  salvar(dados);
  return pedido;
}

function liberarPedido(pedidoId, equipe, forcado) {
  const dados = carregar();
  const pedido = dados.pedidos.find(p => p.id === Number(pedidoId));
  if (!pedido) throw new Error('PEDIDO_NAO_ENCONTRADO');
  if (pedido.status === 'entregue') throw new Error('PEDIDO_JA_ENTREGUE');
  if (pedido.claimedBy && pedido.claimedBy !== equipe && !forcado && reservaEstaAtiva(pedido)) {
    throw new Error('PEDIDO_NAO_SEU');
  }
  pedido.claimedBy = null;
  pedido.claimedAt = null;
  pedido.status = 'pago';
  pedido.atualizadoEm = new Date().toISOString();
  salvar(dados);
  return pedido;
}

function marcarEntregue(pedidoId, equipe) {
  const dados = carregar();
  const pedido = dados.pedidos.find(p => p.id === Number(pedidoId));
  if (!pedido) throw new Error('PEDIDO_NAO_ENCONTRADO');
  if (pedido.status !== 'pago' && pedido.status !== 'aguardando') {
    throw new Error('PEDIDO_NAO_PAGO');
  }
  // Se está reservado por outra equipe (ativa), bloqueia — evita
  // duas equipes marcarem entregue ao mesmo tempo.
  if (equipe && pedido.claimedBy && pedido.claimedBy !== equipe && reservaEstaAtiva(pedido)) {
    throw new Error('PEDIDO_DE_OUTRA_EQUIPE');
  }
  pedido.status = 'entregue';
  pedido.equipeEntregou = equipe || pedido.claimedBy || null;
  pedido.atualizadoEm = new Date().toISOString();
  salvar(dados);
  return pedido;
}

function listarEntregadores() {
  const dados = carregar();
  return dados.entregadores;
}

function listarCategorias() {
  return CATEGORIAS;
}

// ---- Usuarios / autenticacao ----
// Papeis: 'admin' (usuario teatro, fixo) e 'equipe' (criados pelo admin).

function sanitizarUsuario(u) {
  return { id: u.id, usuario: u.usuario, nome: u.nome, papel: u.papel };
}

function listarUsuarios() {
  const dados = carregar();
  return dados.usuarios.map(sanitizarUsuario);
}

function autenticarUsuario(usuario, senha) {
  if (!usuario || !senha) return null;
  const dados = carregar();
  const alvo = String(usuario).trim().toLowerCase();
  const user = dados.usuarios.find(u => u.usuario.toLowerCase() === alvo);
  if (!user || user.senhaHash !== hashSenha(senha)) return null;
  return sanitizarUsuario(user);
}

function criarUsuario({ usuario, senha, nome }) {
  if (!usuario || !usuario.trim()) throw new Error('USUARIO_OBRIGATORIO');
  if (!senha || !senha.trim()) throw new Error('SENHA_OBRIGATORIA');

  const dados = carregar();
  const alvo = usuario.trim().toLowerCase();
  if (dados.usuarios.some(u => u.usuario.toLowerCase() === alvo)) {
    throw new Error('USUARIO_JA_EXISTE');
  }

  const novo = {
    id: dados.proximoUsuarioId++,
    usuario: usuario.trim(),
    senhaHash: hashSenha(senha),
    papel: 'equipe',
    nome: (nome && nome.trim()) || usuario.trim()
  };
  dados.usuarios.push(novo);
  salvar(dados);
  return sanitizarUsuario(novo);
}

function removerUsuario(id) {
  const dados = carregar();
  const user = dados.usuarios.find(u => u.id === Number(id));
  if (!user) throw new Error('USUARIO_NAO_ENCONTRADO');
  if (user.papel === 'admin') throw new Error('ADMIN_NAO_REMOVIVEL');
  dados.usuarios = dados.usuarios.filter(u => u.id !== Number(id));
  salvar(dados);
}

module.exports = {
  listarProdutosAtivos,
  buscarProduto,
  listarProdutosAdmin,
  atualizarEstoque,
  statusPedidos,
  pausarPedidos,
  retomarPedidos,
  criarPedido,
  buscarPedido,
  buscarPedidoPorTxid,
  buscarPedidoPorCodigo,
  listarPedidos,
  atualizarStatusPorTxid,
  atribuirEntregador,
  pegarPedido,
  liberarPedido,
  marcarEntregue,
  listarEntregadores,
  listarCategorias,
  listarUsuarios,
  autenticarUsuario,
  criarUsuario,
  removerUsuario
};
