// db.js
// Camada de dados — PostgreSQL via pool de conexoes (pg). Requer DATABASE_URL
// no ambiente (local: Postgres embutido via `npm run db:local`; producao:
// addon Postgres do Railway).
//
// Operacoes que envolvem estoque ou reserva de pedido usam transacao com
// "SELECT ... FOR UPDATE" pra travar a linha e evitar condicao de corrida
// (ex: dois compradores levando o ultimo item ao mesmo tempo, ou duas
// equipes pegando o mesmo pedido).

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Conexao ociosa que cai (banco reiniciou, oscilacao de rede no Railway)
// emite 'error' no pool. Sem este listener o Node derruba o processo; com
// ele, o pool descarta a conexao e abre outra na proxima query.
pool.on('error', err => {
  console.error('Conexao com o banco caiu (o pool vai reconectar):', err.message);
});

async function comTransacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function hashSenha(senha) {
  return crypto.createHash('sha256').update(String(senha)).digest('hex');
}

// Categorias oferecidas na loja do EAC. A ordem aqui define a ordem das abas
// que aparecem na tela de vendas. Nao fica no banco — e so configuracao fixa.
const CATEGORIAS = [
  { id: 'rosa',      nome: 'Rosas',      emoji: '🤍' },
  { id: 'boton',     nome: 'Botons',     emoji: '📛' },
  { id: 'trote',     nome: 'Trotes',     emoji: '💌' },
  { id: 'prisao',    nome: 'Prisão',     emoji: '⛓️' },
  { id: 'teste',     nome: 'Teste',      emoji: '🚨' }
];

// ---- Setup / seed (roda no boot do servidor) ----

const PRODUTOS_SEED = [
  // ----- Trotes (carro-chefe) -----
  { id: 17, categoria: 'trote',     nome: 'Trote da Xuxa',           preco: 4.00, foto: '/uploads/produtos/trote-xuxa.jpg',
    descricao: 'A pessoa escolhida recebe o trote da Xuxa.' },
  { id: 18, categoria: 'trote',     nome: 'Trote Panela de Pressão', preco: 4.00, foto: '/uploads/produtos/trote-panela-de-pressao.webp',
    descricao: 'A pessoa escolhida recebe o trote da panela de pressão.' },
  { id: 19, categoria: 'trote',     nome: 'Trote Celular do Vovô',   preco: 4.00, foto: '/uploads/produtos/trote-celular-do-vovo.jpg',
    descricao: 'A pessoa escolhida recebe o trote do celular do vovô.' },

  // ----- Rosas -----
  { id: 1,  categoria: 'rosa',      nome: 'Doce Rosa Branca',      preco: 4.00, foto: '/uploads/produtos/rosa.webp',
    descricao: 'Uma rosa branca com o cartãozinho "És meu amigo", entregue com carinho para quem você escolher. Ela já vem com um chocolate.' },

  // ----- Botons -----
  { id: 5,  categoria: 'boton',     nome: 'Boton EAC',            preco: 3.50, foto: '/uploads/produtos/boton-eac.webp',
    descricao: 'Boton oficial do EAC Santo Antônio.' },
  { id: 13, categoria: 'boton',     nome: 'Boton Santa Terezinha', preco: 3.50, foto: '/uploads/produtos/boton-santa-terezinha.webp',
    descricao: 'Santa Terezinha com seu buquê de rosas.' },
  { id: 14, categoria: 'boton',     nome: 'Boton Santa Clara',    preco: 3.50, foto: '/uploads/produtos/boton-santa-clara.webp',
    descricao: 'Santa Clara com o ostensório.' },
  { id: 15, categoria: 'boton',     nome: 'Boton Santo Antônio',  preco: 3.50, foto: '/uploads/produtos/boton-santo-antonio.webp',
    descricao: 'Santo Antônio, padroeiro da paróquia, com o Menino Jesus.' },
  { id: 16, categoria: 'boton',     nome: 'Boton São Francisco',  preco: 3.50, foto: '/uploads/produtos/boton-sao-francisco.webp',
    descricao: 'São Francisco de Assis com os passarinhos.' },

  // ----- Prisao dos Amostradinhos -----
  { id: 20, categoria: 'prisao',    nome: 'Prisão',                  preco: 2.00, foto: '/uploads/produtos/prisao-normal.webp',
    descricao: 'Mande prender alguém na Prisão dos Amostradinhos.' },
  { id: 21, categoria: 'prisao',    nome: 'Prisão do Padre',         preco: 5.00, foto: '/uploads/produtos/prisao.webp',
    descricao: 'Mande prender um padre na Prisão dos Amostradinhos.' },
  { id: 22, categoria: 'prisao',    nome: 'Prisão de Coordenador de Equipe', preco: 5.00, foto: '/uploads/produtos/prisao-coordenador.webp',
    descricao: 'Mande prender um coordenador de equipe na Prisão dos Amostradinhos.' },

  // ----- Teste (uso interno, nao remover sem avisar a equipe) -----
  { id: 12, categoria: 'teste',     nome: 'Produto TOP',          preco: 1.00, foto: '/uploads/produtos/sirene.svg',
    descricao: 'Produto de teste.' }
];

