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
     Механики планет (у каждой своя):
     harvestEvery  — раз во сколько секунд на поле само падает зерно (Ферма)
     craters       — сколько клеток выжжено (Пустоши)
     iceEvery      — как часто юнит леденеет (Станция)
     vines         — сколько клеток заросло (Джунгли)
     collapseEvery — как часто обваливается свободная клетка (Рудник)
     sporeEvery    — как часто споры сбивают темп (Улей)
     darkBand      — по полю ходит полоса тьмы (Разлом)
     meteorEvery   — как часто бьёт метеор (Печь)
     glitchEvery   — как часто отключается колонка (Бездна) */

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
var MIN_WAVE = {
  armored: 3, phantom: 3, swarm: 4, healer: 5,
  carrier: 3, howler: 3, shielder: 4, devourer: 4,
  frostling: 2, borer: 3, warped: 3,
  executioner: 2, reaper: 3, defiler: 4
};

/* Разворачивает паспорт уровня в 10 волн */
function mk(o) {
  var rand = rng(o.id * 7919 + 13);
  var waves = [];

  for (var w = 1; w <= 10; w++) {
    var groups = [];
    var count = Math.round((o.base + o.growth * (w - 1)) * DENSITY * (w === 10 ? 1.2 : 1));
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
        groups.push(g(o.boss.type || 'boss', 1, 0, 2 + b * 7, Math.floor(rand() * (COLS - 1)),
          { hpMul: o.boss.hpMul || 1 }));
      }
    }

    waves.push(wave.apply(null, groups));
  }

  return {
    id: o.id, planet: o.planet, name: o.name, hint: o.hint,
    startSparks: o.startSparks, hpScale: o.hpScale || 1,
    unlock: o.unlock || [],
    craters: o.craters || 0, vines: o.vines || 0,
    iceEvery: o.iceEvery || 0, collapseEvery: o.collapseEvery || 0,
    sporeEvery: o.sporeEvery || 0, meteorEvery: o.meteorEvery || 0,
    siegeEvery: o.siegeEvery || 0, siegePool: o.siegePool || null,
    glitchEvery: o.glitchEvery || 0, harvestEvery: o.harvestEvery || 0,
    darkBand: !!o.darkBand,
    waves: waves
  };
}

/* Разворачивает планету целиком: характеристики плавно растут от первого
   уровня к последнему, чтобы не выписывать каждый паспорт вручную. */
function gen(o) {
  var out = [];
  for (var i = 0; i < o.count; i++) {
    var t = o.count > 1 ? i / (o.count - 1) : 0;
    var lerp = function (pair) { return pair[0] + (pair[1] - pair[0]) * t; };
    out.push(mk({
      id: o.from + i,
      planet: o.planet,
      name: o.names[i],
      hint: (o.hints && o.hints[i + 1]) || o.hint,
      startSparks: Math.round(lerp(o.sparks) / 25) * 25,
      hpScale: +lerp(o.hp).toFixed(3),
      unlock: (o.unlocks && o.unlocks[i + 1]) || [],
      pool: o.pool,
      base: +lerp(o.base).toFixed(2),
      growth: o.growth,
      gap: o.gap,
      cols: o.cols,
      boss: o.bosses && o.bosses[i + 1],
      craters: o.craters || 0,
      vines: o.vines || 0,
      iceEvery: o.iceEvery || 0,
      collapseEvery: o.collapseEvery || 0,
      sporeEvery: o.sporeEvery || 0,
      meteorEvery: o.meteorEvery || 0,
      glitchEvery: o.glitchEvery || 0,
      harvestEvery: o.harvestEvery || 0,
      siegeEvery: o.siegeEvery || 0,
      siegePool: o.siegePool || null,
      darkBand: o.darkBand
    }));
  }
  return out;
}

/* ----------------------------------------------------------------------
   Девять планет, по три в акте, по 5 / 10 / 15 уровней.
   У каждой свой набор защитников (roster), свой бестиарий и своя механика.
   Ядро набора — маяк и барьер, они есть везде: без экономики и стены
   ни одна планета не играется.
   ---------------------------------------------------------------------- */

/* Общего ядра больше нет: у каждой планеты собственная пятёрка —
   свой добытчик искр, своя стена, свой стрелок и два специалиста под
   её механику. Ни один защитник не встречается на двух планетах. */
var CORE_UNITS = [];

