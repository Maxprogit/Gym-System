const { GoogleGenerativeAI } = require('@google/generative-ai');
const { env } = require('../config/env');
const { AppError } = require('../core/AppError');

const normalizeHistory = (messages) => {
  const grouped = [];
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const content = String(message.content || '').trim();
    if (!content) continue;
    if (grouped.at(-1)?.role === role) {
      grouped.at(-1).parts[0].text += `\n${content}`;
    } else {
      grouped.push({ role, parts: [{ text: content }] });
    }
  }
  while (grouped[0]?.role === 'model') grouped.shift();
  return grouped;
};

const cleanText = (value, fallback = '', max = 500) => String(value || fallback).replace(/\s+/g, ' ').trim().slice(0, max);
const cleanList = (value, limit = 12) => (Array.isArray(value) ? value : [])
  .map((item) => cleanText(item, '', 280))
  .filter(Boolean)
  .slice(0, limit);

const parseModelJson = (content) => {
  const source = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(source);
  } catch (_error) {
    throw new AppError(502, 'El Coach devolvió un formato incompleto. Intenta generar el plan nuevamente.');
  }
};

const normalizePlanPayload = (rawPlan, catalogContext, selectedIds = []) => {
  const plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
  const byId = new Map(catalogContext.map((exercise) => [String(exercise.id), exercise]));
  const byName = new Map(catalogContext.map((exercise) => [cleanText(exercise.name).toLowerCase(), exercise]));
  const sessionsSource = Array.isArray(plan.training?.sessions) ? plan.training.sessions : [];
  const usedIds = new Set();

  const sessions = sessionsSource.slice(0, 7).map((session, sessionIndex) => {
    const rawExercises = Array.isArray(session.exercises) ? session.exercises : [];
    let exercises = rawExercises.slice(0, 12).map((entry) => {
      const source = byId.get(String(entry.exerciseId || entry.id || ''))
        || byName.get(cleanText(entry.name).toLowerCase());
      if (!source) return null;
      usedIds.add(String(source.id));
      return {
        exerciseId: String(source.id),
        name: source.name,
        target: source.target || source.bodyPart || '',
        equipment: source.equipment || '',
        sets: cleanText(entry.sets, '3', 20),
        reps: cleanText(entry.reps, '8-12', 30),
        rest: cleanText(entry.rest, '60-90 s', 30),
        tempo: cleanText(entry.tempo, '-', 30),
        notes: cleanText(entry.notes, '', 180),
      };
    }).filter(Boolean);

    if (!exercises.length) {
      exercises = catalogContext.slice(sessionIndex * 4, sessionIndex * 4 + 4).map((source) => {
        usedIds.add(String(source.id));
        return {
          exerciseId: String(source.id), name: source.name, target: source.target || source.bodyPart || '',
          equipment: source.equipment || '', sets: '3', reps: '8-12', rest: '60-90 s', tempo: '-', notes: '',
        };
      });
    }
    return {
      day: cleanText(session.day, `Sesión ${sessionIndex + 1}`, 60),
      focus: cleanText(session.focus, 'Trabajo general', 100),
      warmup: cleanText(session.warmup, 'Movilidad dinámica y activación progresiva.', 280),
      exercises,
      cooldown: cleanText(session.cooldown, 'Vuelta a la calma y movilidad suave.', 280),
    };
  });

  if (!sessions.length) throw new AppError(502, 'El Coach no pudo construir sesiones válidas con el Atlas. Intenta nuevamente.');

  const selected = selectedIds.map(String).filter((id) => byId.has(id));
  for (const id of selected) {
    if (usedIds.has(id)) continue;
    const source = byId.get(id);
    sessions[0].exercises.push({
      exerciseId: id,
      name: source.name,
      target: source.target || source.bodyPart || '',
      equipment: source.equipment || '',
      sets: '3',
      reps: '8-12',
      rest: '60-90 s',
      tempo: '-',
      notes: 'Seleccionado desde Goliat Atlas.',
    });
  }

  const meals = (Array.isArray(plan.nutrition?.meals) ? plan.nutrition.meals : []).slice(0, 10).map((meal, index) => ({
    moment: cleanText(meal.moment, `Comida ${index + 1}`, 60),
    foods: cleanText(meal.foods, 'Comida completa según disponibilidad.', 420),
    portion: cleanText(meal.portion, 'Porción individual', 160),
    purpose: cleanText(meal.purpose, 'Energía y recuperación', 180),
  }));

  return {
    version: 2,
    objective: cleanText(plan.objective, 'Mejorar condición física general.', 280),
    durationWeeks: Math.min(24, Math.max(1, Number(plan.durationWeeks) || 4)),
    experienceLevel: cleanText(plan.experienceLevel, 'Adaptado al atleta', 80),
    summary: cleanText(plan.summary, 'Plan construido con el contexto del atleta y ejercicios verificados en Goliat Atlas.', 500),
    training: {
      frequency: cleanText(plan.training?.frequency, `${sessions.length} sesiones por semana`, 100),
      progression: cleanText(plan.training?.progression, 'Aumentar carga o repeticiones gradualmente sin perder técnica.', 320),
      sessions,
    },
    nutrition: {
      strategy: cleanText(plan.nutrition?.strategy, 'Alimentación equilibrada ajustada al objetivo y tolerancia individual.', 420),
      dailyTarget: cleanText(plan.nutrition?.dailyTarget, 'Ajustar cantidades según progreso, energía y seguimiento profesional.', 260),
      hydration: cleanText(plan.nutrition?.hydration, 'Mantener hidratación constante durante el día.', 220),
      meals: meals.length ? meals : [{ moment: 'Guía diaria', foods: 'Proteína magra, carbohidrato de calidad, vegetales y grasa saludable.', portion: 'Ajustar al objetivo', purpose: 'Energía y recuperación' }],
      guidelines: cleanList(plan.nutrition?.guidelines, 10),
    },
    recovery: cleanList(plan.recovery, 10),
    cautions: cleanList(plan.cautions, 8),
  };
};

