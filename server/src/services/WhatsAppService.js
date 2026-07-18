const fs = require('node:fs');
const path = require('node:path');
const { env } = require('../config/env');
const { AppError } = require('../core/AppError');

const serverRoot = path.resolve(__dirname, '../..');

const resolveBrowserExecutable = () => {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
};

class WhatsAppService {
  constructor() {
    this.client = null;
    this.io = null;
    this.status = env.enableWhatsApp ? 'starting' : 'disabled';
    this.qr = null;
    this.initializing = null;
    this.retryTimer = null;
    this.manualStop = false;
  }

  setSocket(io) {
    this.io = io;
  }

  emitStatus() {
    this.io?.emit('whatsapp_status', this.getState());
    if (this.qr) this.io?.emit('qr_code', this.qr);
  }

  scheduleRetry() {
    if (!env.enableWhatsApp || this.manualStop || this.retryTimer) return;
    this.retryTimer = setTimeout(() => this.initialize(), 10_000);
    this.retryTimer.unref?.();
  }

  async initialize() {
    if (!env.enableWhatsApp || this.initializing || this.status === 'connected') return this.getState();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.manualStop = false;
    this.status = 'starting';
    this.qr = null;
    this.emitStatus();
    this.initializing = (async () => {
      const { Client, LocalAuth } = require('whatsapp-web.js');
      const executablePath = resolveBrowserExecutable();
      if (this.client) {
        await this.client.destroy().catch(() => undefined);
      }
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(serverRoot, '.wwebjs_auth') }),
        puppeteer: {
          headless: true,
          ...(executablePath ? { executablePath } : {}),
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      });
      this.client.on('qr', (qr) => {
        this.qr = qr;
        this.status = 'awaiting_qr';
        this.emitStatus();
      });
      this.client.on('ready', () => {
        this.qr = null;
        this.status = 'connected';
        this.emitStatus();
      });
      this.client.on('auth_failure', () => {
        this.status = 'error';
        this.emitStatus();
        this.scheduleRetry();
      });
      this.client.on('disconnected', () => {
        this.client = null;
        this.status = 'disconnected';
        this.emitStatus();
        this.scheduleRetry();
      });
      await this.client.initialize();
    })().catch((error) => {
      this.client = null;
      this.status = 'error';
      this.emitStatus();
      console.error('[whatsapp] No se pudo iniciar:', error.message);
      this.scheduleRetry();
    }).finally(() => {
      this.initializing = null;
    });
    return this.getState();
  }

  getState() {
    return {
      status: this.status,
      qr: this.qr,
      enabled: env.enableWhatsApp,
    };
  }

  assertConnected() {
    if (this.status !== 'connected' || !this.client) {
      throw new AppError(409, 'WhatsApp no está conectado');
    }
  }

  async resolveChatId(phone) {
    this.assertConnected();
    const digits = String(phone || '').replace(/\D/g, '');
    const number = await this.client.getNumberId(digits);
    if (!number?._serialized) {
      throw new AppError(400, 'El número no tiene una cuenta de WhatsApp disponible');
    }
    return number._serialized;
  }

  async sendText(phone, message) {
    const chatId = await this.resolveChatId(phone);
    await this.client.sendMessage(chatId, message);
  }

  async sendPdf(phone, buffer, filename, caption) {
    const chatId = await this.resolveChatId(phone);
    const { MessageMedia } = require('whatsapp-web.js');
    const media = new MessageMedia('application/pdf', buffer.toString('base64'), filename);
    await this.client.sendMessage(chatId, media, { caption });
  }

  async logout() {
    this.assertConnected();
    const client = this.client;
    this.manualStop = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    await client.logout();
    await client.destroy().catch(() => undefined);
    this.client = null;
    this.qr = null;
    this.status = 'disconnected';
    this.emitStatus();
  }
}

module.exports = { WhatsAppService, resolveBrowserExecutable };
