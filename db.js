// db.js
// Camada de dados do PROTOTIPO. Usa um arquivo JSON como banco de dados
// para nao depender de instalar/configurar PostgreSQL so para testar o fluxo.
// A estrutura das tabelas (produtos, pedidos, entregadores) foi pensada
// para migrar direto para PostgreSQL depois, sem mudar o resto do codigo
// (so troca-se a implementacao das funcoes abaixo).

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

const LIMITE_TOTAL_PEDIDOS = 100; // <-- ajuste aqui o X (limite geral de compras do evento)

function estadoInicial() {
  return {
    config: {
      limiteTotal: LIMITE_TOTAL_PEDIDOS
    },
    produtos: [
      { id: 1, nome: 'Produto 1', preco: 15.0, foto: '/uploads/produtos/produto1.svg', ativo: true },
      { id: 2, nome: 'Produto 2', preco: 20.0, foto: '/uploads/produtos/produto2.svg', ativo: true },
      { id: 3, nome: 'Produto 3', preco: 10.0, foto: '/uploads/produtos/produto3.svg', ativo: true }
    ],
    entregadores: [
      { id: 1, nome: 'Entregador 1' },
      { id: 2, nome: 'Entregador 2' }
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
  return JSON.parse(raw);
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

// ---- Estoque global (limite X de compras no total) ----

function contarPedidosValidos(dados) {
  // Pedidos cancelados (ex: pagamento expirou) nao contam contra o limite.
  return dados.pedidos.filter(p => p.status !== 'cancelado').length;
}

function estoqueDisponivel() {
  const dados = carregar();
  const usados = contarPedidosValidos(dados);
  return {
    limiteTotal: dados.config.limiteTotal,
    usados,
    disponiveis: Math.max(0, dados.config.limiteTotal - usados)
  };
}

// ---- Pedidos ----

function criarPedido({ produtoId, nomeComprador, contato, nomeDestinatario }) {
  const dados = carregar();

  const usados = contarPedidosValidos(dados);
  if (usados >= dados.config.limiteTotal) {
    throw new Error('ESTOQUE_ESGOTADO');
  }

  const produto = dados.produtos.find(p => p.id === Number(produtoId) && p.ativo);
  if (!produto) {
    throw new Error('PRODUTO_INVALIDO');
  }

  const id = dados.proximoPedidoId++;
  const pedido = {
    id,
    produtoId: produto.id,
    produtoNome: produto.nome,
    valor: produto.preco,
    nomeComprador,
    contato,
    nomeDestinatario,
    status: 'pendente_pagamento', // pendente_pagamento -> pago -> aguardando -> entregue (ou cancelado)
    pixTxid: `TXID-${id}-${Date.now()}`,
    entregadorId: null,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

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

function marcarEntregue(pedidoId) {
  const dados = carregar();
  const pedido = dados.pedidos.find(p => p.id === Number(pedidoId));
  if (!pedido) throw new Error('PEDIDO_NAO_ENCONTRADO');
  if (pedido.status !== 'aguardando') {
    throw new Error('PEDIDO_NAO_ESTA_AGUARDANDO');
  }
  pedido.status = 'entregue';
  pedido.atualizadoEm = new Date().toISOString();
  salvar(dados);
  return pedido;
}

function listarEntregadores() {
  const dados = carregar();
  return dados.entregadores;
}

module.exports = {
  listarProdutosAtivos,
  buscarProduto,
  estoqueDisponivel,
  criarPedido,
  buscarPedido,
  buscarPedidoPorTxid,
  listarPedidos,
  atualizarStatusPorTxid,
  atribuirEntregador,
  marcarEntregue,
  listarEntregadores
};