class AiService {
  constructor(repository, exerciseCatalog) {
    this.repository = repository;
    this.exerciseCatalog = exerciseCatalog;
    this.client = env.geminiApiKey ? new GoogleGenerativeAI(env.geminiApiKey) : null;
  }

  async generate({ messages, memberName, memberId, selectedExerciseIds = [] }) {
    if (!this.client) throw new AppError(503, 'Gemini no está configurado en el servidor');
    if (!Array.isArray(messages) || messages.length === 0) throw new AppError(400, 'La conversación no puede estar vacía');

    const lastMessage = String(messages.at(-1)?.content || '').trim();
    if (!lastMessage) throw new AppError(400, 'El último mensaje no puede estar vacío');
    if (lastMessage.length > 10_000) throw new AppError(400, 'El mensaje es demasiado largo');

    const selectedIds = Array.isArray(selectedExerciseIds) ? [...new Set(selectedExerciseIds.map(String))].slice(0, 24) : [];
    const conversationContext = messages.slice(-10).map((message) => message.content).join(' ');
    const catalogContext = this.exerciseCatalog.getCoachContext(conversationContext, selectedIds, 72);
    const previousPlans = memberId ? await this.repository.getPlanHistory(memberId, 3) : [];
    const planHistory = previousPlans.map((plan, index) => (
      `Plan ${index + 1} (${plan.PlanType}, ${new Date(plan.CreatedAt).toLocaleDateString('es-MX')}):\n${String(plan.PlanContent).slice(0, 6000)}`
    )).join('\n\n');

    const model = this.client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.35 },
      systemInstruction: `Eres el motor de planificación de Goliat para ${memberName}. Conversas en español y no diagnosticas enfermedades.
Tu respuesta SIEMPRE es JSON válido, sin Markdown y con una de estas dos formas:

Si falta información indispensable:
{"status":"questions","message":"Una pregunta breve y concreta para el entrenador"}

Si ya conoces objetivo, experiencia, disponibilidad, equipo y restricciones:
{"status":"complete","message":"Plan listo.","plan":{"objective":"...","durationWeeks":4,"experienceLevel":"...","summary":"...","training":{"frequency":"...","progression":"...","sessions":[{"day":"Lunes","focus":"...","warmup":"...","exercises":[{"exerciseId":"ID exacto del catálogo","sets":"3","reps":"8-12","rest":"75 s","tempo":"3-1-1","notes":"..."}],"cooldown":"..."}]},"nutrition":{"strategy":"...","dailyTarget":"...","hydration":"...","meals":[{"moment":"Desayuno","foods":"...","portion":"...","purpose":"..."}],"guidelines":["..."]},"recovery":["..."],"cautions":["..."]}}

Cuando completes el plan, crea entrenamiento Y nutrición para permitir exportar tres documentos: entrenamiento, nutrición o integral. No escribas el plan dentro de message. Usa únicamente exerciseId presentes en el catálogo adjunto. Los IDs seleccionados por el entrenador deben aparecer en las sesiones cuando sean compatibles.

GOLIAT ATLAS - EJERCICIOS VERIFICADOS:
${JSON.stringify(catalogContext)}

IDS SELECCIONADOS POR EL ENTRENADOR:
${JSON.stringify(selectedIds)}

HISTORIAL DEL ATLETA:
${planHistory || 'Sin planes anteriores.'}`,
    });

    const history = normalizeHistory(messages.slice(-10, -1));
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage);
    const parsed = parseModelJson(result.response.text());
    const isComplete = parsed.status === 'complete' && parsed.plan;
    if (!isComplete) {
      return {
        message: cleanText(parsed.message, 'Necesito un poco más de contexto para construir el documento.', 500),
        isComplete: false,
        planContent: null,
        planType: null,
      };
    }

    const plan = normalizePlanPayload(parsed.plan, catalogContext, selectedIds);
    return {
      message: 'Plan listo.',
      isComplete: true,
      planContent: JSON.stringify(plan),
      planType: 'Plan integral',
      exerciseIds: [...new Set(plan.training.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.exerciseId)))],
    };
  }
}

module.exports = { AiService, normalizeHistory, parseModelJson, normalizePlanPayload };