async function iniciarBancoDados() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      pedidos_pausados BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT config_singleton CHECK (id = 1)
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      usuario TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL,
      nome TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_usuario_lower ON usuarios (LOWER(usuario));

    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY,
      categoria TEXT,
      nome TEXT NOT NULL,
      preco NUMERIC(10,2) NOT NULL,
      foto TEXT,
      descricao TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      estoque INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entregadores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      codigo TEXT,
      item_pedido INTEGER,
      total_itens_pedido INTEGER,
      produto_id INTEGER,
      produto_nome TEXT,
      categoria TEXT,
      valor NUMERIC(10,2),
      valor_total_pedido NUMERIC(10,2),
      nome_comprador TEXT,
      contato TEXT,
      nome_destinatario TEXT,
      equipe_destinatario TEXT,
      anonimo BOOLEAN NOT NULL DEFAULT false,
      mensagem_especial TEXT,
      status TEXT NOT NULL,
      pix_txid TEXT,
      entregador_id INTEGER,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
      claimed_by TEXT,
      claimed_at TIMESTAMPTZ,
      equipe_entregou TEXT,
      pagamento JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_pedidos_codigo_upper ON pedidos (UPPER(codigo));
    CREATE INDEX IF NOT EXISTS idx_pedidos_pix_txid ON pedidos (pix_txid);
  `);

  await pool.query('INSERT INTO config (id, pedidos_pausados) VALUES (1, false) ON CONFLICT (id) DO NOTHING');

  // Idempotente: so insere produtos que ainda nao existem (permite adicionar
  // novos produtos no PRODUTOS_SEED depois — entram sozinhos no proximo boot).
  for (const p of PRODUTOS_SEED) {
    await pool.query(
      `INSERT INTO produtos (id, categoria, nome, preco, foto, descricao, ativo, estoque)
       VALUES ($1,$2,$3,$4,$5,$6,true,30)
       ON CONFLICT (id) DO NOTHING`,
      [p.id, p.categoria, p.nome, p.preco, p.foto, p.descricao]
    );
  }

  // Produtos que sairam do cardapio: Buque de 3 Rosas (2), Chocolate com
  // Rosa (3), Chocolate Coracao (4), Kit 3 Botons (6) e os trotes de exemplo
  // (7-11). Pedidos guardam produto_nome, entao o historico continua certo.
  await pool.query('DELETE FROM produtos WHERE id IN (2, 3, 4, 6, 7, 8, 9, 10, 11)');

  // Produtos ja existentes que mudaram no seed: Doce Rosa Branca (1)
  // com foto real, novo nome/descricao e R$ 4,00; botons (5, 13-16) a R$ 3,50,
  // o Boton EAC com foto real; Prisao (20) e Prisao de Coordenador (22) com
  // foto propria; e "Prisao de Padre" virou "Prisao do Padre" (21).
  for (const p of PRODUTOS_SEED.filter(p => [1, 5, 13, 14, 15, 16, 20, 21, 22].includes(p.id))) {
    await pool.query(
      `UPDATE produtos SET nome = $2, foto = $3, descricao = $4, preco = $5
       WHERE id = $1 AND (nome IS DISTINCT FROM $2 OR foto IS DISTINCT FROM $3
                          OR descricao IS DISTINCT FROM $4 OR preco IS DISTINCT FROM $5)`,
      [p.id, p.nome, p.foto, p.descricao, p.preco]
    );
  }

  const entregadoresExistentes = await pool.query('SELECT COUNT(*)::int AS total FROM entregadores');
  if (entregadoresExistentes.rows[0].total === 0) {
    await pool.query(`INSERT INTO entregadores (nome) VALUES ('Equipe Trote 1'), ('Equipe Trote 2')`);
  }

  // Se ADMIN_PASSWORD estiver definida, ela vira a senha oficial do admin
  // (sobrescrevendo a cada boot). Permite rotacionar a senha via variavel
  // de ambiente do Railway sem editar codigo. Sem ela, cai no default 'neymar'.
  const senhaAdminDesejada = process.env.ADMIN_PASSWORD || 'neymar';
  const hashDesejado = hashSenha(senhaAdminDesejada);
  const adminExistente = await pool.query(`SELECT * FROM usuarios WHERE papel = 'admin' LIMIT 1`);
  if (adminExistente.rows.length === 0) {
    await pool.query(
      `INSERT INTO usuarios (usuario, senha_hash, papel, nome) VALUES ('teatro', $1, 'admin', 'Admin')`,
      [hashDesejado]
    );
  } else {
    const admin = adminExistente.rows[0];
    if (admin.usuario !== 'teatro' || admin.senha_hash !== hashDesejado) {
      await pool.query(`UPDATE usuarios SET usuario = 'teatro', senha_hash = $1 WHERE id = $2`, [hashDesejado, admin.id]);
    }
  }
}

// ---- Mapeamento linha do banco -> objeto usado pelo resto do app ----
// (mesmo formato de campos que a versao antiga com arquivo JSON usava, pra
// nao precisar mudar rotas/frontend alem de adicionar "await".)

function linhaParaProduto(row) {
  return {
    id: row.id,
    categoria: row.categoria,
    nome: row.nome,
    preco: Number(row.preco),
    foto: row.foto,
    descricao: row.descricao,
    ativo: row.ativo,
    estoque: row.estoque
  };
}

function linhaParaPedido(row) {
  return {
    id: row.id,
    codigo: row.codigo,
    itemPedido: row.item_pedido,
    totalItensPedido: row.total_itens_pedido,
    produtoId: row.produto_id,
    produtoNome: row.produto_nome,
    categoria: row.categoria,
    valor: row.valor != null ? Number(row.valor) : null,
    valorTotalPedido: row.valor_total_pedido != null ? Number(row.valor_total_pedido) : null,
    nomeComprador: row.nome_comprador,
    contato: row.contato,
    nomeDestinatario: row.nome_destinatario,
    equipeDestinatario: row.equipe_destinatario,
    anonimo: row.anonimo,
    mensagemEspecial: row.mensagem_especial,
    status: row.status,
    pixTxid: row.pix_txid,
    entregadorId: row.entregador_id,
    criadoEm: row.criado_em.toISOString(),
    atualizadoEm: row.atualizado_em.toISOString(),
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at ? row.claimed_at.toISOString() : null,
    equipeEntregou: row.equipe_entregou,
    pagamento: row.pagamento || null
  };
}

function sanitizarUsuario(row) {
  return { id: row.id, usuario: row.usuario, nome: row.nome, papel: row.papel };
}

// ---- Produtos ----

async function listarProdutosAtivos() {
  // Mesma ordem das abas (CATEGORIAS): rosas, botons, trotes e teste.
  const { rows } = await pool.query(
    'SELECT * FROM produtos WHERE ativo = true ORDER BY array_position($1::text[], categoria), id',
    [CATEGORIAS.map(c => c.id)]
  );
  return rows.map(linhaParaProduto);
}

async function buscarProduto(id) {
  const { rows } = await pool.query('SELECT * FROM produtos WHERE id = $1', [Number(id)]);
  return rows[0] ? linhaParaProduto(rows[0]) : undefined;
}

// Lista completa (inclui inativos), usada no painel admin pra editar estoque.
async function listarProdutosAdmin() {
  // Mesma ordem do cardapio (CATEGORIAS).
  const { rows } = await pool.query(
    'SELECT * FROM produtos ORDER BY array_position($1::text[], categoria), id',
    [CATEGORIAS.map(c => c.id)]
  );
  return rows.map(linhaParaProduto);
}

async function atualizarEstoque(produtoId, novoEstoque) {
  const valor = Number(novoEstoque);
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error('ESTOQUE_INVALIDO');
  }
  const { rows } = await pool.query(
    'UPDATE produtos SET estoque = $1 WHERE id = $2 RETURNING *',
    [valor, Number(produtoId)]
  );
  if (!rows[0]) throw new Error('PRODUTO_INVALIDO');
  return linhaParaProduto(rows[0]);
}

// ---- Botão do pânico (pausa imediata de novos pedidos) ----

async function statusPedidos() {
  const { rows } = await pool.query('SELECT pedidos_pausados FROM config WHERE id = 1');
  return { pausado: !!(rows[0] && rows[0].pedidos_pausados) };
}

async function pausarPedidos() {
  await pool.query('UPDATE config SET pedidos_pausados = true WHERE id = 1');
  return statusPedidos();
}

async function retomarPedidos() {
  await pool.query('UPDATE config SET pedidos_pausados = false WHERE id = 1');
  return statusPedidos();
}

// ---- Pedidos ----

// Gera o txid usado na cobranca Pix (Efi). Precisa ser alfanumerico puro,
// entre 26 e 35 caracteres (sem hifen) — por isso nao reaproveita o "codigo"
// publico (que tem hifen) diretamente.
function gerarPixTxid() {
  return crypto.randomBytes(20).toString('hex').slice(0, 32);
}

// Gera um código público curto, tipo "EAC-XK7B", para o comprador consultar
// o pedido. Evita usar o id sequencial (1, 2, 3...) que qualquer um adivinha.
// Sem caracteres ambíguos (0/O, 1/I) para ficar fácil de ditar por voz.
async function gerarCodigoPedido(client) {
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    let codigo = 'EAC-';
    for (let i = 0; i < 4; i++) {
      codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    }
    const { rows } = await client.query('SELECT 1 FROM pedidos WHERE codigo = $1 LIMIT 1', [codigo]);
    if (rows.length === 0) return codigo;
  }
  // Fallback praticamente impossível: adiciona sufixo com timestamp.
  return `EAC-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function criarPedidosMultiplos({ produtoId, nomeComprador, contato, destinatarios }) {
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    throw new Error('DESTINATARIOS_INVALIDOS');
  }

  return comTransacao(async client => {
    const statusRes = await client.query('SELECT pedidos_pausados FROM config WHERE id = 1');
    if (statusRes.rows[0] && statusRes.rows[0].pedidos_pausados) {
      throw new Error('PEDIDOS_PAUSADOS');
    }

    // FOR UPDATE trava a linha do produto ate o fim da transacao — evita que
    // dois compradores simultaneos consigam vender mais do que o estoque
    // real (condicao de corrida que existia na versao com arquivo JSON).
    const produtoRes = await client.query(
      'SELECT * FROM produtos WHERE id = $1 AND ativo = true FOR UPDATE',
      [Number(produtoId)]
    );
    const produtoRow = produtoRes.rows[0];
    if (!produtoRow) throw new Error('PRODUTO_INVALIDO');
    if (produtoRow.estoque <= 0) throw new Error('PRODUTO_SEM_ESTOQUE');
    if (produtoRow.estoque < destinatarios.length) throw new Error('PRODUTO_SEM_ESTOQUE');

    const produto = linhaParaProduto(produtoRow);
    const codigo = await gerarCodigoPedido(client);
    const pixTxid = gerarPixTxid();

    const pedidos = [];
    for (let indice = 0; indice < destinatarios.length; indice++) {
      const destinatario = destinatarios[indice];
      const { rows } = await client.query(
        `INSERT INTO pedidos
           (codigo, item_pedido, total_itens_pedido, produto_id, produto_nome, categoria,
            valor, valor_total_pedido, nome_comprador, contato, nome_destinatario,
            equipe_destinatario, anonimo, mensagem_especial, status, pix_txid)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pendente_pagamento',$15)
         RETURNING *`,
        [
          codigo, indice + 1, destinatarios.length, produto.id, produto.nome, produto.categoria,
          produto.preco, produto.preco * destinatarios.length, nomeComprador, contato,
          destinatario.nomeDestinatario, destinatario.equipeDestinatario || null,
          !!destinatario.anonimo, destinatario.mensagemEspecial || '', pixTxid
        ]
      );
      pedidos.push(linhaParaPedido(rows[0]));
    }

    await client.query('UPDATE produtos SET estoque = estoque - $1 WHERE id = $2', [pedidos.length, produto.id]);

    return {
      codigo,
      pixTxid,
      valor: produto.preco * pedidos.length,
      pedidos
    };
  });
}