var PLANETS = [
  {
    id: 1, act: 1, name: 'Ферма', sub: 'Где всё началось', levels: 5,
    color: '#4ADE80', fill: '#16241C', feature: 'fields',
    mechanic: 'Урожай: поле само роняет зерно',
    roster: ['beacon', 'barrier', 'shooter', 'spikes', 'mine'],
    drip: [['beacon', 'shooter'], ['barrier'], ['spikes'], ['mine'], []],
    desc: 'Тихое поле. Иногда само роняет зерно — лишняя искра не помешает.'
  },
  {
    id: 2, act: 1, name: 'Пепельные пустоши', sub: 'Выжженная земля', levels: 10,
    color: '#F97316', fill: '#2A1A12', feature: 'craters',
    mechanic: 'Кратеры: часть клеток выжжена навсегда',
    roster: ['ashwell', 'obelisk', 'slinger', 'shotgun', 'torch', 'umbrella'],
    desc: 'Часть клеток выжжена. Зонт сбивает плевки, горн разгоняет снаряды.'
  },
  {
    id: 3, act: 1, name: 'Ледяная станция', sub: 'Мороз и тьма', levels: 15,
    color: '#60A5FA', fill: '#152232', feature: 'ice', ring: true,
    mechanic: 'Обледенение: защитник молчит, пока его не отогреют',
    roster: ['condenser', 'icewall', 'repeater', 'freezer', 'magnet'],
    desc: 'Защитники леденеют — коснись, чтобы отогреть. Здесь открывается третья ступень улучшений.'
  },
  {
    id: 4, act: 2, name: 'Джунгли', sub: 'Второй круг', levels: 5,
    color: '#22C55E', fill: '#132A1B', feature: 'fields',
    mechanic: 'Заросли: клетку надо расчистить тапом',
    roster: ['vinepod', 'stump', 'barb', 'chomper', 'fan', 'harpoon'],
    desc: 'Поле заросло. Капкан глотает врага целиком, гарпун тащит его назад.'
  },
  {
    id: 5, act: 2, name: 'Рудник', sub: 'Под землёй', levels: 10,
    color: '#D97706', fill: '#2A1E0E', feature: 'craters',
    mechanic: 'Обвалы: свободные клетки пропадают прямо в бою',
    roster: ['miner', 'prop', 'jack', 'mortar', 'pendulum', 'repair'],
    desc: 'Своды обваливаются. Мортира кроет площадь, маятник косит три колонки.'
  },
  {
    id: 6, act: 2, name: 'Улей', sub: 'Живая стена', levels: 15,
    color: '#84CC16', fill: '#1E2A10', feature: 'fields',
    mechanic: 'Споры: темп стрельбы падает вдвое',
    roster: ['sporepod', 'tarwall', 'sting', 'laser', 'tesla', 'net'],
    desc: 'Споры душат темп. Лазер прошивает колонку, молния бьёт цепью.'
  },
  {
    id: 7, act: 3, name: 'Разлом', sub: 'Третий круг', levels: 5,
    color: '#E879F9', fill: '#281630', feature: 'craters',
    mechanic: 'Тьма: по полю ходит полоса, в которой врага не видно',
    roster: ['glowfly', 'monolith', 'ray', 'lantern', 'cutter', 'anchor'],
    desc: 'По полю ходит полоса тьмы. В ней враг виден только по глазам.'
  },
  {
    id: 8, act: 3, name: 'Печь', sub: 'Жар и пепел', levels: 10,
    color: '#EF4444', fill: '#2A1414', feature: 'craters',
    mechanic: 'Метеоры: клетка светится, потом по ней бьёт',
    roster: ['heatsink', 'shieldwall', 'smelter', 'rodtower', 'hammer'],
    desc: 'Метеоры бьют по клеткам. Кольцо загорается заранее — успей убрать юнита.'
  },
  {
    id: 9, act: 3, name: 'Бездна', sub: 'Конец пути', levels: 15,
    color: '#818CF8', fill: '#1A1B33', feature: 'ice', ring: true,
    mechanic: 'Аномалия: колонка защитников замолкает',
    roster: ['resonator', 'voidwall', 'disruptor', 'stabilizer', 'singular'],
    desc: 'Аномалия глушит целые колонки. Последние пятнадцать ночей.'
  },
  {
    id: 10, act: 4, name: 'Цитадель', sub: 'Осада', levels: 5, finale: true,
    color: '#F43F5E', fill: '#2A0E16', feature: 'craters', ring: true,
    mechanic: 'Осада: подкрепление приходит само, поверх волн',
    roster: ['altar', 'bastion', 'lancer', 'inquisitor', 'ward'],
    desc: 'Пять ночей без передышки. Сюда приходит вся элита, а между волнами осада шлёт подкрепление сама. Здесь ждёт Владыка.'
  },
];

