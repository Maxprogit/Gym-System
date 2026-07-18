const planFixture = {
  version: 2,
  objective: 'Ganancia de masa muscular con técnica consistente',
  durationWeeks: 6,
  experienceLevel: 'Intermedio',
  summary: 'Ciclo progresivo de cuatro sesiones con nutrición orientada a rendimiento y recuperación.',
  training: {
    frequency: '4 sesiones por semana',
    progression: 'Aumentar una repetición por serie antes de incrementar la carga entre 2 y 5 por ciento.',
    sessions: [
      {
        day: 'Lunes',
        focus: 'Pecho y tríceps',
        warmup: 'Ocho minutos de movilidad de hombro, activación escapular y dos series progresivas.',
        exercises: [
          { exerciseId: '0001', name: 'barbell bench press', target: 'pectorals', equipment: 'barbell', sets: '4', reps: '6-8', rest: '120 s', tempo: '3-1-1', notes: 'Mantener escápulas estables.' },
          { exerciseId: '0002', name: 'cable fly', target: 'pectorals', equipment: 'cable', sets: '3', reps: '10-12', rest: '75 s', tempo: '2-1-2', notes: '' },
          { exerciseId: '0003', name: 'rope pushdown', target: 'triceps', equipment: 'cable', sets: '3', reps: '10-15', rest: '60 s', tempo: '2-0-2', notes: '' },
        ],
        cooldown: 'Movilidad de pectoral y respiración controlada durante cinco minutos.',
      },
      {
        day: 'Miércoles',
        focus: 'Pierna completa',
        warmup: 'Movilidad de cadera, tobillo y activación de glúteos.',
        exercises: [
          { exerciseId: '0004', name: 'smith squat', target: 'quadriceps', equipment: 'smith machine', sets: '4', reps: '8-10', rest: '120 s', tempo: '3-1-1', notes: 'Rango cómodo y controlado.' },
          { exerciseId: '0005', name: 'romanian deadlift', target: 'hamstrings', equipment: 'barbell', sets: '3', reps: '8-10', rest: '100 s', tempo: '3-1-1', notes: '' },
        ],
        cooldown: 'Caminata suave y movilidad de cadera.',
      },
    ],
  },
  nutrition: {
    strategy: 'Distribuir proteína y carbohidratos a lo largo del día con prioridad alrededor del entrenamiento.',
    dailyTarget: 'Mantener un superávit moderado y ajustar según el promedio semanal de peso.',
    hydration: 'Entre 30 y 35 ml de agua por kilogramo, más lo perdido durante el entrenamiento.',
    meals: [
      { moment: 'Desayuno', foods: 'Avena, yogur natural, fruta y huevo', portion: '1 plato completo', purpose: 'Energía sostenida' },
      { moment: 'Comida', foods: 'Arroz, pollo, verduras y aceite de oliva', portion: '1 plato completo', purpose: 'Recuperación' },
      { moment: 'Pre entrenamiento', foods: 'Fruta y yogur o sándwich sencillo', portion: '1 colación', purpose: 'Disponibilidad de energía' },
      { moment: 'Cena', foods: 'Pescado, papa y ensalada', portion: '1 plato completo', purpose: 'Proteína y saciedad' },
    ],
    guidelines: ['Registrar energía y digestión.', 'Ajustar porciones cada dos semanas.', 'Consultar a un profesional ante una condición clínica.'],
  },
  recovery: ['Dormir entre siete y nueve horas.', 'Programar al menos un día completo de recuperación.'],
  cautions: ['Detener cualquier ejercicio que produzca dolor agudo.'],
};

module.exports = { planFixture };