async function criarPedido({ produtoId, nomeComprador, contato, nomeDestinatario, equipeDestinatario }) {
  const grupo = await criarPedidosMultiplos({
    produtoId,
    nomeComprador,
    contato,
    destinatarios: [{ nomeDestinatario, equipeDestinatario }]
  });
  return grupo.pedidos[0];
}

async function buscarPedido(id) {
  const { rows } = await pool.query('SELECT * FROM pedidos WHERE id = $1', [Number(id)]);
  return rows[0] ? linhaParaPedido(rows[0]) : undefined;
}

async function buscarPedidoPorTxid(txid) {
  const { rows } = await pool.query('SELECT * FROM pedidos WHERE pix_txid = $1 LIMIT 1', [txid]);
  return rows[0] ? linhaParaPedido(rows[0]) : undefined;
}

async function buscarPedidoPorCodigo(codigo) {
  if (!codigo) return null;
  const alvo = String(codigo).trim().toUpperCase();
  const { rows } = await pool.query('SELECT * FROM pedidos WHERE UPPER(codigo) = $1 LIMIT 1', [alvo]);
  return rows[0] ? linhaParaPedido(rows[0]) : null;
}

async function listarPedidosPorCodigo(codigo) {
  if (!codigo) return [];
  const alvo = String(codigo).trim().toUpperCase();
  const { rows } = await pool.query('SELECT * FROM pedidos WHERE UPPER(codigo) = $1 ORDER BY item_pedido', [alvo]);
  return rows.map(linhaParaPedido);
}

