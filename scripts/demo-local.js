// scripts/demo-local.js
// Sobe o site inteiro no seu computador para testar, sem credenciais da Efi:
// Postgres embutido + Pix SIMULADO + pedidos de exemplo.
//
// Uso:
//   npm install
//   npm run demo
// Depois abra http://localhost:3000/admin (usuario "teatro", senha "demo").
// Para abrir no celular, use o endereco de rede que aparece no terminal
// (celular e computador precisam estar no mesmo Wi-Fi).
//
// NUNCA usar em producao: os pagamentos aqui sao falsos. O banco da demo fica
// em .pgdata-demo/ e nao tem nada a ver com o banco do Railway.

const path = require('path');
const os = require('os');

const PORTA_PG = 5499;
const PORTA = Number(process.env.PORT || 3000);

process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${PORTA_PG}/postgres`;
process.env.DATABASE_SSL = 'false';
process.env.ADMIN_PASSWORD = 'demo';
process.env.WEBHOOK_PIX_TOKEN = 'demo';
process.env.PORT = String(PORTA);

// Troca o SDK da Efi por um falso, antes do pix.js carregar.
const caminhoSdk = require.resolve('sdk-node-apis-efi');
class EfiSimulada {
  async pixCreateCharge({ txid }) {
    return { txid, loc: { id: 1 }, pixCopiaECola: `PIX-SIMULADO-${txid}` };
  }
  async pixGenerateQRCode() {
    return { imagemQrcode: null };
  }
}
require.cache[caminhoSdk] = { id: caminhoSdk, filename: caminhoSdk, loaded: true, exports: EfiSimulada };

const PEDIDOS_EXEMPLO = [
  ['Luma Gabriely', 'Lanche', ''], ['Pitoco', 'Equipe dos dog', 'Au Au'], ['Andre', 'Bandinha', 'Feliz aniversario!'],
  ['Isabele', 'Lanchinho', ''], ['Marina', 'Liturgia', 'Voce e demais'], ['Joao Pedro', 'Bandinha', ''],
  ['Ana Clara', 'Cozinha', 'Saudades de voce'], ['Padre Marcos', 'Coordenacao', ''], ['Beatriz', 'Recepcao', ''],
  ['Rafael', 'Teatro', 'Arrasou']
];

async function api(caminho, opcoes = {}) {
  const res = await fetch(`http://localhost:${PORTA}${caminho}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) }
  });
  return res.json();
}

async function criarPedidosExemplo() {
  const { token } = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ usuario: 'teatro', senha: 'demo' }) });
  const auth = { authorization: `Bearer ${token}` };
  if ((await api('/api/admin/pedidos', { headers: auth })).length > 0) return; // ja tem dados de uma demo anterior

  const produtos = [1, 17, 18, 5, 20, 21];
  for (const [i, [nome, equipe, mensagem]] of PEDIDOS_EXEMPLO.entries()) {
    const pedido = await api('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({
        produtoId: produtos[i % produtos.length], nomeComprador: `Comprador ${i + 1}`, contato: '83900000000',
        destinatarios: [{ nomeDestinatario: nome, equipeDestinatario: equipe, mensagemEspecial: mensagem }]
      })
    });
    // O ultimo fica pendente de pagamento, os outros "pagos" pelo webhook.
    if (i < PEDIDOS_EXEMPLO.length - 1) {
      await api('/webhook/pix?token=demo', { method: 'POST', body: JSON.stringify({ pix: [{ txid: pedido.pix.txid, valor: String(pedido.pix.valor) }] }) });
    }
  }

  const pedidos = await api('/api/admin/pedidos', { headers: auth });
  const pegar = (nome, equipe) => api(`/api/admin/pedidos/${pedidos.find(p => p.nomeDestinatario === nome).id}/pegar`, {
    method: 'POST', headers: auth, body: JSON.stringify({ equipeOperacao: equipe })
  });
  await pegar('Luma Gabriely', 'Equipe Trote 1');
  await pegar('Marina', 'Equipe Trote 2');
  await pegar('Ana Clara', 'Equipe Trote 2');
}

function enderecosDeRede() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => `http://${i.address}:${PORTA}/admin`);
}

(async () => {
  // embedded-postgres e um modulo ESM: no Node 18 so carrega via import().
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(__dirname, '..', '.pgdata-demo'),
    user: 'postgres',
    password: 'postgres',
    port: PORTA_PG,
    persistent: true
  });
  try { await pg.initialise(); } catch (err) { /* ja inicializado numa demo anterior */ }
  await pg.start();

  process.on('SIGINT', async () => {
    console.log('\nParando a demo...');
    await pg.stop();
    process.exit(0);
  });

  require('../server');

  for (let tentativa = 0; tentativa < 50; tentativa++) {
    try { await fetch(`http://localhost:${PORTA}/api/status`); break; } catch { await new Promise(r => setTimeout(r, 200)); }
  }
  await criarPedidosExemplo();

  console.log('\n=== DEMO LOCAL (Pix SIMULADO, nada e cobrado) ===');
  console.log(`Painel:  http://localhost:${PORTA}/admin   (usuario: teatro / senha: demo)`);
  console.log(`Loja:    http://localhost:${PORTA}/`);
  const rede = enderecosDeRede();
  if (rede.length) console.log(`No celular (mesmo Wi-Fi): ${rede.join('  ou  ')}`);
  console.log('Para apagar os dados da demo: pare com Ctrl+C e apague a pasta .pgdata-demo');
})().catch(err => {
  console.error('Erro ao subir a demo:', err);
  process.exit(1);
});
