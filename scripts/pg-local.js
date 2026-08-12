// scripts/pg-local.js
// Sobe um Postgres local para desenvolvimento, sem precisar instalar nada
// (baixa um binario portatil automaticamente via o pacote embedded-postgres).
//
// Uso:
//   npm run db:local
// e no .env:
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5488/postgres
//
// So para desenvolvimento local — em producao (Railway) o app se conecta
// no Postgres gerenciado de verdade via DATABASE_URL.

const EmbeddedPostgres = require('embedded-postgres').default;

const pg = new EmbeddedPostgres({
  databaseDir: './.pgdata-local',
  user: 'postgres',
  password: 'postgres',
  port: 5488,
  persistent: true
});

(async () => {
  await pg.initialise();
  await pg.start();
  console.log('Postgres local rodando em postgresql://postgres:postgres@localhost:5488/postgres');
  console.log('Pressione Ctrl+C para parar.');
})().catch(err => {
  console.error('Erro ao subir o Postgres local:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\nParando Postgres local...');
  await pg.stop();
  process.exit(0);
});