async function listarPedidos() {
  const { rows } = await pool.query('SELECT * FROM pedidos ORDER BY id');
  return rows.map(linhaParaPedido);
}

// detalhesPagamento (opcional): dados extras que a Efi manda no webhook
// (endToEndId, valor confirmado, horario, infoPagador) ou 'manual' quando
// o admin marca como pago pela mao. Usado no relatorio de valores
// compensados (aba Relatorio do painel admin).
async function atualizarStatusPorTxid(txid, novoStatus, detalhesPagamento) {
  let pagamentoJson = null;
  if (detalhesPagamento) {
    pagamentoJson = JSON.stringify({
      origem: detalhesPagamento.origem || 'webhook',
      endToEndId: detalhesPagamento.endToEndId || null,
      valorConfirmado: detalhesPagamento.valor != null ? Number(detalhesPagamento.valor) : null,
      horario: detalhesPagamento.horario || new Date().toISOString(),
      infoPagador: detalhesPagamento.infoPagador || null
    });
  }

  const { rows } = await pool.query(
    `UPDATE pedidos
        SET status = $1,
            atualizado_em = now(),
            pagamento = COALESCE($2::jsonb, pagamento)
      WHERE pix_txid = $3
      RETURNING *`,
    [novoStatus, pagamentoJson, txid]
  );
  if (rows.length === 0) throw new Error('PEDIDO_NAO_ENCONTRADO');
  return linhaParaPedido(rows[0]);
}

