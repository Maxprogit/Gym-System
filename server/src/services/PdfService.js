const PDFDocument = require('pdfkit');

const COLORS = {
  ink: '#17201f',
  inkSoft: '#2c3836',
  paper: '#f4f1e9',
  paperDeep: '#e7e2d7',
  accent: '#ff6642',
  sage: '#9fb9ad',
  sageDark: '#526f66',
  muted: '#65706d',
  white: '#ffffff',
  line: '#c9c5bb',
};

const PAGE_MARGIN = 52;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;
const PAGE_BOTTOM = 792;

const stripMarkdown = (line) => String(line || '')
  .replace(/^#{1,6}\s*/, '')
  .replace(/\*\*/g, '')
  .replace(/^[-*]\s+/, '• ')
  .trim();

const parsePlanContent = (planContent) => {
  if (planContent && typeof planContent === 'object') return planContent;
  const source = String(planContent || '').trim();
  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_error) {
    // Compatibility with plans saved by previous versions.
  }
  return { version: 1, legacyText: source };
};

const planSections = (planType) => {
  const normalized = String(planType || '').toLowerCase();
  return {
    training: normalized.includes('entren') || normalized.includes('integral'),
    nutrition: normalized.includes('nutric') || normalized.includes('integral'),
  };
};

const safeText = (value, fallback = '-') => String(value || fallback).replace(/[\u2010-\u2015]/g, '-').trim();

const drawPageHeader = (document, { memberName, planType }) => {
  document.rect(0, 0, document.page.width, document.page.height).fill(COLORS.paper);
  document.rect(0, 0, document.page.width, 92).fill(COLORS.ink);
  document.rect(PAGE_MARGIN, 26, 36, 36).fill(COLORS.accent);
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(17).text('G', PAGE_MARGIN, 35, { width: 36, align: 'center' });
  document.fillColor(COLORS.sage).font('Helvetica-Bold').fontSize(8).text('GOLIAT COACH / DOCUMENTO', 102, 27, { characterSpacing: 1.2 });
  document.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(22).text(safeText(planType), 102, 42, { width: 325, lineBreak: false, ellipsis: true });
  document.fillColor('#b8c0bd').font('Helvetica').fontSize(8).text(`ATLETA  ${safeText(memberName).toUpperCase()}`, 432, 30, { width: 111, align: 'right', characterSpacing: .55 });
  document.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(9).text(new Date().toLocaleDateString('es-MX'), 432, 47, { width: 111, align: 'right' });
  document.y = 116;
};

const ensureSpace = (document, height, context) => {
  if (document.y + height <= PAGE_BOTTOM) return;
  document.addPage();
  drawPageHeader(document, context);
};

const drawSectionTitle = (document, index, title, subtitle, context) => {
  ensureSpace(document, 70, context);
  document.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(8).text(String(index).padStart(2, '0'), PAGE_MARGIN, document.y + 3, { width: 28 });
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(18).text(safeText(title), PAGE_MARGIN + 34, document.y, { width: CONTENT_WIDTH - 34 });
  document.moveDown(.2);
  if (subtitle) document.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5).text(safeText(subtitle), PAGE_MARGIN + 34, document.y, { width: CONTENT_WIDTH - 34, lineGap: 2 });
  document.moveDown(.75);
  document.strokeColor(COLORS.ink).lineWidth(1).moveTo(PAGE_MARGIN, document.y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, document.y).stroke();
  document.moveDown(.85);
};

const drawSummary = (document, plan, context) => {
  document.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(8).text('PERFIL DEL CICLO', PAGE_MARGIN, document.y, { characterSpacing: 1.1 });
  document.moveDown(.7);
  document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(20).text(safeText(plan.objective, 'Plan personalizado'), { width: CONTENT_WIDTH, lineGap: 1 });
  document.moveDown(.35);
  document.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(safeText(plan.summary, 'Documento preparado por Goliat Coach.'), { width: CONTENT_WIDTH, lineGap: 3 });
  document.moveDown(.8);

  ensureSpace(document, 70, context);
  const y = document.y;
  const columnWidth = CONTENT_WIDTH / 3;
  const summaries = [
    ['DURACIÓN', `${Number(plan.durationWeeks) || 4} semanas`],
    ['NIVEL', safeText(plan.experienceLevel, 'Adaptado')],
    ['FRECUENCIA', safeText(plan.training?.frequency, 'Según disponibilidad')],
  ];
  summaries.forEach(([label, value], index) => {
    const x = PAGE_MARGIN + columnWidth * index;
    document.rect(x, y, columnWidth, 55).fillAndStroke(index === 0 ? COLORS.sage : COLORS.paperDeep, COLORS.ink);
    document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(6.5).text(label, x + 11, y + 10, { width: columnWidth - 22, characterSpacing: .8 });
    document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(11).text(value, x + 11, y + 27, { width: columnWidth - 22, lineBreak: false, ellipsis: true });
  });
  document.y = y + 75;
};

