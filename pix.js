// pix.js
// Camada de integracao com a API Pix do Banco Inter.
//
// Este arquivo esta MOCKADO (simulado) para o prototipo: gera um txid e um
// "copia e cola" falsos, sem chamar o Inter de verdade. Quando for integrar
// com a API real, e so trocar a funcao criarCobrancaPix por uma chamada
// HTTP autenticada (mTLS + OAuth2) para o endpoint de cobranca Pix do Inter,
// e o webhook.js abaixo passa a validar a assinatura/token que o Inter envia.

function criarCobrancaPix(pedido) {
  // Em produção: POST https://cdpj.partners.bancointer.com.br/pix/v2/cob
  // usando certificado mTLS + client credentials, passando valor, txid e
  // uma chave Pix da sua conta Inter. O retorno real traz o "pixCopiaECola"
  // e a imagem do QR Code (base64).
  return {
    txid: pedido.pixTxid,
    valor: pedido.valor,
    // Nesta simulacao, o "copia e cola" e so um texto de exemplo
    copiaECola: `00020126MOCKPIX-${pedido.pixTxid}-VALOR-${pedido.valor}5204000053039865802BR`,
    qrCodeBase64: null, // no prototipo nao geramos imagem real do QR
    expiraEm: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min
  };
}

module.exports = { criarCobrancaPix };