async function atribuirEntregador(pedidoId, entregadorId) {
  return comTransacao(async client => {
    const pedidoRes = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [Number(pedidoId)]);
    const pedidoRow = pedidoRes.rows[0];
    if (!pedidoRow) throw new Error('PEDIDO_NAO_ENCONTRADO');
    if (pedidoRow.status !== 'pago' && pedidoRow.status !== 'aguardando') {
      throw new Error('PEDIDO_AINDA_NAO_PAGO');
    }
    const entRes = await client.query('SELECT * FROM entregadores WHERE id = $1', [Number(entregadorId)]);
    if (!entRes.rows[0]) throw new Error('ENTREGADOR_INVALIDO');

    const upd = await client.query(
      `UPDATE pedidos SET entregador_id = $1, status = 'aguardando', atualizado_em = now()
       WHERE id = $2 RETURNING *`,
      [entRes.rows[0].id, pedidoRow.id]
    );
    return linhaParaPedido(upd.rows[0]);
  });
}

// Tempo (ms) que uma reserva ("peguei") dura antes de expirar sozinha,
// liberando o pedido pra outra equipe. Evita pedidos "presos" quando
// uma equipe clica em "Peguei" e esquece.
const RESERVA_TTL_MS = 10 * 60 * 1000; // 10 minutos

