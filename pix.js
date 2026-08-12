// pix.js
// Integracao real com a API Pix da Efi (efipay.com.br), via SDK oficial
// sdk-node-apis-efi. Ambiente controlado por EFI_SANDBOX (homologacao/producao).
//
// Requer no .env: EFI_SANDBOX, EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_PIX_KEY
// e o certificado .p12, de uma das duas formas:
//   - EFI_CERT_PATH: caminho local do arquivo .p12 (uso local/dev)
//   - EFI_CERT_BASE64: conteudo do .p12 codificado em base64 (uso em
//     hospedagens como Railway, onde nao da pra montar um arquivo facilmente)
// Se as duas estiverem definidas, EFI_CERT_BASE64 tem prioridade.

const EfiPay = require('sdk-node-apis-efi');

const EXPIRACAO_SEGUNDOS = 15 * 60; // 15 minutos
const TIMEOUT_EFI_MS = 25 * 1000; // 25s — evita deixar o comprador esperando pra sempre se a Efi travar

function comTimeout(promise, ms, mensagem) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensagem)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// O construtor do EfiPay lanca erro sincrono se faltar client_id/secret.
// Por isso a instancia e criada sob demanda (na primeira cobranca), e nao
// no require deste arquivo — assim uma variavel de ambiente faltando so
// quebra a criacao de pedidos, e nao o servidor inteiro no boot.
let efipay = null;
function getEfiPay() {
  if (!efipay) {
    const certificadoConfig = process.env.EFI_CERT_BASE64
      ? { certificate: process.env.EFI_CERT_BASE64, cert_base64: true }
      : { certificate: process.env.EFI_CERT_PATH };

    efipay = new EfiPay({
      sandbox: process.env.EFI_SANDBOX !== 'false',
      client_id: process.env.EFI_CLIENT_ID,
      client_secret: process.env.EFI_CLIENT_SECRET,
      ...certificadoConfig
    });
  }
  return efipay;
}

// Cria a cobranca Pix na Efi usando o txid ja gerado pelo pedido (db.js) e
// busca o QR Code + "copia e cola" prontos para exibir ao comprador.
async function criarCobrancaPix(pedido) {
  const cobranca = await comTimeout(
    getEfiPay().pixCreateCharge(
      { txid: pedido.pixTxid },
      {
        calendario: { expiracao: EXPIRACAO_SEGUNDOS },
        valor: { original: Number(pedido.valor).toFixed(2) },
        chave: process.env.EFI_PIX_KEY,
        solicitacaoPagador: `Pedido ${pedido.codigo || pedido.pixTxid}`.slice(0, 140)
      }
    ),
    TIMEOUT_EFI_MS,
    'EFI_TIMEOUT'
  );

  const qrcode = await comTimeout(
    getEfiPay().pixGenerateQRCode({ id: cobranca.loc.id }),
    TIMEOUT_EFI_MS,
    'EFI_TIMEOUT'
  );

  return {
    txid: cobranca.txid,
    valor: pedido.valor,
    copiaECola: cobranca.pixCopiaECola,
    qrCodeBase64: qrcode.imagemQrcode || null,
    expiraEm: new Date(Date.now() + EXPIRACAO_SEGUNDOS * 1000).toISOString()
  };
}

module.exports = { criarCobrancaPix };
