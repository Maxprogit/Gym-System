const { GoogleGenerativeAI } = require('@google/generative-ai');
const { env } = require('../config/env');
const { AppError } = require('../core/AppError');
const { loadCatalog, catalogPromptText, normalizeKey } = require('./nutritionCatalog');

const MODEL_CHAIN = (process.env.GEMINI_MODELS || 'gemini-3.8-flash,gemini-3.5-flash-lite,gemini-2.5-flash')
  .split(',').map((name) => name.trim()).filter(Boolean);
const UNAVAILABLE_STATUS = new Set([403, 404]); 
const ATTEMPTS_PER_MODEL = 2;
const ATTEMPT_TIMEOUT_MS = 35_000;   // tope por intento
const TOTAL_BUDGET_MS = 80_000;      // menor que los 90 s del frontend
const THINKING_BUDGET = 1024;        // modelos 2.x: tokens de "razonamiento"; 0 = más rápido
const THINKING_LEVEL = 'low';        // modelos 3.x: 'minimal' | 'low' | 'medium' | 'high'
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isLegacyModel = (name) => /^gemini-2\./.test(name);

// Los modelos 2.x usan thinkingBudget y los 3.x usan thinkingLevel.
// En los 3.x se deja la temperatura por defecto (Google lo recomienda).
const buildGenerationConfig = (modelName, withThinking) => {
  const config = { responseMimeType: 'application/json' };
  if (isLegacyModel(modelName)) {
    config.temperature = 0.35;
    if (withThinking) config.thinkingConfig = { thinkingBudget: THINKING_BUDGET };
  } else if (withThinking) {
    config.thinkingConfig = { thinkingLevel: THINKING_LEVEL };
  }
  return config;
};

const isRetryable = (error) => RETRYABLE_STATUS.has(error?.status)
  || /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|aborted|timeout|overloaded|high demand/i.test(String(error?.message));

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

const formatRations = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

// Grupos de cantidad libre: no llevan raciones.
const FREE_GROUPS = new Set(['verduras_b', 'libres']);