function reservaEstaAtiva(pedido) {
  if (!pedido.claimedBy || !pedido.claimedAt) return false;
  return (Date.now() - new Date(pedido.claimedAt).getTime()) < RESERVA_TTL_MS;
}

async function pegarPedido(pedidoId, equipe) {
  if (!equipe) throw new Error('EQUIPE_OBRIGATORIA');
  return comTransacao(async client => {
    // FOR UPDATE evita que duas equipes cliquem "Peguei" ao mesmo tempo e
    // ambas consigam reservar o mesmo pedido.
    const res = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [Number(pedidoId)]);
    const row = res.rows[0];
    if (!row) throw new Error('PEDIDO_NAO_ENCONTRADO');
    const pedido = linhaParaPedido(row);
    if (pedido.status !== 'pago' && pedido.status !== 'aguardando') {
      throw new Error('PEDIDO_NAO_DISPONIVEL');
    }
    if (pedido.claimedBy && pedido.claimedBy !== equipe && reservaEstaAtiva(pedido)) {
      throw new Error('PEDIDO_JA_PEGO');
    }
    const upd = await client.query(
      `UPDATE pedidos SET claimed_by = $1, claimed_at = now(), status = 'aguardando', atualizado_em = now()
       WHERE id = $2 RETURNING *`,
      [equipe, pedido.id]
    );
    return linhaParaPedido(upd.rows[0]);
  });
}

