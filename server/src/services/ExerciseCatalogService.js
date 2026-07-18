const fs = require('node:fs');
const path = require('node:path');
const { env } = require('../config/env');
const { AppError } = require('../core/AppError');

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const coachAliases = {
  abdomen: ['abs', 'waist', 'core'], abdominal: ['abs', 'waist', 'core'],
  brazo: ['biceps', 'triceps', 'forearms'], brazos: ['biceps', 'triceps', 'forearms'],
  espalda: ['back', 'lats', 'traps', 'upper back'],
  gluteo: ['glutes', 'hips'], gluteos: ['glutes', 'hips'],
  hombro: ['shoulders', 'delts', 'deltoids'], hombros: ['shoulders', 'delts', 'deltoids'],
  pecho: ['chest', 'pectorals'],
  pierna: ['quads', 'quadriceps', 'hamstrings', 'calves', 'glutes', 'thighs'],
  piernas: ['quads', 'quadriceps', 'hamstrings', 'calves', 'glutes', 'thighs'],
  peso: ['barbell', 'dumbbell', 'kettlebell', 'weighted'],
  maquina: ['lever', 'smith', 'cable'], maquinas: ['lever', 'smith', 'cable'],
  casa: ['body weight', 'band'], gimnasio: ['barbell', 'dumbbell', 'cable', 'lever', 'smith'],
};

const compactExercise = (exercise) => ({
  id: exercise.id,
  name: exercise.name,
  bodyPart: exercise.body_part,
  target: exercise.target,
  equipment: exercise.equipment,
  secondaryMuscles: exercise.secondary_muscles || [],
});

class ExerciseCatalogService {
  constructor() {
    this.exercises = null;
  }

  load() {
    if (!this.exercises) {
      const file = path.join(env.datasetRoot, 'data', 'exercises.json');
      this.exercises = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return this.exercises;
  }

  search({ search = '', category = '', equipment = '', target = '', page = 1, limit = 24 }) {
    const query = normalize(search);
    const categoryValue = normalize(category);
    const equipmentValue = normalize(equipment);
    const targetValue = normalize(target);

    const matches = this.load().filter((exercise) => {
      const searchable = normalize([
        exercise.name,
        exercise.category,
        exercise.target,
        exercise.muscle_group,
        exercise.equipment,
        ...(exercise.secondary_muscles || []),
      ].join(' '));
      return (!query || searchable.includes(query))
        && (!categoryValue || normalize(exercise.category) === categoryValue)
        && (!equipmentValue || normalize(exercise.equipment) === equipmentValue)
        && (!targetValue || normalize(exercise.target) === targetValue);
    });

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24));
    const start = (safePage - 1) * safeLimit;
    return {
      items: matches.slice(start, start + safeLimit),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: matches.length,
        pages: Math.max(1, Math.ceil(matches.length / safeLimit)),
      },
    };
  }

  getById(id) {
    const exercise = this.load().find((item) => item.id === String(id));
    if (!exercise) throw new AppError(404, 'Ejercicio no encontrado');
    return exercise;
  }

  getMeta() {
    const exercises = this.load();
    const unique = (key) => [...new Set(exercises.map((item) => item[key]).filter(Boolean))].sort();
    return {
      total: exercises.length,
      categories: unique('category'),
      equipment: unique('equipment'),
      targets: unique('target'),
      languages: ['en', 'es', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko'],
    };
  }

  getPromptContext(query, limit = 28) {
    return this.getCoachContext(query, [], limit);
  }

  getCoachContext(query, selectedIds = [], limit = 64) {
    const source = this.load();
    const selected = [...new Set(selectedIds.map(String))]
      .slice(0, 24)
      .map((id) => source.find((exercise) => exercise.id === id))
      .filter(Boolean);
    const normalizedQuery = normalize(query);
    const baseTokens = normalizedQuery.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
    const expandedTokens = [...new Set(baseTokens.flatMap((token) => [token, ...(coachAliases[token] || [])]))];
    const ranked = source.map((exercise, index) => {
      const searchable = normalize([
        exercise.name,
        exercise.category,
        exercise.body_part,
        exercise.target,
        exercise.muscle_group,
        exercise.equipment,
        ...(exercise.secondary_muscles || []),
      ].join(' '));
      const score = expandedTokens.reduce((total, token) => total + (searchable.includes(token) ? (token.includes(' ') ? 4 : 2) : 0), 0);
      return { exercise, score, index };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);

    const result = [...selected];
    const seen = new Set(result.map((exercise) => exercise.id));
    for (const { exercise } of ranked) {
      if (result.length >= limit || seen.has(exercise.id)) continue;
      result.push(exercise);
      seen.add(exercise.id);
    }
    const stride = Math.max(1, Math.floor(source.length / Math.max(limit, 1)));
    for (let index = 0; result.length < limit && index < source.length; index += stride) {
      const exercise = source[index];
      if (seen.has(exercise.id)) continue;
      result.push(exercise);
      seen.add(exercise.id);
    }
    return result.slice(0, limit).map(compactExercise);
  }
}

module.exports = { ExerciseCatalogService, normalize, compactExercise };
