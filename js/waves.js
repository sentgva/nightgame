/* waves.js — конфигурация кампании: три планеты, 30 уровней.

   Уровень описывается компактным паспортом, волны из него разворачивает mk().
   Так 30 уровней остаются читаемыми данными, а не тремя сотнями строк вручную.

   Паспорт уровня:
     pool     — [тип, с какой волны появляется, вес] — из чего собирается волна
     base     — врагов в первой волне, growth — прибавка за каждую следующую
     gap      — интервал спавна в первой волне (дальше сокращается)
     cols     — сколько колонок задействовано за волну (не задано — случайные)
     boss     — { wave, count, hpMul }
     hpScale  — множитель HP всех врагов уровня: поздние уровни давят
                прочностью, а не числом (лишние враги только разгоняли бы доход)
     craters  — сколько клеток выжжено (механика второй планеты)
     iceEvery — раз во сколько секунд юнит покрывается льдом (третья планета) */

var COLS = 5;

/* Общий регулятор плотности всей кампании: один рычаг вместо правки
   тридцати паспортов. Доход идёт только во время волн, поэтому плотность
   и экономика связаны напрямую — крутить их надо вместе. */
var DENSITY = 0.78;

/* g(тип, количество, интервал, старт, колонка, опции) — группа врагов */
function g(type, count, gap, start, col, opts) {
  var out = [];
  for (var i = 0; i < count; i++) {
    var e = { type: type, t: +(start + i * gap).toFixed(2), col: (col === undefined ? 'random' : col) };
    if (opts) for (var k in opts) e[k] = opts[k];
    out.push(e);
  }
  return out;
}

/* wave(...группы) — волна: группы склеиваются и сортируются по времени */
function wave() {
  var list = [];
  for (var i = 0; i < arguments.length; i++) list = list.concat(arguments[i]);
  list.sort(function (a, b) { return a.t - b.t; });
  return { enemies: list };
}

/* Детерминированный генератор: один и тот же уровень всегда одинаковый,
   иначе переигрывать после поражения было бы нечестно. */