async function liberarPedido(pedidoId, equipe, forcado) {
  return comTransacao(async client => {
    const res = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [Number(pedidoId)]);
    const row = res.rows[0];
    if (!row) throw new Error('PEDIDO_NAO_ENCONTRADO');
    const pedido = linhaParaPedido(row);
    if (pedido.status === 'entregue') throw new Error('PEDIDO_JA_ENTREGUE');
    if (pedido.claimedBy && pedido.claimedBy !== equipe && !forcado && reservaEstaAtiva(pedido)) {
      throw new Error('PEDIDO_NAO_SEU');
    }
    const upd = await client.query(
      `UPDATE pedidos SET claimed_by = NULL, claimed_at = NULL, status = 'pago', atualizado_em = now()
       WHERE id = $1 RETURNING *`,
      [pedido.id]
    );
    return linhaParaPedido(upd.rows[0]);
  });
}

async function marcarEntregue(pedidoId, equipe) {
  return comTransacao(async client => {
    const res = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [Number(pedidoId)]);
    const row = res.rows[0];
    if (!row) throw new Error('PEDIDO_NAO_ENCONTRADO');
    const pedido = linhaParaPedido(row);
    if (pedido.status !== 'pago' && pedido.status !== 'aguardando') {
      throw new Error('PEDIDO_NAO_PAGO');
    }
    // Se está reservado por outra equipe (ativa), bloqueia — evita
    // duas equipes marcarem entregue ao mesmo tempo.
    if (equipe && pedido.claimedBy && pedido.claimedBy !== equipe && reservaEstaAtiva(pedido)) {
      throw new Error('PEDIDO_DE_OUTRA_EQUIPE');
    }
    const equipeEntregou = equipe || pedido.claimedBy || null;
    const upd = await client.query(
      `UPDATE pedidos SET status = 'entregue', equipe_entregou = $1, atualizado_em = now()
       WHERE id = $2 RETURNING *`,
      [equipeEntregou, pedido.id]
    );
    return linhaParaPedido(upd.rows[0]);
  });
}

async function listarEntregadores() {
  const { rows } = await pool.query('SELECT * FROM entregadores ORDER BY id');
  return rows.map(r => ({ id: r.id, nome: r.nome }));
}

function listarCategorias() {
  return CATEGORIAS;
}

// ---- Usuarios / autenticacao ----
// Papeis: 'admin' (usuario teatro, fixo) e 'equipe' (criados pelo admin).

async function listarUsuarios() {
  const { rows } = await pool.query('SELECT * FROM usuarios ORDER BY id');
  return rows.map(sanitizarUsuario);
}

async function autenticarUsuario(usuario, senha) {
  if (!usuario || !senha) return null;
  const alvo = String(usuario).trim().toLowerCase();
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE LOWER(usuario) = $1', [alvo]);
  const user = rows[0];
  if (!user || user.senha_hash !== hashSenha(senha)) return null;
  return sanitizarUsuario(user);
}

async function criarUsuario({ usuario, senha, nome }) {
  if (!usuario || !usuario.trim()) throw new Error('USUARIO_OBRIGATORIO');
  if (!senha || !senha.trim()) throw new Error('SENHA_OBRIGATORIA');

  try {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (usuario, senha_hash, papel, nome) VALUES ($1,$2,'equipe',$3) RETURNING *`,
      [usuario.trim(), hashSenha(senha), (nome && nome.trim()) || usuario.trim()]
    );
    return sanitizarUsuario(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw new Error('USUARIO_JA_EXISTE'); // unique_violation (usuario duplicado)
    throw err;
  }
}

async function removerUsuario(id) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [Number(id)]);
  const user = rows[0];
  if (!user) throw new Error('USUARIO_NAO_ENCONTRADO');
  if (user.papel === 'admin') throw new Error('ADMIN_NAO_REMOVIVEL');
  await pool.query('DELETE FROM usuarios WHERE id = $1', [Number(id)]);
}

module.exports = {
  iniciarBancoDados,
  listarProdutosAtivos,
  buscarProduto,
  listarProdutosAdmin,
  atualizarEstoque,
  statusPedidos,
  pausarPedidos,
  retomarPedidos,
  criarPedido,
  criarPedidosMultiplos,
  buscarPedido,
  buscarPedidoPorTxid,
  buscarPedidoPorCodigo,
  listarPedidosPorCodigo,
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