const measureTableRow = (document, columns, row) => Math.max(30, ...columns.map((column) => {
  const value = safeText(row[column.key]);
  return document.font('Helvetica').fontSize(column.fontSize || 7.2).heightOfString(value, { width: column.width - 12, lineGap: 1 }) + 14;
}));

const drawTableHeader = (document, columns, y) => {
  let x = PAGE_MARGIN;
  for (const column of columns) {
    document.rect(x, y, column.width, 26).fill(COLORS.ink);
    document.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(6.4).text(column.label.toUpperCase(), x + 6, y + 9, { width: column.width - 12, lineBreak: false, ellipsis: true, characterSpacing: .35 });
    x += column.width;
  }
  return y + 26;
};

const drawTable = (document, columns, rows, context, continuedLabel) => {
  ensureSpace(document, 58, context);
  let y = drawTableHeader(document, columns, document.y);
  rows.forEach((row, rowIndex) => {
    const height = measureTableRow(document, columns, row);
    if (y + height > PAGE_BOTTOM) {
      document.addPage();
      drawPageHeader(document, context);
      document.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7).text(`${continuedLabel} / CONTINÚA`, PAGE_MARGIN, document.y, { characterSpacing: .7 });
      document.moveDown(.7);
      y = drawTableHeader(document, columns, document.y);
    }
    let x = PAGE_MARGIN;
    columns.forEach((column, columnIndex) => {
      document.rect(x, y, column.width, height).fillAndStroke(rowIndex % 2 ? '#ece8df' : COLORS.white, COLORS.line);
      const value = safeText(row[column.key]);
      document.fillColor(columnIndex === 0 ? COLORS.ink : COLORS.inkSoft)
        .font(columnIndex === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(column.fontSize || 7.2)
        .text(value, x + 6, y + 7, { width: column.width - 12, lineGap: 1 });
      x += column.width;
    });
    y += height;
  });
  document.y = y + 12;
};

const drawCallout = (document, label, text, context) => {
  if (!text) return;
  const body = safeText(text);
  const height = Math.max(46, document.font('Helvetica').fontSize(8).heightOfString(body, { width: CONTENT_WIDTH - 112, lineGap: 2 }) + 22);
  ensureSpace(document, height + 10, context);
  const y = document.y;
  document.rect(PAGE_MARGIN, y, CONTENT_WIDTH, height).fill(COLORS.paperDeep);
  document.rect(PAGE_MARGIN, y, 5, height).fill(COLORS.accent);
  document.fillColor(COLORS.sageDark).font('Helvetica-Bold').fontSize(6.5).text(label.toUpperCase(), PAGE_MARGIN + 16, y + 13, { width: 85, characterSpacing: .65 });
  document.fillColor(COLORS.ink).font('Helvetica').fontSize(8).text(body, PAGE_MARGIN + 106, y + 11, { width: CONTENT_WIDTH - 122, lineGap: 2 });
  document.y = y + height + 12;
};

const drawList = (document, title, items, context, index = 3) => {
  if (!Array.isArray(items) || !items.length) return;
  drawSectionTitle(document, index, title, '', context);
  for (const item of items) {
    const text = safeText(item);
    const height = document.font('Helvetica').fontSize(8.5).heightOfString(text, { width: CONTENT_WIDTH - 25, lineGap: 2 }) + 12;
    ensureSpace(document, height, context);
    document.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9).text('-', PAGE_MARGIN, document.y, { width: 15 });
    document.fillColor(COLORS.inkSoft).font('Helvetica').fontSize(8.5).text(text, PAGE_MARGIN + 20, document.y, { width: CONTENT_WIDTH - 20, lineGap: 2 });
    document.moveDown(.55);
  }
};

const drawTraining = (document, plan, context) => {
  const training = plan.training || {};
  drawSectionTitle(document, 1, 'Plan de entrenamiento', safeText(training.progression, 'Progresión gradual con técnica controlada.'), context);
  const columns = [
    { key: 'exercise', label: 'Ejercicio Atlas', width: 175, fontSize: 7.4 },
    { key: 'target', label: 'Objetivo', width: 75 },
    { key: 'equipment', label: 'Equipo', width: 75 },
    { key: 'sets', label: 'Series', width: 40 },
    { key: 'reps', label: 'Reps', width: 60 },
    { key: 'rest', label: 'Descanso', width: 66 },
  ];
  for (const [index, session] of (training.sessions || []).entries()) {
    ensureSpace(document, 115, context);
    document.fillColor(COLORS.sageDark).font('Helvetica-Bold').fontSize(7).text(`SESIÓN ${String(index + 1).padStart(2, '0')} / ${safeText(session.day).toUpperCase()}`, PAGE_MARGIN, document.y, { characterSpacing: .75 });
    document.moveDown(.3);
    document.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15).text(safeText(session.focus));
    document.moveDown(.35);
    drawCallout(document, 'Activación', session.warmup, context);
    const rows = (session.exercises || []).map((exercise) => ({
      exercise: `${safeText(exercise.name)}${exercise.notes ? `\n${safeText(exercise.notes)}` : ''}`,
      target: safeText(exercise.target),
      equipment: safeText(exercise.equipment),
      sets: safeText(exercise.sets),
      reps: safeText(exercise.reps),
      rest: safeText(exercise.rest),
    }));
    drawTable(document, columns, rows, context, safeText(session.day));
    drawCallout(document, 'Cierre', session.cooldown, context);
    document.moveDown(.45);
  }
};

