const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const { repository, whatsappService } = require('./dependencies');
const { env } = require('./config/env');
const { hasSqlServerConfig } = require('./config/sqlServer');

const configureRealtime = (io) => {
  io.use((socket, next) => {
    try {
      jwt.verify(socket.handshake.auth?.token || '', env.jwtSecret);
      next();
    } catch (_error) {
      next(new Error('Sesión de tiempo real no válida'));
    }
  });
  whatsappService.setSocket(io);
  whatsappService.initialize();

  io.on('connection', (socket) => {
    socket.emit('whatsapp_status', whatsappService.getState());
    socket.on('get_status', () => socket.emit('whatsapp_status', whatsappService.getState()));
  });

  if (!hasSqlServerConfig()) return;

  cron.schedule('*/5 * * * *', async () => {
    try {
      const expiring = await repository.listExpiringInDays(3);
      for (const member of expiring) {
        io.emit('expiring_alert', {
          memberId: member.MemberID,
          name: member.FullName,
          plan: member.PlanName,
          daysLeft: member.DaysLeft,
        });
      }
    } catch (error) {
      console.error('[cron] Alertas de vencimiento:', error.message);
    }
  });

  cron.schedule('0 8 * * *', async () => {
    if (whatsappService.getState().status !== 'connected') return;
    try {
      const expiring = await repository.listExpiringInDays(3);
      for (const member of expiring.filter((item) => item.DaysLeft === 3)) {
        await whatsappService.sendText(
          member.Phone,
          `Hola ${member.FullName}, tu plan ${member.PlanName} vence en 3 días. Te esperamos para renovarlo.`,
        );
      }
    } catch (error) {
      console.error('[cron] Recordatorios de WhatsApp:', error.message);
    }
  });
};

module.exports = { configureRealtime };
