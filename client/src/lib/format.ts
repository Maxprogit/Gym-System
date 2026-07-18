export const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export const shortDate = (value: string | Date | null) => value
  ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'Sin fecha';

export const monthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(new Date(year, month - 1, 1));
};

export const titleCase = (value: string) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

const fitnessTranslations: Record<string, string> = {
  back: 'espalda', cardio: 'cardio', chest: 'pecho', 'lower arms': 'antebrazos',
  'lower legs': 'pantorrillas', neck: 'cuello', shoulders: 'hombros',
  'upper arms': 'brazos', 'upper legs': 'piernas', waist: 'abdomen',
  assisted: 'asistido', band: 'banda', barbell: 'barra', 'body weight': 'peso corporal',
  cable: 'polea', dumbbell: 'mancuerna', 'elliptical machine': 'elíptica',
  'ez barbell': 'barra EZ', kettlebell: 'pesa rusa', 'leverage machine': 'máquina de palanca',
  'medicine ball': 'balón medicinal', 'resistance band': 'banda de resistencia',
  rope: 'cuerda', 'smith machine': 'máquina Smith', 'stability ball': 'pelota de estabilidad',
  'stationary bike': 'bicicleta fija', weighted: 'con peso',
  abductors: 'abductores', abs: 'abdominales', adductors: 'aductores', biceps: 'bíceps',
  calves: 'pantorrillas', 'cardiovascular system': 'sistema cardiovascular', delts: 'deltoides',
  forearms: 'antebrazos', glutes: 'glúteos', hamstrings: 'isquiotibiales', lats: 'dorsales',
  pectorals: 'pectorales', quads: 'cuádriceps', spine: 'columna', traps: 'trapecios',
  triceps: 'tríceps', 'upper back': 'espalda alta',
};

export const fitnessLabel = (value: string) => titleCase(fitnessTranslations[value.toLowerCase()] || value);