var LEVELS = [].concat(
  /* ===================== АКТ I ===================== */
  gen({
    planet: 1, from: 1, count: 5, harvestEvery: 12,
    names: ['Первая ночь', 'Тихий двор', 'Ночные гости', 'Через ряд', 'Гость с холма'],
    hint: 'Ставь маяки — без искр не будет стрелков',
    hints: { 3: 'Шипы лежат на земле и режут всех, кто наступит',
             4: 'Прыгун один раз перескочит через ряд защитников',
             5: 'На финальной волне придёт колосс' },
    unlocks: { 1: ['beacon', 'shooter'], 2: ['barrier'], 3: ['mine'], 4: ['spikes'], 5: ['repair'] },
    pool: [['walker', 1, 3], ['nibbler', 2, 2], ['jumper', 3, 2]],
    base: [4, 6], growth: 1.0, gap: 2.8,
    sparks: [100, 175], hp: [1.0, 1.1],
    bosses: { 5: { wave: 10, count: 1, hpMul: 1 } }
  }),
  gen({
    planet: 2, from: 6, count: 10, craters: 4,
    names: ['Пепел', 'Кратеры', 'Сухой ветер', 'Плевки', 'Горн',
            'Призраки', 'Стеклянное поле', 'Пыль', 'Разлом породы', 'Вожак пепла'],
    hint: 'Выжженные клетки заняты навсегда',
    hints: { 2: 'Пепельник взрывается при смерти и обжигает защитника под собой',
             4: 'Зонт сбивает плевки над собой и соседями',
             6: 'Фантом уходит в фазу — в этот момент снаряды проходят насквозь' },
    pool: [['walker', 1, 3], ['burster', 1, 2], ['spitter', 2, 2]],
    base: [5, 7], growth: 1.15, gap: 2.4,
    sparks: [175, 250], hp: [1.1, 1.35],
    bosses: { 10: { wave: 10, count: 1, hpMul: 1.2 } }
  }),
  gen({
    planet: 3, from: 16, count: 15, iceEvery: 12,
    names: ['Шлюз', 'Иней', 'Первый ярус', 'Броня', 'Рой', 'Лекари', 'Мёртвый коридор',
            'Криокамера', 'Обрыв связи', 'Белая мгла', 'Глубина', 'Резонанс',
            'Тёмный лёд', 'Последний отсек', 'Страж станции'],
    hint: 'Лёд сковывает защитника — коснись, чтобы отогреть',
    hints: { 4: 'Магнит срывает броню целиком',
             5: 'Рой при смерти распадается надвое',
             6: 'Лекарь чинит соседей — выбивай его первым',
             8: 'Сеть пригвождает врага к месту' },
    pool: [['walker', 1, 2], ['frostling', 2, 2], ['runner', 3, 2], ['armored', 3, 2]],
    base: [5, 8], growth: 1.2, gap: 2.2,
    sparks: [250, 350], hp: [1.35, 1.7],
    bosses: { 15: { wave: 10, count: 1, hpMul: 1.3 } }
  }),

  /* ===================== АКТ II ===================== */
  gen({
    planet: 4, from: 31, count: 5, vines: 4,
    names: ['Кромка', 'Лианы', 'Топь', 'Полог', 'Сердце чащи'],
    hint: 'Заросли снимаются тапом — расчищай заранее, не под волной',
    hints: { 1: 'Капкан глотает врага целиком, потом долго жуёт',
             3: 'Носитель высаживает бегунов прямо на ходу',
             4: 'Ревун разгоняет всех вокруг себя' },
    pool: [['walker', 1, 2], ['runner', 1, 2], ['carrier', 3, 2], ['howler', 3, 2]],
    base: [4.5, 6.5], growth: 1.15, gap: 2.2,
    sparks: [375, 425], hp: [1.34, 1.46],
    bosses: { 5: { wave: 10, count: 1, hpMul: 1.3 } }
  }),
  gen({
    planet: 5, from: 36, count: 10, collapseEvery: 16,
    names: ['Ствол шахты', 'Первый горизонт', 'Обвал', 'Штрек', 'Рудная жила',
            'Глубокий забой', 'Провал', 'Затопленный ярус', 'Клеть', 'Хозяин рудника'],
    hint: 'Своды обваливаются: свободных клеток с каждой волной меньше',
    hints: { 1: 'Мортира бьёт по площади, маятник косит три колонки вплотную',
             4: 'Щитоносец вдвое режет урон по соседям' },
    pool: [['walker', 1, 2], ['borer', 3, 2], ['spitter', 4, 2], ['shielder', 4, 2]],
    base: [4.5, 7], growth: 1.2, gap: 2.1,
    sparks: [400, 475], hp: [1.55, 1.75],
    bosses: { 10: { wave: 10, count: 1, hpMul: 1.35 } }
  }),
  gen({
    planet: 6, from: 46, count: 15, sporeEvery: 11,
    names: ['Порог улья', 'Споры', 'Соты', 'Кладка', 'Рабочий ярус', 'Дым', 'Личинки',
            'Трутни', 'Галерея', 'Кормовая', 'Тесная камера', 'Гул', 'Смена роя',
            'Королевская камера', 'Рой королевы'],
    hint: 'Споры сбивают темп вдвое и выветриваются сами',
    hints: { 1: 'Лазер прошивает колонку насквозь, молния бьёт цепью по троим',
             5: 'Рой распадается надвое — считай это заранее' },
    pool: [['walker', 1, 2], ['nibbler', 2, 2], ['swarm', 4, 2], ['healer', 5, 2]],
    base: [4.5, 7], growth: 1.2, gap: 2.0,
    sparks: [475, 575], hp: [1.75, 2.0],
    bosses: { 8: { wave: 10, count: 1, hpMul: 1.2 },
              15: { wave: 10, type: 'titan', count: 1, hpMul: 1.2 } }
  }),

  /* ===================== АКТ III ===================== */
  gen({
    planet: 7, from: 61, count: 5, darkBand: true,
    names: ['Трещина', 'Первый мост', 'Осколки', 'Перевал', 'Страж разлома'],
    hint: 'В полосе тьмы враг виден только по глазам',
    hints: { 2: 'Пожиратель съедает защитника целиком — не берёт только барьер' },
    pool: [['walker', 1, 2], ['phantom', 2, 2], ['armored', 3, 2], ['devourer', 4, 2]],
    base: [4.5, 6.5], growth: 1.15, gap: 2.0,
    sparks: [575, 650], hp: [1.9, 2.05],
    bosses: { 5: { wave: 10, type: 'titan', count: 1, hpMul: 1.3 } }
  }),
  gen({
    planet: 8, from: 66, count: 10, meteorEvery: 13,
    names: ['Заслонка', 'Жар', 'Литейный', 'Шлак', 'Горн печи',
            'Выплавка', 'Раскал', 'Слиток', 'Топка', 'Мастер печи'],
    hint: 'Кольцо загорается заранее — успей убрать юнита с клетки',
    pool: [['walker', 1, 2], ['runner', 1, 2], ['burster', 2, 2], ['howler', 3, 2], ['carrier', 5, 2]],
    base: [4.5, 7], growth: 1.2, gap: 1.9,
    sparks: [650, 750], hp: [2.05, 2.25],
    bosses: { 10: { wave: 10, type: 'titan', count: 2, hpMul: 1.3 } }
  }),
  gen({
    planet: 9, from: 76, count: 15, glitchEvery: 12,
    names: ['Порог', 'Спуск', 'Пустота', 'Тишина', 'Шёпот', 'Провал', 'Изнанка', 'Грань',
            'Тьма', 'Дно', 'Отражение', 'Эхо бездны', 'Последний свет', 'Сердце бездны', 'Конец'],
    hint: 'Аномалия глушит целую колонку — держи запасной эшелон',
    hints: { 15: 'Последняя ночь. Два титана и всё остальное следом' },
    pool: [['walker', 1, 2], ['warped', 3, 2], ['phantom', 3, 2], ['swarm', 4, 2], ['devourer', 5, 2], ['healer', 6, 2]],
    base: [6, 8.5], growth: 1.35, gap: 1.7,
    sparks: [750, 900], hp: [2.45, 3.0],
    bosses: { 8: { wave: 10, type: 'titan', count: 1, hpMul: 1.3 },
              15: { wave: 10, type: 'titan', count: 2, hpMul: 1.4 } }
  })
);

