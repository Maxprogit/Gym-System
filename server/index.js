require('dotenv').config({ quiet: true });

const http = require('node:http');
const { Server } = require('socket.io');
const { env } = require('./src/config/env');
const { getSqlPool, hasSqlServerConfig } = require('./src/config/sqlServer');
const { createApp } = require('./src/app');
const dependencies = require('./src/dependencies');
const { configureRealtime } = require('./src/realtime');

// Un error interno de una librería (por ejemplo whatsapp-web.js / puppeteer)
// no debe tumbar el servidor completo.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason?.message || reason);
});
process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error?.message || error);
});

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.clientOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
configureRealtime(io);
if (hasSqlServerConfig()) {
  getSqlPool().catch((error) => {
    console.error('[sql-server] No fue posible usar la conexión existente:', error.message);
  });
} else {
  console.warn('[sql-server] Copia tu archivo server/.env original para conectar tu SQL Server. Esta aplicación no crea ni modifica bases o tablas.');
}

// En Render el puerto lo asigna la plataforma (process.env.PORT) y hay que escuchar en todas las interfaces.
server.listen(env.port, '0.0.0.0', () => {
  console.log(`[server] Goliat System escuchando en el puerto ${env.port}`);
  console.log(`[server] Orígenes permitidos (CORS): ${env.clientOrigins.join(', ')}`);
  console.log(`[server] WhatsApp ${env.enableWhatsApp ? 'habilitado' : 'deshabilitado'}`);
});

const shutdown = async (signal) => {
  console.log(`[server] Cerrando por ${signal}`);
  const forceExit = setTimeout(() => process.exit(0), 10_000);
  forceExit.unref();
  await Promise.resolve(dependencies.whatsappService?.client?.destroy?.()).catch(() => undefined);
  server.close(() => {
    console.log('[server] Cerrado');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));