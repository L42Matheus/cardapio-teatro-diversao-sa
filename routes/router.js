// routes/router.js
// Express 4 nao captura erro lancado dentro de handler async: a promise
// rejeitada vira "unhandled rejection" e o Node derruba o processo inteiro
// (ex: GET /api/pedidos/99999999999 estoura o INTEGER do Postgres e tirava
// o site do ar). Este Router embrulha cada handler pra mandar o erro pro
// next(), onde o tratador de erro do server.js responde 500.

const express = require('express');

function envolver(fn) {
  if (typeof fn !== 'function' || fn.length === 4) return fn; // tratadores de erro ficam como estao
  return (req, res, next) => {
    try {
      const resultado = fn(req, res, next);
      if (resultado && typeof resultado.catch === 'function') resultado.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function criarRouter() {
  const router = express.Router();
  for (const metodo of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
    const original = router[metodo].bind(router);
    router[metodo] = (...args) => original(...args.map(envolver));
  }
  return router;
}

module.exports = criarRouter;