function rng(seed) {
  var s = (seed >>> 0) || 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* Раньше этих волн тяжёлый враг не выходит ни на одном уровне.
   Броненосец или лекарь в первой волне позднего уровня — это не сложность,
   а срыв партии до того, как игрок успел что-то построить. */
var MIN_WAVE = { armored: 3, phantom: 3, swarm: 4, healer: 5 };

/* Разворачивает паспорт уровня в 10 волн */
function mk(o) {
  var rand = rng(o.id * 7919 + 13);
  var waves = [];

  for (var w = 1; w <= 10; w++) {
    var groups = [];
    var count = Math.round((o.base + o.growth * (w - 1)) * DENSITY * (w === 10 ? 1.3 : 1));
    var gap = Math.max(1.1, o.gap - (w - 1) * 0.07);

    // Какие типы уже вышли на сцену к этой волне
    // Типы выходят лесенкой: по паре за волну. Без этого поздние уровни
    // вываливали все восемь видов врагов уже в первой волне.
    var types = [], totalW = 0;
    for (var i = 0; i < o.pool.length; i++) {
      var appearAt = Math.max(o.pool[i][1], 1 + Math.floor(i / 2), MIN_WAVE[o.pool[i][0]] || 1);
      if (appearAt <= w) { types.push(o.pool[i]); totalW += o.pool[i][2]; }
    }

    // Колонки волны: либо случайные, либо фиксированный набор
    var lanes = null;
    if (o.cols) {
      lanes = [];
      var free = [0, 1, 2, 3, 4];
      for (var c = 0; c < o.cols && free.length; c++) {
        lanes.push(free.splice(Math.floor(rand() * free.length), 1)[0]);
      }
    }

    var offset = 0;
    for (var j = 0; j < types.length; j++) {
      var n = Math.max(1, Math.round(count * types[j][2] / totalW));
      var col = (lanes && j < types.length - 1) ? lanes[j % lanes.length] : 'random';
      groups.push(g(types[j][0], n, gap, offset, col));
      offset += 1.1;
    }

    if (o.boss && o.boss.wave === w) {
      for (var b = 0; b < (o.boss.count || 1); b++) {
        groups.push(g('boss', 1, 0, 2 + b * 7, Math.floor(rand() * (COLS - 1)),
          { hpMul: o.boss.hpMul || 1 }));
      }
    }

    waves.push(wave.apply(null, groups));
  }

  return {
    id: o.id, planet: o.planet, name: o.name, hint: o.hint,
    startSparks: o.startSparks, hpScale: o.hpScale || 1,
    unlock: o.unlock || [], craters: o.craters || 0, iceEvery: o.iceEvery || 0,
    waves: waves
  };
}

/* ---------------------------------------------------------------------- */

var PLANETS = [
  {
    id: 1, name: 'Ферма', sub: 'Где всё началось', levels: 5, mechanic: null,
    desc: 'Тихое поле и обычные твари. Учимся держать строй.'
  },
  {
    id: 2, name: 'Пепельные пустоши', sub: 'Выжженная земля', levels: 10, mechanic: 'craters',
    desc: 'Часть клеток выжжена — строить на них нельзя. Из пепла лезут фантомы.'
  },
  {
    id: 3, name: 'Ледяная станция', sub: 'Мороз и тьма', levels: 15, mechanic: 'ice',
    desc: 'Защитники покрываются льдом и замолкают. Коснись, чтобы отогреть.'
  }
];

var LEVELS = [
  /* ===================== ПЛАНЕТА 1 — ФЕРМА ===================== */
  mk({ id: 1, planet: 1, name: 'Первая ночь', startSparks: 100,
       unlock: ['beacon', 'shooter'], hint: 'Ставь маяки — без искр не будет стрелков',
       pool: [['walker', 1, 1]], base: 3, growth: 0.7, gap: 3.0 }),

  mk({ id: 2, planet: 1, name: 'Тихий двор', startSparks: 125,
       unlock: ['barrier'], hint: 'Барьер дёшев и держит удар — прикрой им стрелков',
       pool: [['walker', 1, 1]], base: 4, growth: 0.9, gap: 2.6 }),

  mk({ id: 3, planet: 1, name: 'Быстрые тени', startSparks: 125,
       unlock: ['mine'], hint: 'Бегуны проскакивают поле вдвое быстрее',
       pool: [['walker', 1, 3], ['runner', 2, 2]], base: 4, growth: 1.0, gap: 2.5 }),

  mk({ id: 4, planet: 1, name: 'Через ряд', startSparks: 150, hpScale: 1.028,
       unlock: ['freezer'], hint: 'Прыгун один раз перескочит через ряд защитников',
       pool: [['walker', 1, 3], ['runner', 2, 2], ['jumper', 3, 2]],
       base: 5, growth: 1.0, gap: 2.4 }),

  mk({ id: 5, planet: 1, name: 'Гость с холма', startSparks: 175, hpScale: 1.055,
       hint: 'На финальной волне придёт колосс — копи искры заранее',
       pool: [['walker', 1, 3], ['runner', 1, 2], ['jumper', 2, 2]],
       base: 5, growth: 1.1, gap: 2.3, boss: { wave: 10, count: 1, hpMul: 1 } }),

  /* ============== ПЛАНЕТА 2 — ПЕПЕЛЬНЫЕ ПУСТОШИ ============== */
  mk({ id: 6, planet: 2, name: 'Пепел', startSparks: 175, hpScale: 1.055, craters: 3,
       unlock: ['shotgun'], hint: 'Выжженные клетки заняты навсегда. Пепельник взрывается при смерти',
       pool: [['walker', 1, 3], ['runner', 3, 2], ['burster', 1, 2]],
       base: 5, growth: 1.0, gap: 2.4 }),

  mk({ id: 7, planet: 2, name: 'Кратеры', startSparks: 175, hpScale: 1.088, craters: 4,
       hint: 'Плевун бьёт с двух клеток и не подходит вплотную',
       pool: [['walker', 1, 3], ['runner', 4, 2], ['burster', 1, 2], ['spitter', 2, 2]],
       base: 5, growth: 1.1, gap: 2.3 }),

  mk({ id: 8, planet: 2, name: 'Броня и пыль', startSparks: 200, hpScale: 1.121, craters: 4,
       unlock: ['repeater'], hint: 'Броня глотает первые 200 урона — дуплет снимет её вдвое быстрее',
       pool: [['walker', 1, 3], ['burster', 2, 2], ['spitter', 3, 2], ['armored', 1, 2]],
       base: 5, growth: 1.1, gap: 2.2 }),

  mk({ id: 9, planet: 2, name: 'Призраки пустошей', startSparks: 200, hpScale: 1.154, craters: 4,
       hint: 'Фантом уходит в фазу — в этот момент снаряды проходят насквозь',
       pool: [['walker', 1, 2], ['burster', 3, 2], ['armored', 2, 2], ['phantom', 1, 2]],
       base: 6, growth: 1.1, gap: 2.2 }),

  mk({ id: 10, planet: 2, name: 'Вожак пепла', startSparks: 225, hpScale: 1.176, craters: 5,
       hint: 'Колосс на финальной волне и кратеры по всему полю',
       pool: [['walker', 1, 2], ['burster', 1, 2], ['armored', 3, 2], ['phantom', 2, 2]],
       base: 6, growth: 1.2, gap: 2.1, boss: { wave: 10, count: 1, hpMul: 1.2 } }),

  mk({ id: 11, planet: 2, name: 'Разлом', startSparks: 225, hpScale: 1.198, craters: 5, cols: 2,
       unlock: ['magnet'], hint: 'Магнит срывает броню целиком — ставь его к броненосцам',
       pool: [['walker', 1, 2], ['spitter', 2, 2], ['armored', 1, 3], ['phantom', 3, 2]],
       base: 6, growth: 1.2, gap: 2.1 }),

  mk({ id: 12, planet: 2, name: 'Чёрный ветер', startSparks: 225, hpScale: 1.231, craters: 5, cols: 2,
       hint: 'Две колонки давят одновременно',
       pool: [['walker', 1, 2], ['runner', 1, 2], ['burster', 2, 2], ['armored', 4, 2], ['phantom', 2, 2]],
       base: 6, growth: 1.2, gap: 2.0 }),

  mk({ id: 13, planet: 2, name: 'Горн и наковальня', startSparks: 250, hpScale: 1.253, craters: 5, cols: 2,
       unlock: ['torch'], hint: 'Снаряд, прошедший сквозь горн, бьёт в полтора раза сильнее',
       pool: [['walker', 1, 2], ['spitter', 3, 2], ['jumper', 2, 2], ['armored', 1, 2], ['phantom', 2, 2]],
       base: 6, growth: 1.3, gap: 2.0 }),

  mk({ id: 14, planet: 2, name: 'Стеклянное поле', startSparks: 250, hpScale: 1.275, craters: 6, cols: 3,
       hint: 'Кратеров больше, чем свободных рядов',
       pool: [['walker', 1, 2], ['runner', 3, 2], ['burster', 1, 2], ['armored', 1, 2], ['phantom', 2, 2]],
       base: 7, growth: 1.3, gap: 1.9 }),

  mk({ id: 15, planet: 2, name: 'Две тени', startSparks: 275, hpScale: 1.297, craters: 6, cols: 3,
       hint: 'Финал планеты: два колосса разом',
       pool: [['walker', 1, 2], ['burster', 2, 2], ['spitter', 3, 2], ['armored', 1, 2], ['phantom', 1, 2]],
       base: 7, growth: 1.3, gap: 1.9, boss: { wave: 10, count: 2, hpMul: 1.3 } }),

  /* ============== ПЛАНЕТА 3 — ЛЕДЯНАЯ СТАНЦИЯ ============== */
  mk({ id: 16, planet: 3, name: 'Шлюз', startSparks: 300, hpScale: 1.242, iceEvery: 14,
       unlock: ['fan'], hint: 'Лёд сковывает защитника — коснись его, чтобы отогреть',
       pool: [['walker', 1, 3], ['runner', 1, 2], ['armored', 2, 2]],
       base: 6, growth: 1.2, gap: 2.2 }),

  mk({ id: 17, planet: 3, name: 'Иней', startSparks: 300, hpScale: 1.266, iceEvery: 13,
       hint: 'Веер бьёт в три колонки — он окупается в тесноте',
       pool: [['walker', 1, 2], ['runner', 1, 2], ['jumper', 2, 2], ['armored', 3, 2]],
       base: 6, growth: 1.25, gap: 2.1 }),

  mk({ id: 18, planet: 3, name: 'Рой', startSparks: 325, hpScale: 1.29, iceEvery: 12,
       hint: 'Рой при смерти распадается надвое — считай это заранее',
       pool: [['walker', 1, 2], ['runner', 2, 2], ['armored', 3, 2], ['swarm', 1, 3]],
       base: 6, growth: 1.25, gap: 2.1 }),

  mk({ id: 19, planet: 3, name: 'Лекари', startSparks: 325, hpScale: 1.314, iceEvery: 12,
       hint: 'Лекарь чинит соседей — выбивай его первым',
       pool: [['walker', 1, 2], ['armored', 2, 2], ['swarm', 2, 2], ['healer', 1, 2]],
       base: 6, growth: 1.3, gap: 2.0 }),

  mk({ id: 20, planet: 3, name: 'Страж станции', startSparks: 350, hpScale: 1.339, iceEvery: 11,
       hint: 'Колосс во льдах',
       pool: [['walker', 1, 2], ['armored', 1, 2], ['swarm', 2, 2], ['healer', 1, 2]],
       base: 7, growth: 1.3, gap: 2.0, boss: { wave: 10, count: 1, hpMul: 1.4 } }),

  mk({ id: 21, planet: 3, name: 'Мёртвый коридор', startSparks: 350, hpScale: 1.378, iceEvery: 11, cols: 2,
       hint: 'Лёд ложится всё чаще',
       pool: [['walker', 1, 2], ['armored', 2, 2], ['phantom', 1, 2], ['swarm', 3, 2], ['healer', 2, 2]],
       base: 7, growth: 1.3, gap: 1.9 }),

  mk({ id: 22, planet: 3, name: 'Криокамера', startSparks: 350, hpScale: 1.412, iceEvery: 10, cols: 2,
       hint: 'Держи запас искр: отогревать строй придётся часто',
       pool: [['walker', 1, 2], ['runner', 1, 2], ['burster', 2, 2], ['armored', 3, 2], ['healer', 1, 2]],
       base: 7, growth: 1.35, gap: 1.9 }),

  mk({ id: 23, planet: 3, name: 'Обрыв связи', startSparks: 375, hpScale: 1.445, iceEvery: 10, cols: 2,
       hint: 'Фантомы и лекари в одной волне',
       pool: [['walker', 1, 2], ['jumper', 3, 2], ['phantom', 1, 2], ['swarm', 2, 2], ['healer', 1, 2]],
       base: 7, growth: 1.35, gap: 1.8 }),

  mk({ id: 24, planet: 3, name: 'Белая мгла', startSparks: 375, hpScale: 1.484, iceEvery: 9, cols: 3,
       hint: 'Три фронта во льдах',
       pool: [['walker', 1, 2], ['armored', 1, 2], ['phantom', 3, 2], ['swarm', 1, 2], ['healer', 2, 2]],
       base: 8, growth: 1.35, gap: 1.8 }),

  mk({ id: 25, planet: 3, name: 'Второй страж', startSparks: 400, hpScale: 1.508, iceEvery: 9, cols: 3,
       hint: 'Колосс приходит не один',
       pool: [['walker', 1, 2], ['burster', 2, 2], ['armored', 1, 2], ['swarm', 2, 2], ['healer', 1, 2]],
       base: 8, growth: 1.4, gap: 1.7, boss: { wave: 10, count: 1, hpMul: 1.6 } }),

  mk({ id: 26, planet: 3, name: 'Глубина', startSparks: 400, hpScale: 1.556, iceEvery: 8, cols: 3,
       hint: 'Отсюда каждая ошибка стоит жизни',
       pool: [['walker', 1, 2], ['armored', 1, 2], ['phantom', 1, 2], ['swarm', 2, 2], ['healer', 1, 2]],
       base: 8, growth: 1.4, gap: 1.7 }),

  mk({ id: 27, planet: 3, name: 'Резонанс', startSparks: 425, hpScale: 1.605, iceEvery: 8, cols: 3,
       hint: 'Рой, лекари и броня одновременно',
       pool: [['walker', 1, 2], ['runner', 2, 2], ['armored', 1, 2], ['phantom', 2, 2], ['swarm', 1, 3], ['healer', 1, 2]],
       base: 8, growth: 1.45, gap: 1.6 }),

  mk({ id: 28, planet: 3, name: 'Тёмный лёд', startSparks: 425, hpScale: 1.654, iceEvery: 7, cols: 3,
       hint: 'Лёд ложится раз в семь секунд',
       pool: [['walker', 1, 2], ['jumper', 2, 2], ['armored', 1, 2], ['phantom', 1, 2], ['swarm', 2, 2], ['healer', 1, 2]],
       base: 8, growth: 1.45, gap: 1.6 }),

  mk({ id: 29, planet: 3, name: 'Последний отсек', startSparks: 450, hpScale: 1.702, iceEvery: 7, cols: 3,
       hint: 'Перед ядром — всё, что станция ещё может выставить',
       pool: [['walker', 1, 2], ['runner', 1, 2], ['burster', 2, 2], ['armored', 1, 2], ['phantom', 1, 2], ['swarm', 1, 2], ['healer', 1, 2]],
       base: 9, growth: 1.5, gap: 1.5, boss: { wave: 9, count: 1, hpMul: 1.5 } }),

  mk({ id: 30, planet: 3, name: 'Ядро', startSparks: 450, hpScale: 1.751, iceEvery: 7, cols: 3,
       hint: 'Финал. Два усиленных колосса и всё остальное следом',
       pool: [['walker', 1, 2], ['runner', 1, 2], ['burster', 1, 2], ['jumper', 1, 2], ['armored', 1, 2], ['phantom', 1, 2], ['swarm', 1, 2], ['healer', 1, 2]],
       base: 9, growth: 1.5, gap: 1.5, boss: { wave: 10, count: 2, hpMul: 1.7 } })
];

var Waves = {
  levels: LEVELS,
  planets: PLANETS,
  total: LEVELS.length,

  get: function (levelId) {
    return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelId - 1))];
  },

  planet: function (planetId) {
    for (var i = 0; i < PLANETS.length; i++) if (PLANETS[i].id === planetId) return PLANETS[i];
    return PLANETS[0];
  },

  /* Уровни конкретной планеты */
  ofPlanet: function (planetId) {
    var out = [];
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].planet === planetId) out.push(LEVELS[i]);
    return out;
  },

  /* Первый уровень планеты — им открывается вся планета */
  firstOfPlanet: function (planetId) {
    var list = Waves.ofPlanet(planetId);
    return list.length ? list[0].id : 1;
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
    return {
      id: 0, planet: 3, name: 'Бесконечные волны', startSparks: 250,
      unlock: [], hint: '', waves: [], endless: true,
      hpScale: 1.0, craters: 0, iceEvery: 12
    };
  },

  endlessWave: function (n) {
    var groups = [];
    var dens = Math.max(1.0, 2.4 - n * 0.06);
    groups.push(g('walker', 3 + Math.floor(n * 0.7), dens, 0));
    if (n >= 3) groups.push(g('runner', 1 + Math.floor(n * 0.4), dens, 2));
    if (n >= 5) groups.push(g('spitter', 1 + Math.floor(n * 0.25), dens + 0.6, 4));
    if (n >= 6) groups.push(g('burster', 1 + Math.floor(n * 0.2), dens + 0.8, 3));
    if (n >= 7) groups.push(g('armored', 1 + Math.floor(n * 0.22), dens + 1.2, 5));
    if (n >= 8) groups.push(g('phantom', 1 + Math.floor(n * 0.18), dens + 1.0, 6));
    if (n >= 9) groups.push(g('jumper', 1 + Math.floor(n * 0.22), dens + 0.8, 6));
    if (n >= 11) groups.push(g('swarm', 1 + Math.floor(n * 0.15), dens + 1.4, 7));
    if (n >= 13) groups.push(g('healer', 1 + Math.floor(n * 0.1), dens + 2.0, 9));
    if (n % 5 === 0) groups.push(g('boss', 1, 0, 2, Math.floor(Math.random() * 4), { hpMul: 1 + n * 0.08 }));
    return wave.apply(null, groups);
  }
};