// mode "menu": cada comida trae alimentos concretos del catálogo con su porción.
// mode "guide": cada comida solo trae grupos y raciones; el atleta elige los alimentos en la guía.
const normalizeMeals = (rawMeals, mode = 'menu') => {
  const catalog = loadCatalog();
  const meals = (Array.isArray(rawMeals) ? rawMeals : []).slice(0, 10).map((meal, index) => {
    const items = (Array.isArray(meal.items) ? meal.items : []).slice(0, 12).map((item) => {
      const group = catalog.byId.get(String(item.group || item.groupId || ''));
      if (!group) return null;
      const rations = Math.min(20, Math.max(0, Math.round((Number(item.rations) || 0) * 2) / 2));
      if (mode === 'guide') {
        if (!rations && !FREE_GROUPS.has(group.id)) return null;
        return { group: group.id, groupName: group.name, rations, foods: [] };
      }
      const foodsByName = new Map(group.foods.map((food) => [normalizeKey(food.name), food]));
      const foods = (Array.isArray(item.foods) ? item.foods : []).slice(0, 10).map((entry) => {
        const source = foodsByName.get(normalizeKey(entry.name));
        if (!source) return null;
        return { name: source.name, portion: cleanText(entry.portion, source.portion || '', 90) };
      }).filter(Boolean);
      if (!foods.length) return null;
      return { group: group.id, groupName: group.name, rations, foods };
    }).filter(Boolean);

    const foodsSummary = (mode === 'guide'
      ? items.map((item) => item.groupName).join(' | ')
      : items
        .map((item) => `${item.groupName}: ${item.foods.map((food) => (food.portion ? `${food.name} (${food.portion})` : food.name)).join(', ')}`)
        .join(' | '))
      .slice(0, 900);
    const portionSummary = items
      .filter((item) => item.rations > 0)
      .map((item) => `${item.groupName} ${formatRations(item.rations)}`)
      .join(', ')
      .slice(0, 300);

    return {
      moment: cleanText(meal.moment, `Comida ${index + 1}`, 60),
      time: cleanText(meal.time, '', 20),
      items,
      foods: items.length ? foodsSummary : cleanText(meal.foods, 'Comida completa según disponibilidad.', 420),
      portion: items.length ? (portionSummary || 'Libre') : cleanText(meal.portion, 'Porción individual', 160),
      purpose: cleanText(meal.purpose, 'Energía y recuperación', 180),
    };
  });

  const totals = new Map();
  for (const meal of meals) {
    for (const item of meal.items) {
      if (!item.rations) continue;
      totals.set(item.group, { group: item.group, groupName: item.groupName, rations: (totals.get(item.group)?.rations || 0) + item.rations });
    }
  }
  return { meals, dailyRations: [...totals.values()] };
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

  const nutritionMode = plan.nutrition?.mode === 'guide' ? 'guide' : 'menu';
  const { meals, dailyRations } = normalizeMeals(plan.nutrition?.meals, nutritionMode);

  return {
    version: 3,
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
      mode: nutritionMode,
      strategy: cleanText(plan.nutrition?.strategy, 'Alimentación equilibrada ajustada al objetivo y tolerancia individual.', 420),
      dailyTarget: cleanText(plan.nutrition?.dailyTarget, 'Ajustar cantidades según progreso, energía y seguimiento profesional.', 260),
      hydration: cleanText(plan.nutrition?.hydration, 'Mantener hidratación constante durante el día.', 220),
      meals: meals.length ? meals : [{ moment: 'Guía diaria', time: '', items: [], foods: 'Proteína magra, carbohidrato de calidad, vegetales y grasa saludable.', portion: 'Ajustar al objetivo', purpose: 'Energía y recuperación' }],
      dailyRations,
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

  // Llama a Gemini con reintentos (backoff + jitter) y modelo de respaldo.
  // Reintenta ante 429/5xx, timeouts y JSON mal formado. No reintenta errores 400/401/403.
  async callModel({ systemInstruction, history, lastMessage }) {
    const startedAt = Date.now();
    let lastError;

    for (const modelName of MODEL_CHAIN) {
      let withThinking = true;
      for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt += 1) {
        const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
        if (remaining < 8_000) break;

        try {
          const model = this.client.getGenerativeModel(
            {
              model: modelName,
              generationConfig: buildGenerationConfig(modelName, withThinking),
              systemInstruction,
            },
            { timeout: Math.min(ATTEMPT_TIMEOUT_MS, remaining - 2_000) },
          );
          const chat = model.startChat({ history });
          const result = await chat.sendMessage(lastMessage);
          return parseModelJson(result.response.text());
        } catch (error) {
          lastError = error;
          const badFormat = error instanceof AppError; // solo parseModelJson lanza AppError aquí
          console.warn(`[AI] ${modelName} intento ${attempt + 1}/${ATTEMPTS_PER_MODEL} falló: ${error.status || ''} ${error.message}`.slice(0, 300));
          // Si el modelo rechaza la configuración de "thinking", se reintenta sin ella.
          if (error?.status === 400 && /thinking/i.test(String(error.message)) && withThinking) {
            withThinking = false;
            continue;
          }
          // Cuota gratuita agotada en este modelo: cada modelo tiene su propia cuota, pasar al siguiente.
          if (error?.status === 429) {
            console.warn(`[AI] ${modelName} sin cuota por ahora; probando el siguiente modelo.`);
            break;
          }
          if (UNAVAILABLE_STATUS.has(error?.status)) {
            console.warn(`[AI] ${modelName} no está disponible para esta API key; probando el siguiente modelo.`);
            break;
          }
          if (!badFormat && !isRetryable(error)) throw error;
          await sleep(700 * 2 ** attempt + Math.random() * 300);
        }
      }
    }

    console.error('[AI] Todos los intentos fallaron:', lastError?.message);
    if (lastError instanceof AppError) throw lastError;
    throw new AppError(503, 'El Coach está saturado en este momento. Intenta de nuevo en unos segundos.');
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
    const previousPlans = memberId ? await this.repository.getPlanHistory(memberId, 2) : [];
    const planHistory = previousPlans.map((plan, index) => (
      `Plan ${index + 1} (${plan.PlanType}, ${new Date(plan.CreatedAt).toLocaleDateString('es-MX')}):\n${String(plan.PlanContent).slice(0, 3000)}`
    )).join('\n\n');

    const systemInstruction = `Eres el motor de planificación de Goliat para ${memberName}. Conversas en español y no diagnosticas enfermedades.
Tu respuesta SIEMPRE es JSON válido, sin Markdown y con una de estas dos formas:

Si falta información indispensable:
{"status":"questions","message":"Una pregunta breve y concreta para el entrenador"}

Si ya conoces objetivo, experiencia, disponibilidad, equipo y restricciones:
{"status":"complete","message":"Plan listo.","plan":{"objective":"...","durationWeeks":4,"experienceLevel":"...","summary":"...","training":{"frequency":"...","progression":"...","sessions":[{"day":"Lunes","focus":"...","warmup":"...","exercises":[{"exerciseId":"ID exacto del catálogo","sets":"3","reps":"8-12","rest":"75 s","tempo":"3-1-1","notes":"..."}],"cooldown":"..."}]},"nutrition":{"mode":"menu","strategy":"...","dailyTarget":"...","hydration":"...","meals":[{"moment":"Desayuno","time":"8:00 AM","purpose":"...","items":[{"group":"id exacto del grupo","rations":2,"foods":[{"name":"nombre exacto del alimento en el catálogo","portion":"1 taza"}]}]}],"guidelines":["..."]},"recovery":["..."],"cautions":["..."]}}

Cuando completes el plan, crea entrenamiento Y nutrición para permitir exportar tres documentos: entrenamiento, nutrición o integral. No escribas el plan dentro de message. Usa únicamente exerciseId presentes en el catálogo adjunto. Los IDs seleccionados por el entrenador deben aparecer en las sesiones cuando sean compatibles.

MODO DE ENTREGA DE LA NUTRICIÓN (campo "mode" dentro de "nutrition"):
- "menu" (menú preparado, el predeterminado): armas cada comida con alimentos concretos del catálogo y su porción. El documento no incluye la guía de alimentos.
- "guide" (guía por raciones): en cada comida solo indicas el horario y las raciones por grupo, sin alimentos (omite "foods"). El documento incluye la guía de alimentos para que el atleta elija con qué cubrir sus raciones.
- Antes de completar el plan debes saber cuál quiere el entrenador. Si la conversación no lo indica, pregúntalo una sola vez con status "questions", explicando las dos opciones en el mismo mensaje. Por ejemplo: "Puedo armarte el plan de nutrición completo, con alimentos y porciones en cada comida, o darte solo las raciones y horarios de cada comida con una guía para que tú elijas tus alimentos. ¿Cuál prefieres?". Si responde que lo decidas tú o que le da igual, usa "menu". Esta pregunta puede ser más larga que las demás porque explica ambas opciones.

REGLAS DE NUTRICIÓN (sistema de equivalentes por raciones):
- Tú decides todo para este atleta: número de comidas, horario de cada una (campo "time"), raciones por grupo y, en modo "menu", los alimentos con su porción. Si el entrenador indicó horarios o preferencias de comida, respétalos; si no, propón horarios acordes a su rutina y disponibilidad. No uses horarios ni raciones fijos ni copiados de otros atletas.
- Calcula las raciones diarias por grupo según objetivo, peso, nivel de actividad y restricciones del atleta.
- Cada elemento de "items" usa un "group" que exista en el catálogo de equivalentes. En modo "menu" incluye "foods" con nombres EXACTOS de ese mismo grupo; en modo "guide" omite "foods". Nunca inventes alimentos ni grupos.
- "rations" es el número de raciones de ese grupo en esa comida (admite medias, por ejemplo 1.5). Para verduras_b y libres usa 0 porque son de cantidad libre.
- En modo "menu", "portion" es la cantidad concreta del alimento: la porción de una ración del catálogo multiplicada por las raciones que asignas. Si el alimento no trae porción en el catálogo, escribe solo el número de raciones (por ejemplo "2 raciones"), sin inventar gramos ni medidas.
- Prefiere los alimentos marcados [MR] (muy recomendado), usa los que no tienen marca (recomendado) como complemento y evita los marcados [PR] (poco recomendado) salvo que el entrenador los pida.
- Respeta alergias, intolerancias y preferencias alimentarias que el entrenador mencione.
- En modo "menu", cada comida debe incluir al menos un grupo con al menos un alimento. En modo "guide", cada comida debe incluir al menos un grupo con raciones.

CATÁLOGO DE EQUIVALENTES DE NUTRICIÓN:
Formato: cada grupo empieza con "## id=... | Nombre | referencia | nota". Debajo, los alimentos separados por ";" con el formato "Nombre = porción de 1 ración [nivel]". En el JSON de salida usa SOLO el nombre (sin " = porción" ni la marca de nivel) en "name", y el id exacto del grupo en "group".
${catalogPromptText()}

GOLIAT ATLAS - EJERCICIOS VERIFICADOS:
${JSON.stringify(catalogContext)}

IDS SELECCIONADOS POR EL ENTRENADOR:
${JSON.stringify(selectedIds)}

HISTORIAL DEL ATLETA:
${planHistory || 'Sin planes anteriores.'}`;

    const history = normalizeHistory(messages.slice(-10, -1));
    const parsed = await this.callModel({ systemInstruction, history, lastMessage });

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