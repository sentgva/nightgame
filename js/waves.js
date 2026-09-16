/* waves.js — конфигурация кампании.
   Все 10 уровней описаны данными в массиве LEVELS: никакого отдельного кода
   под конкретный уровень. Меняя эти числа, можно перебалансировать кампанию.

   g(тип, количество, интервал, старт, колонка, опции) — группа врагов;
     колонка: число 0..4 или 'random';
     опции: { hpMul: 1.5 } — усиление врага в конкретной волне.
   wave(...группы) — волна, группы склеиваются и сортируются по времени.
   hpScale — множитель HP всех врагов уровня: так поздние уровни давят
   прочностью, а не числом врагов (лишние враги только разгоняли бы доход). */

function g(type, count, gap, start, col, opts) {
  var out = [];
  for (var i = 0; i < count; i++) {
    var e = { type: type, t: +(start + i * gap).toFixed(2), col: (col === undefined ? 'random' : col) };
    if (opts) for (var k in opts) e[k] = opts[k];
    out.push(e);
  }
  return out;
}

function wave() {
  var list = [];
  for (var i = 0; i < arguments.length; i++) list = list.concat(arguments[i]);
  list.sort(function (a, b) { return a.t - b.t; });
  return { enemies: list };
}

var LEVELS = [
  /* ---------- 1 ---------- только бродяги, обучение */
  {
    id: 1, name: 'Первая ночь', startSparks: 100,
    unlock: ['beacon', 'shooter'], hint: 'Ставь маяки — без искр не будет стрелков',
    waves: [
      wave(g('walker', 2, 3.5, 0)),
      wave(g('walker', 2, 3.0, 0)),
      wave(g('walker', 3, 3.0, 0)),
      wave(g('walker', 3, 2.5, 0)),
      wave(g('walker', 4, 2.5, 0)),
      wave(g('walker', 4, 2.2, 0)),
      wave(g('walker', 5, 2.2, 0)),
      wave(g('walker', 5, 2.0, 0)),
      wave(g('walker', 6, 2.0, 0)),
      wave(g('walker', 8, 1.8, 0))
    ]
  },
  /* ---------- 2 ---------- больше врагов за волну */
  {
    id: 2, name: 'Тихий двор', startSparks: 125,
    unlock: ['barrier'], hint: 'Барьер дёшев и держит удар — прикрой им стрелков',
    waves: [
      wave(g('walker', 3, 3.0, 0)),
      wave(g('walker', 4, 2.6, 0)),
      wave(g('walker', 4, 2.2, 0)),
      wave(g('walker', 5, 2.2, 0)),
      wave(g('walker', 5, 2.0, 0)),
      wave(g('walker', 6, 2.0, 0)),
      wave(g('walker', 6, 1.8, 0)),
      wave(g('walker', 7, 1.8, 0)),
      wave(g('walker', 8, 1.6, 0)),
      wave(g('walker', 10, 1.5, 0))
    ]
  },
  /* ---------- 3 ---------- появляются бегуны */
  {
    id: 3, name: 'Быстрые тени', startSparks: 125,
    unlock: [], hint: 'Бегуны проскакивают поле вдвое быстрее',
    waves: [
      wave(g('walker', 4, 2.6, 0)),
      wave(g('walker', 3, 2.4, 0), g('runner', 1, 0, 6)),
      wave(g('walker', 4, 2.2, 0), g('runner', 2, 3.0, 5)),
      wave(g('walker', 4, 2.2, 0), g('runner', 2, 2.5, 4)),
      wave(g('walker', 5, 2.0, 0), g('runner', 2, 2.5, 5)),
      wave(g('walker', 5, 2.0, 0), g('runner', 3, 2.0, 4)),
      wave(g('walker', 6, 1.8, 0), g('runner', 3, 2.0, 4)),
      wave(g('walker', 6, 1.8, 0), g('runner', 4, 1.8, 3)),
      wave(g('walker', 7, 1.6, 0), g('runner', 4, 1.8, 3)),
      wave(g('walker', 8, 1.5, 0), g('runner', 6, 1.5, 2))
    ]
  },
  /* ---------- 4 ---------- появляются плевуны */
  {
    id: 4, hpScale: 1.05, name: 'Дальний плевок', startSparks: 150,
    unlock: ['freezer'], hint: 'Плевун бьёт издалека — морозильник сбавит ему шаг',
    waves: [
      wave(g('walker', 4, 2.4, 0)),
      wave(g('walker', 4, 2.2, 0), g('spitter', 1, 0, 5)),
      wave(g('walker', 4, 2.0, 0), g('spitter', 2, 3.0, 4), g('runner', 1, 0, 8)),
      wave(g('walker', 5, 2.0, 0), g('spitter', 2, 3.0, 4)),
      wave(g('walker', 5, 1.9, 0), g('spitter', 2, 2.5, 4), g('runner', 2, 2.0, 6)),
      wave(g('walker', 6, 1.8, 0), g('spitter', 3, 2.5, 3)),
      wave(g('walker', 6, 1.8, 0), g('spitter', 3, 2.2, 3), g('runner', 3, 1.8, 5)),
      wave(g('walker', 7, 1.6, 0), g('spitter', 3, 2.2, 3)),
      wave(g('walker', 7, 1.6, 0), g('spitter', 4, 2.0, 2), g('runner', 3, 1.8, 6)),
      wave(g('walker', 9, 1.4, 0), g('spitter', 4, 2.0, 2), g('runner', 5, 1.5, 4))
    ]
  },
  /* ---------- 5 ---------- плотные волны в две колонки, первый босс */
  {
    id: 5, hpScale: 1.1, name: 'Двойной натиск', startSparks: 175,
    unlock: [], hint: 'На финальной волне придёт колосс — копи искры заранее',
    waves: [
      wave(g('walker', 3, 2.2, 0, 1), g('walker', 3, 2.2, 0, 3)),
      wave(g('walker', 3, 2.0, 0, 0), g('runner', 2, 2.5, 2, 4)),
      wave(g('walker', 4, 2.0, 0, 2), g('spitter', 2, 2.8, 1, 0)),
      wave(g('walker', 3, 2.0, 0, 1), g('walker', 3, 2.0, 1, 3), g('runner', 2, 2.0, 5)),
      wave(g('walker', 4, 1.9, 0, 4), g('spitter', 2, 2.5, 2, 2), g('runner', 2, 2.0, 4)),
      wave(g('walker', 4, 1.8, 0, 0), g('walker', 4, 1.8, 0.9, 3)),
      wave(g('walker', 5, 1.7, 0), g('spitter', 3, 2.2, 2), g('runner', 3, 1.8, 4)),
      wave(g('walker', 5, 1.6, 0, 1), g('walker', 5, 1.6, 0.8, 4), g('runner', 2, 2.0, 6)),
      wave(g('walker', 6, 1.5, 0), g('spitter', 3, 2.0, 2), g('runner', 4, 1.6, 4)),
      wave(g('boss', 1, 0, 2, 2), g('walker', 6, 2.0, 6), g('runner', 4, 2.0, 12))
    ]
  },
  /* ---------- 6 ---------- появляются броненосцы */
  {
    id: 6, hpScale: 1.16, name: 'Под бронёй', startSparks: 175,
    unlock: ['shotgun'], hint: 'Броня глотает первые 200 урона — дробовик снимет её быстрее',
    waves: [
      wave(g('walker', 3, 2.2, 0), g('armored', 1, 0, 4)),
      wave(g('walker', 3, 2.0, 0), g('armored', 1, 0, 3), g('runner', 2, 2.0, 6)),
      wave(g('walker', 3, 2.0, 0), g('armored', 2, 4.0, 3)),
      wave(g('walker', 4, 1.9, 0), g('armored', 2, 4.0, 2), g('spitter', 2, 2.5, 5)),
      wave(g('walker', 4, 1.8, 0, 1), g('walker', 3, 1.8, 1, 3), g('armored', 2, 4.0, 4)),
      wave(g('walker', 4, 1.8, 0), g('armored', 2, 3.5, 2), g('runner', 3, 1.6, 5)),
      wave(g('walker', 5, 1.7, 0), g('armored', 2, 3.5, 2), g('spitter', 2, 2.5, 6)),
      wave(g('walker', 5, 1.6, 0), g('armored', 2, 3.0, 2), g('runner', 3, 1.6, 6)),
      wave(g('walker', 5, 1.5, 0), g('armored', 2, 3.0, 2), g('spitter', 2, 2.2, 5)),
      wave(g('walker', 6, 1.4, 0), g('armored', 3, 2.8, 1), g('runner', 4, 1.5, 5), g('spitter', 2, 2.5, 9))
    ]
  },
  /* ---------- 7 ---------- появляются прыгуны */
  {
    id: 7, hpScale: 1.32, name: 'Через ряд', startSparks: 200,
    unlock: [], hint: 'Прыгун один раз перескочит через ряд — держи второй эшелон',
    waves: [
      wave(g('walker', 3, 2.2, 0), g('jumper', 1, 0, 4)),
      wave(g('walker', 3, 2.0, 0), g('jumper', 2, 3.0, 3)),
      wave(g('walker', 3, 2.0, 0), g('jumper', 2, 3.0, 2), g('runner', 2, 2.0, 6)),
      wave(g('walker', 4, 1.9, 0), g('jumper', 3, 2.5, 2), g('armored', 1, 0, 6)),
      wave(g('walker', 4, 1.8, 0), g('jumper', 3, 2.5, 2), g('spitter', 2, 2.5, 6)),
      wave(g('walker', 4, 1.8, 0, 0), g('walker', 3, 1.8, 1, 4), g('jumper', 3, 2.2, 3)),
      wave(g('walker', 5, 1.7, 0), g('jumper', 3, 2.2, 2), g('armored', 2, 3.5, 5)),
      wave(g('walker', 6, 1.5, 0), g('jumper', 4, 1.9, 2), g('runner', 4, 1.5, 6)),
      wave(g('walker', 7, 1.4, 0), g('jumper', 4, 1.9, 2), g('spitter', 3, 2.0, 6), g('armored', 3, 2.8, 8)),
      wave(g('walker', 8, 1.3, 0), g('jumper', 5, 1.7, 1), g('runner', 6, 1.4, 6), g('armored', 3, 2.8, 10))
    ]
  },
  /* ---------- 8 ---------- смешанные волны всех типов */
  {
    id: 8, hpScale: 1.36, name: 'Всё разом', startSparks: 200,
    unlock: ['mine'], hint: 'Мина дешева и снимает 300 урона — ставь её под броненосцев',
    waves: [
      wave(g('walker', 3, 2.0, 0), g('runner', 2, 2.0, 4), g('spitter', 1, 0, 6)),
      wave(g('walker', 3, 2.0, 0), g('armored', 1, 0, 2), g('jumper', 1, 0, 6)),
      wave(g('walker', 4, 1.9, 0), g('runner', 2, 1.8, 3), g('spitter', 2, 2.5, 6)),
      wave(g('walker', 4, 1.8, 0), g('armored', 2, 3.5, 2), g('jumper', 2, 2.5, 6)),
      wave(g('walker', 4, 1.8, 0, 1), g('walker', 3, 1.8, 1, 3), g('runner', 2, 1.8, 5), g('spitter', 2, 2.5, 7)),
      wave(g('walker', 4, 1.7, 0), g('armored', 2, 3.0, 2), g('jumper', 2, 2.2, 5), g('runner', 2, 1.8, 8)),
      wave(g('walker', 4, 1.6, 0), g('spitter', 2, 2.2, 2), g('armored', 2, 3.0, 5)),
      wave(g('walker', 5, 1.5, 0), g('jumper', 3, 2.0, 2), g('runner', 3, 1.6, 6), g('armored', 2, 3.0, 9)),
      wave(g('walker', 5, 1.5, 0), g('spitter', 3, 2.0, 1), g('armored', 2, 2.8, 5), g('jumper', 2, 2.2, 8)),
      wave(g('walker', 7, 1.3, 0), g('runner', 4, 1.4, 4), g('armored', 2, 2.6, 6), g('jumper', 3, 2.0, 9), g('spitter', 2, 2.2, 12))
    ]
  },
  /* ---------- 9 ---------- волны в три колонки одновременно */
  {
    id: 9, hpScale: 1.55, name: 'Три фронта', startSparks: 225,
    unlock: [], hint: 'Фронт идёт тремя колонками — не оставляй дыр',
    waves: [
      wave(g('walker', 2, 2.2, 0, 0), g('walker', 2, 2.2, 0.6, 2), g('walker', 2, 2.2, 1.2, 4)),
      wave(g('walker', 2, 2.0, 0, 1), g('runner', 2, 2.0, 0.6, 3), g('walker', 2, 2.0, 1.2, 0)),
      wave(g('walker', 3, 2.0, 0, 0), g('spitter', 2, 2.6, 1, 2), g('walker', 3, 2.0, 1.4, 4)),
      wave(g('armored', 2, 3.4, 0, 1), g('walker', 3, 1.9, 0.6, 3), g('runner', 2, 1.8, 1.2, 0)),
      wave(g('walker', 3, 1.9, 0, 0), g('jumper', 2, 2.2, 0.8, 2), g('walker', 3, 1.9, 1.4, 4)),
      wave(g('runner', 4, 1.6, 0, 1), g('armored', 2, 3.0, 0.8, 2), g('spitter', 3, 2.0, 1.4, 3)),
      wave(g('walker', 4, 1.6, 0, 0), g('walker', 4, 1.6, 0.7, 2), g('walker', 4, 1.6, 1.4, 4), g('jumper', 2, 2.3, 6)),
      wave(g('armored', 3, 2.8, 0, 2), g('runner', 4, 1.5, 0.8, 0), g('spitter', 3, 2.0, 1.4, 4)),
      wave(g('walker', 4, 1.5, 0, 1), g('jumper', 4, 1.9, 0.8, 3), g('armored', 2, 2.8, 1.4, 0), g('runner', 4, 1.5, 6)),
      wave(g('walker', 6, 1.3, 0), g('runner', 4, 1.4, 3), g('armored', 3, 2.4, 5), g('jumper', 3, 1.9, 8), g('spitter', 3, 2.0, 11))
    ]
  },
  /* ---------- 10 ---------- финал: все типы, максимальная плотность, два усиленных колосса */
  {
    id: 10, hpScale: 1.75, name: 'Последний рубеж', startSparks: 250,
    unlock: [], hint: 'Финал. два усиленных колосса на последней волне',
    waves: [
      wave(g('walker', 3, 2.0, 0), g('runner', 2, 2.0, 4)),
      wave(g('walker', 4, 1.8, 0, 1), g('walker', 4, 1.8, 0.8, 3), g('spitter', 2, 2.4, 5)),
      wave(g('armored', 2, 3.0, 0), g('runner', 4, 1.6, 2), g('jumper', 2, 2.4, 7)),
      wave(g('walker', 4, 1.6, 0, 0), g('walker', 4, 1.6, 0.8, 4), g('spitter', 2, 2.2, 4)),
      wave(g('boss', 1, 0, 3, 1), g('walker', 4, 1.8, 6), g('runner', 3, 1.6, 10)),
      wave(g('armored', 4, 2.4, 0), g('jumper', 4, 1.9, 3), g('runner', 5, 1.4, 6)),
      wave(g('walker', 5, 1.4, 0, 0), g('walker', 5, 1.4, 0.7, 2), g('walker', 5, 1.4, 1.4, 4)),
      wave(g('armored', 4, 2.2, 0), g('spitter', 4, 1.9, 2), g('jumper', 4, 1.8, 5), g('runner', 5, 1.4, 8)),
      wave(g('boss', 1, 0, 2, 3), g('walker', 7, 1.3, 5), g('armored', 3, 2.4, 8), g('jumper', 4, 2.0, 12)),
      wave(
        g('boss', 1, 0, 2, 0, { hpMul: 1.5 }),
        g('boss', 1, 0, 8, 3, { hpMul: 1.5 }),
        g('walker', 7, 1.3, 4),
        g('runner', 6, 1.3, 8),
        g('armored', 3, 2.4, 12),
        g('jumper', 4, 1.8, 16),
        g('spitter', 3, 2.0, 20)
      )
    ]
  }
];