const drawNutrition = (document, plan, context) => {
  const nutrition = plan.nutrition || {};
  drawSectionTitle(document, 2, 'Plan de nutrición', safeText(nutrition.strategy, 'Estrategia alimentaria individual.'), context);
  drawCallout(document, 'Objetivo diario', nutrition.dailyTarget, context);
  drawCallout(document, 'Hidratación', nutrition.hydration, context);
  const columns = [
    { key: 'moment', label: 'Momento', width: 82, fontSize: 7.4 },
    { key: 'foods', label: 'Alimentos / combinación', width: 202 },
    { key: 'portion', label: 'Porción guía', width: 96 },
    { key: 'purpose', label: 'Propósito', width: 111 },
  ];
  drawTable(document, columns, nutrition.meals || [], context, 'Nutrición');
  if (nutrition.guidelines?.length) drawList(document, 'Criterios de seguimiento', nutrition.guidelines, context, 3);
};

const drawLegacy = (document, plan, context) => {
  drawSectionTitle(document, 1, 'Plan recuperado', 'Contenido creado con una versión anterior de Goliat.', context);
  const rows = String(plan.legacyText || '').split(/\r?\n/).map(stripMarkdown).filter(Boolean).map((text, index) => ({ section: String(index + 1).padStart(2, '0'), content: text }));
  drawTable(document, [{ key: 'section', label: '#', width: 38 }, { key: 'content', label: 'Contenido', width: 453, fontSize: 8 }], rows, context, 'Plan recuperado');
};

const drawProgressTracker = (document, plan, context, index) => {
  const weeks = Math.min(8, Math.max(4, Number(plan.durationWeeks) || 4));
  drawSectionTitle(document, index, 'Bitácora del ciclo', 'Un registro breve para ajustar carga, adherencia y recuperación sin perder contexto.', context);
  const rows = Array.from({ length: weeks }, (_, week) => ({
    week: `Semana ${String(week + 1).padStart(2, '0')}`,
    attendance: '____ / ____',
    progress: 'Carga / reps: __________',
    recovery: '1   2   3   4   5',
    notes: '________________________',
  }));
  drawTable(document, [
    { key: 'week', label: 'Semana', width: 70, fontSize: 7.4 },
    { key: 'attendance', label: 'Asistencia', width: 78 },
    { key: 'progress', label: 'Progresión', width: 130 },
    { key: 'recovery', label: 'Recuperación', width: 93 },
    { key: 'notes', label: 'Nota del coach', width: 120 },
  ], rows, context, 'Bitácora');
};

class PdfService {
  createPlan({ memberName, planType, planContent }) {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: 'A4', margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 16, left: PAGE_MARGIN }, bufferPages: true, autoFirstPage: true, info: { Title: `${planType} - ${memberName}`, Author: 'Goliat System' } });
      const chunks = [];
      const context = { memberName, planType };
      const plan = parsePlanContent(planContent);
      const sections = planSections(planType);
      document.on('data', (chunk) => chunks.push(chunk));
      document.on('error', reject);
      document.on('end', () => resolve(Buffer.concat(chunks)));

      drawPageHeader(document, context);
      if (plan.legacyText) {
        drawLegacy(document, plan, context);
      } else {
        drawSummary(document, plan, context);
        if (sections.training) drawTraining(document, plan, context);
        if (sections.nutrition) {
          if (sections.training && document.y > 600) {
            document.addPage();
            drawPageHeader(document, context);
          }
          drawNutrition(document, plan, context);
        }
        const recoveryIndex = sections.training && sections.nutrition ? 4 : sections.nutrition ? 4 : 2;
        drawList(document, 'Recuperación', plan.recovery, context, recoveryIndex);
        drawList(document, 'Consideraciones', plan.cautions, context, recoveryIndex + 1);
        drawProgressTracker(document, plan, context, recoveryIndex + 2);
      }

      const range = document.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page += 1) {
        document.switchToPage(page);
        document.strokeColor(COLORS.line).lineWidth(.7).moveTo(PAGE_MARGIN, document.page.height - 35).lineTo(PAGE_MARGIN + CONTENT_WIDTH, document.page.height - 35).stroke();
        document.fillColor(COLORS.muted).font('Helvetica').fontSize(7).text(
          `GOLIAT SYSTEM | ${new Date().toLocaleDateString('es-MX')} | ${page + 1}/${range.count}`,
          PAGE_MARGIN,
          document.page.height - 27,
          { width: CONTENT_WIDTH, align: 'center', lineBreak: false },
        );
      }
      document.end();
    });
  }
}

module.exports = { PdfService, stripMarkdown, parsePlanContent, planSections };