/* ================= АКТ IV: Цитадель, уровни 91-95 ================= */
LEVELS = LEVELS.concat(
  gen({
    planet: 10, from: 91, count: 5,
    siegeEvery: 14, siegePool: ['walker', 'nibbler', 'armored'],
    names: ['Ворота', 'Первая стена', 'Внутренний двор', 'Донжон', 'Владыка'],
    hint: 'Осада не ждёт конца волны — подкрепление приходит само',
    hints: { 1: 'Палач сносит обычного защитника с трёх ударов — нужен Бастион',
             2: 'Жнец лечится за каждого убитого защитника',
             4: 'Осквернитель глушит колонку. Оберег этого не позволит',
             5: 'Владыка. Броня, свита и четыре тысячи здоровья' },
    pool: [['walker', 1, 2], ['executioner', 2, 2], ['reaper', 3, 2],
           ['armored', 3, 2], ['defiler', 4, 2], ['warped', 4, 2]],
    base: [5, 7], growth: 1.25, gap: 1.9,
    sparks: [1000, 1200], hp: [2.1, 2.5],
    bosses: { 3: { wave: 10, type: 'titan', count: 1, hpMul: 1.4 },
              5: { wave: 10, type: 'overlord', count: 1, hpMul: 1 } }
  })
);

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

  ofPlanet: function (planetId) {
    var out = [];
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].planet === planetId) out.push(LEVELS[i]);
    return out;
  },

  ofAct: function (act) {
    var out = [];
    for (var i = 0; i < PLANETS.length; i++) if (PLANETS[i].act === act) out.push(PLANETS[i]);
    return out;
  },

  firstOfPlanet: function (planetId) {
    var list = Waves.ofPlanet(planetId);
    return list.length ? list[0].id : 1;
  },

  /* Бестиарий планеты: кто действительно выходит на её уровнях.
     Собираем по готовым волнам, а не по отдельному списку: так справочник
     не разойдётся с игрой после правки паспортов. Порядок — по первому
     появлению: сначала те, с кем игрок встретится раньше. */
  bestiaryFor: function (planetId) {
    var levels = Waves.ofPlanet(planetId);
    var seen = {}, out = [];
    for (var i = 0; i < levels.length; i++) {
      var lvl = levels[i];
      for (var w = 0; w < lvl.waves.length; w++) {
        var list = lvl.waves[w].enemies;
        for (var e = 0; e < list.length; e++) {
          if (!seen[list[e].type]) { seen[list[e].type] = 1; out.push(list[e].type); }
        }
      }
      // Осада шлёт подкрепление мимо волн — в волнах его не видно
      var pool = lvl.siegePool || [];
      for (var s = 0; s < pool.length; s++) {
        if (!seen[pool[s]]) { seen[pool[s]] = 1; out.push(pool[s]); }
      }
    }
    return out;
  },

  /* Какой по счёту уровень внутри своей планеты (с единицы) */
  indexInPlanet: function (levelId) {
    var list = Waves.ofPlanet(Waves.get(levelId).planet);
    for (var i = 0; i < list.length; i++) if (list[i].id === levelId) return i + 1;
    return 1;
  },

  /* Набор защитников уровня. Своя планета — свой набор, а не накопление
     за всю кампанию: иначе к середине игры карточек было бы два десятка
     и планеты перестали бы отличаться друг от друга. */
  rosterFor: function (levelId) {
    var lvl = Waves.get(levelId);
    var planet = Waves.planet(lvl.planet);
    if (planet.drip) {
      // Первая планета выдаёт набор по одному за уровень
      var out = [];
      var upto = Waves.indexInPlanet(levelId);
      for (var i = 0; i < upto && i < planet.drip.length; i++) {
        out = out.concat(planet.drip[i]);
      }
      return out;
    }
    return CORE_UNITS.concat(planet.roster);
  },

  /* Совместимость: раньше набор копился по всей кампании */
  unlockedAt: function (levelId) { return Waves.rosterFor(levelId); },

  endlessLevel: function () {
    return {
      id: 0, planet: 9, name: 'Бесконечные волны', startSparks: 400,
      unlock: [], hint: '', waves: [], endless: true,
      hpScale: 1, craters: 0, vines: 0, iceEvery: 14,
      collapseEvery: 0, sporeEvery: 0, meteorEvery: 0, glitchEvery: 0,
      harvestEvery: 0, darkBand: false
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
