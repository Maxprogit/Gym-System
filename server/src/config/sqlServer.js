const sql = require('mssql');
const { env } = require('./env');

let poolPromise;
let ready = false;

const hasSqlServerConfig = () => Boolean(
  env.sqlServer.server
  && env.sqlServer.database
  && env.sqlServer.user
  && env.sqlServer.password,
);

const getSqlPool = () => {
  if (!hasSqlServerConfig()) {
    return Promise.reject(new Error(
      'Faltan variables DB_* en server/.env. Copia el archivo .env de tu servidor original; no se creará ni modificará ninguna base de datos.',
    ));
  }

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(env.sqlServer)
      .connect()
      .then((pool) => {
        ready = true;
        console.log('[sql-server] Conectado a la base existente');
        pool.on('error', (error) => {
          ready = false;
          console.error('[sql-server] Error de conexión:', error.message);
        });
        return pool;
      })
      .catch((error) => {
        ready = false;
        poolPromise = undefined;
        throw error;
      });
  }
  return poolPromise;
};

const isSqlServerReady = () => ready;

module.exports = { getSqlPool, hasSqlServerConfig, isSqlServerReady, sql };
