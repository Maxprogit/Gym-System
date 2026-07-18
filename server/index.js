require('dotenv').config({ quiet: true });

const http = require('node:http');
const { Server } = require('socket.io');
const { env } = require('./src/config/env');
const { getSqlPool, hasSqlServerConfig } = require('./src/config/sqlServer');
const { createApp } = require('./src/app');
const { configureRealtime } = require('./src/realtime');

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.clientOrigins, credentials: true },
});

configureRealtime(io);
if (hasSqlServerConfig()) {
  getSqlPool().catch((error) => {
    console.error('[sql-server] No fue posible usar la conexión existente:', error.message);
  });
} else {
  console.warn('[sql-server] Copia tu archivo server/.env original para conectar tu SQL Server. Esta aplicación no crea ni modifica bases o tablas.');
}

server.listen(env.port, () => {
  console.log(`[server] Goliat System disponible en http://localhost:${env.port}`);
});

const shutdown = async (signal) => {
  console.log(`[server] Cerrando por ${signal}`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