var Waves = {
  levels: LEVELS,

  get: function (levelId) {
    return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelId - 1))];
  },

  /* Какие защитники доступны к началу уровня (накопительно) */
  unlockedAt: function (levelId) {
    var out = [];
    for (var i = 0; i < LEVELS.length && LEVELS[i].id <= levelId; i++) {
      for (var j = 0; j < LEVELS[i].unlock.length; j++) out.push(LEVELS[i].unlock[j]);
    }
    return out;
  },

  /* Бесконечный режим: волны генерируются процедурно и не кончаются */
  endlessLevel: function () {
    return { id: 0, name: 'Бесконечные волны', startSparks: 200, unlock: [], hint: '', waves: [], endless: true };
  },

  endlessWave: function (n) {
    var groups = [];
    var dens = Math.max(1.0, 2.4 - n * 0.06);            // интервал спавна падает с номером волны
    groups.push(g('walker', 3 + Math.floor(n * 0.7), dens, 0));
    if (n >= 3) groups.push(g('runner', 1 + Math.floor(n * 0.4), dens, 2));
    if (n >= 5) groups.push(g('spitter', 1 + Math.floor(n * 0.25), dens + 0.6, 4));
    if (n >= 7) groups.push(g('armored', 1 + Math.floor(n * 0.22), dens + 1.2, 5));
    if (n >= 9) groups.push(g('jumper', 1 + Math.floor(n * 0.22), dens + 0.8, 6));
    if (n % 5 === 0) groups.push(g('boss', 1, 0, 2, Math.floor(Math.random() * 4), { hpMul: 1 + n * 0.1 }));
    return wave.apply(null, groups);
  }
};
