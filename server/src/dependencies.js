const { GymRepository } = require('./repositories/GymRepository');
const { ExerciseCatalogService } = require('./services/ExerciseCatalogService');
const { AuthService } = require('./services/AuthService');
const { AiService } = require('./services/AiService');
const { PdfService } = require('./services/PdfService');
const { WhatsAppService } = require('./services/WhatsAppService');

const repository = new GymRepository();
const exerciseCatalog = new ExerciseCatalogService();
const whatsappService = new WhatsAppService();

module.exports = {
  repository,
  exerciseCatalog,
  whatsappService,
  authService: new AuthService(repository),
  aiService: new AiService(repository, exerciseCatalog),
  pdfService: new PdfService(),
};
