/* units.js — защитники: параметры, апгрейды, отрисовка.
   Все формы рисуются примитивами. Акцент живёт в обводке и мелких деталях,
   заливка всегда заметно темнее обводки. */

/* ---------- Общие примитивы канваса ---------- */
var Draw = {
  roundRect: function (ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  },
  circle: function (ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    ctx.closePath();
  },
  /* Замкнутый контур по списку точек [[x,y], ...] */
  poly: function (ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  },
  /* Правильный многоугольник с плоской вершиной сверху */
  ngon: function (ctx, cx, cy, r, n, rot) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (rot || 0);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    Draw.poly(ctx, pts);
  },
  /* Свечение без blur: просто фигура большего размера с малой альфой */
  glowRect: function (ctx, x, y, w, h, r, color, alpha, spread) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = spread;
    Draw.roundRect(ctx, x - spread / 2, y - spread / 2, w + spread, h + spread, r + spread / 2);
    ctx.stroke();
    ctx.restore();
  },
  /* Гладкий замкнутый контур через опорные точки: кривая идёт по серединам
     отрезков, а сами точки работают направляющими. Именно это даёт мягкие
     «живые» формы вместо скруглённых прямоугольников. */
  smooth: function (ctx, pts) {
    var n = pts.length;
    var mx = (pts[n - 1][0] + pts[0][0]) / 2;
    var my = (pts[n - 1][1] + pts[0][1]) / 2;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    for (var i = 0; i < n; i++) {
      var cur = pts[i], nxt = pts[(i + 1) % n];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
    }
    ctx.closePath();
  },

  /* Стебель: изогнутая ножка, на которой сидит голова */
  stalk: function (ctx, x1, y1, cx, cy, x2, y2, w, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.55 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
    ctx.restore();
  },

  /* Полоска-индикатор со скруглёнными торцами */
  bar: function (ctx, x, y, w, h, pct, bgColor, fgColor) {
    var r = h / 2;
    ctx.fillStyle = bgColor;
    Draw.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    pct = Math.max(0, Math.min(1, pct));
    if (pct <= 0) return;
    var fw = Math.max(h, w * pct);   // не уже собственной высоты, иначе торцы схлопываются
    ctx.fillStyle = fgColor;
    Draw.roundRect(ctx, x, y, fw, h, r);
    ctx.fill();
  },

  glowCircle: function (ctx, cx, cy, r, color, alpha, spread) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = spread;
    Draw.circle(ctx, cx, cy, r + spread / 2);
    ctx.stroke();
    ctx.restore();
  }
};

/* ---------- Конфигурация защитников ----------
   Меняя только эти числа, можно перебалансировать всю игру.
   fireRate — выстрелов в секунду, range — дальность в клетках,
   cooldown — перезарядка карточки в нижней панели (сек). */
var UNIT_TYPES = {
  beacon: {
    id: 'beacon', name: 'Маяк', cost: 50, hp: 100, cooldown: 5,
    color: PAL.spark, fill: PAL.fillSpark,
    produce: 25, interval: 6,
    upgradeKey: 'produce',
    role: 'Производит искры'
  },
  shooter: {
    id: 'shooter', name: 'Стрелок', cost: 100, hp: 120, cooldown: 5,
    color: PAL.uShooter, fill: PAL.uShooterF,
    damage: 20, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage',
    role: '20 урона, выстрел в секунду'
  },
  barrier: {
    id: 'barrier', name: 'Барьер', cost: 50, hp: 600, cooldown: 12,
    color: PAL.uBarrier, fill: PAL.uBarrierF,
    upgradeKey: 'hp',
    role: 'Не атакует, держит удар'
  },
  freezer: {
    id: 'freezer', name: 'Морозилка', cost: 175, hp: 100, cooldown: 8,
    color: PAL.ice, fill: PAL.fillIce,
    damage: 10, fireRate: 1.0, range: 7, slow: 0.4, slowTime: 3, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Замедляет врага на 40%'
  },
  shotgun: {
    id: 'shotgun', name: 'Дробовик', cost: 200, hp: 150, cooldown: 8,
    color: PAL.uShotgun, fill: PAL.uShotgunF,
    damage: 60, fireRate: 1 / 1.5, range: 2, spread: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: '60 урона на две клетки'
  },
  repeater: {
    id: 'repeater', name: 'Дуплет', cost: 175, hp: 120, cooldown: 7,
    color: PAL.uRepeater, fill: PAL.uRepeaterF,
    damage: 20, fireRate: 1.0, range: 7, burst: 2, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Два снаряда за выстрел'
  },
  fan: {
    id: 'fan', name: 'Веер', cost: 250, hp: 110, cooldown: 10,
    color: PAL.uFan, fill: PAL.uFanF,
    damage: 15, fireRate: 0.9, range: 7, spreadCols: true, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Бьёт в три колонки сразу'
  },
  torch: {
    id: 'torch', name: 'Горн', cost: 150, hp: 100, cooldown: 8,
    color: PAL.uTorch, fill: PAL.uTorchF,
    boost: 1.5,
    upgradeKey: 'boost',
    role: 'Усиливает пролетающие снаряды'
  },
  magnet: {
    id: 'magnet', name: 'Магнит', cost: 150, hp: 100, cooldown: 10,
    color: PAL.uMagnet, fill: PAL.uMagnetF,
    fireRate: 1 / 5, range: 4, strip: true,
    upgradeKey: 'range',
    role: 'Срывает броню с броненосцев'
  },
  mortar: {
    id: 'mortar', name: 'Мортира', cost: 225, hp: 120, cooldown: 12,
    color: PAL.uMortar, fill: PAL.uMortarF,
    damage: 45, fireRate: 0.5, range: 6, splash: 1.0, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: 'Бьёт по площади навесом'
  },
  laser: {
    id: 'laser', name: 'Лазер', cost: 275, hp: 100, cooldown: 14,
    color: PAL.uLaser, fill: PAL.uLaserF,
    damage: 14, fireRate: 1.6, range: 7, pierce: true, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Прошивает всю колонку насквозь'
  },
  repair: {
    id: 'repair', name: 'Ремонтник', cost: 125, hp: 130, cooldown: 10,
    color: PAL.uRepair, fill: PAL.uRepairF,
    fireRate: 1, repair: 14,
    upgradeKey: 'repair',
    role: 'Чинит соседних защитников'
  },
  spikes: {
    id: 'spikes', name: 'Шипы', cost: 100, hp: 200, cooldown: 8,
    color: PAL.uSpikes, fill: PAL.uSpikesF,
    ground: true, tickDamage: 16,            // лежит на земле и режет всех, кто наступил
    upgradeKey: 'tickDamage',
    role: 'Режет всех, кто наступит'
  },
  chomper: {
    id: 'chomper', name: 'Капкан', cost: 175, hp: 130, cooldown: 10,
    color: PAL.uChomper, fill: PAL.uChomperF,
    swallow: true, chewTime: 11, range: 1.2,
    upgradeKey: 'chewTime',
    role: 'Глотает врага целиком, потом жуёт'
  },
  tesla: {
    id: 'tesla', name: 'Молния', cost: 250, hp: 100, cooldown: 12,
    color: PAL.uTesla, fill: PAL.uTeslaF,
    damage: 18, fireRate: 0.7, range: 3, chain: 3, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Бьёт цепью по трём врагам'
  },
  harpoon: {
    id: 'harpoon', name: 'Гарпун', cost: 175, hp: 110, cooldown: 9,
    color: PAL.uHarpoon, fill: PAL.uHarpoonF,
    damage: 22, fireRate: 0.5, range: 5, pull: 1.4, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Оттаскивает врага назад'
  },
  umbrella: {
    id: 'umbrella', name: 'Зонт', cost: 100, hp: 150, cooldown: 8,
    color: PAL.uUmbrella, fill: PAL.uUmbrellaF,
    shieldRange: 1,                          // сбивает плевки над собой и соседями
    upgradeKey: 'shieldRange',
    role: 'Сбивает плевки над собой и соседями'
  },
  pendulum: {
    id: 'pendulum', name: 'Маятник', cost: 200, hp: 170, cooldown: 11,
    color: PAL.uPendulum, fill: PAL.uPendulumF,
    damage: 34, fireRate: 1.0, range: 1.2, sweep: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: 'Косит вплотную три колонки'
  },
  net: {
    id: 'net', name: 'Сеть', cost: 150, hp: 110, cooldown: 10,
    color: PAL.uNet, fill: PAL.uNetF,
    fireRate: 1 / 6, range: 6, root: 2.5,
    upgradeKey: 'root',
    role: 'Пригвождает врага к месту'
  },
  mine: {
    id: 'mine', name: 'Мина', cost: 25, hp: 1, cooldown: 12,
    color: PAL.uMine, fill: PAL.uMineF,
    damage: 300, radius: 1.5, oneShot: true, ground: true,
    upgradeKey: 'damage',
    role: 'Взрывается при контакте'
  }
};

/* Порядок карточек в нижней панели */
var UNIT_ORDER = ['beacon', 'barrier', 'shooter', 'mine', 'freezer',
                  'shotgun', 'repeater', 'torch', 'magnet', 'fan',
                  'repair', 'mortar', 'laser', 'spikes', 'chomper',
                  'tesla', 'harpoon', 'umbrella', 'pendulum', 'net'];

/* Множитель основного параметра по ступеням: 1 — обычный, 2 — улучшенный,
   3 — доступен только на Ледяной станции. */
var TIER_MUL = [1, 1, 1.5, 2.1];
var TIER_COST = [0, 2, 3.5];      // во столько раз от базовой цены стоит переход

var Units = {
  /* Создание юнита на клетке */
  create: function (typeId, col, row) {
    var t = UNIT_TYPES[typeId];
    return {
      type: typeId,
      def: t,
      col: col, row: row,
      hp: t.hp, maxHp: t.hp,
      level: 1,          // 1 — обычный, 2 — улучшенный
      cd: 1 / (t.fireRate || 1) * 0.5,   // первая атака чуть быстрее
      prodT: t.interval || 0,
      flash: 0,          // вспышка выстрела
      hurt: 0,           // мигание при уроне
      spawnT: 0,         // анимация постановки
      frozen: 0,         // остаток обледенения: пока тикает, юнит молчит
      spored: 0,         // споры: пока тикают, темп вдвое ниже
      stunned: 0,        // аномалия: колонка отключена
      busy: 0,           // капкан жуёт добычу
      dead: false
    };
  },

  /* Параметр с учётом ступени улучшения */
  stat: function (unit, key) {
    var base = unit.def[key];
    if (base === undefined) return undefined;
    if (unit.def.upgradeKey === key) return base * TIER_MUL[unit.level];
    return base;
  },

  canUpgrade: function (unit, maxTier) { return unit.level < (maxTier || 2); },

  upgradeCost: function (unit) {
    return Math.round(unit.def.cost * TIER_COST[unit.level]);
  },

  /* Возврат считаем от всего вложенного, включая улучшения */
  sellPrice: function (unit) {
    var paid = unit.def.cost;
    for (var t = 1; t < unit.level; t++) paid += Math.round(unit.def.cost * TIER_COST[t]);
    return Math.floor(paid * CONFIG.sellRefund);
  },

  upgrade: function (unit) {
    unit.level = Math.min(3, unit.level + 1);
    if (unit.def.upgradeKey === 'hp') {
      unit.maxHp = unit.def.hp * TIER_MUL[unit.level];
      unit.hp = unit.maxHp;
    }
    unit.spawnT = 0;
  },

  /* Характеристики юнита на заданной ступени — для справочника.
     Возвращает [[подпись, значение, растёт ли с улучшением], ...] */
  describe: function (def, level) {
    var fake = { def: def, level: level };
    var grows = function (key) { return def.upgradeKey === key; };
    var lines = [];

    if (def.damage) lines.push(['Урон', Math.round(Units.stat(fake, 'damage')), grows('damage')]);
    if (def.fireRate) {
      lines.push(['Темп', def.fireRate >= 1
        ? def.fireRate.toFixed(1) + ' выстрела/с'
        : 'раз в ' + (1 / def.fireRate).toFixed(1) + ' с', false]);
    }
    if (def.burst) lines.push(['Снарядов за раз', def.burst, false]);
    if (def.spreadCols) lines.push(['Колонок', '3', false]);
    if (def.range && !def.strip) lines.push(['Дальность', def.range + ' кл.', grows('range')]);
    if (def.strip) lines.push(['Радиус', Math.round(Units.stat(fake, 'range')) + ' кл.', grows('range')]);
    if (def.slow) lines.push(['Замедление', Math.round(def.slow * 100) + '% на ' + def.slowTime + ' с', false]);
    if (def.boost) lines.push(['Усиление снарядов', '×' + Units.stat(fake, 'boost').toFixed(2), grows('boost')]);
    if (def.produce) {
      lines.push(['Доход', Math.round(Units.stat(fake, 'produce')) + ' искр раз в ' + def.interval + ' с', grows('produce')]);
    }
    if (def.tickDamage) lines.push(['Урон под ногами', Math.round(Units.stat(fake, 'tickDamage')) + '/с', grows('tickDamage')]);
    if (def.swallow) lines.push(['Глотает', 'одного врага целиком', false]);
    if (def.chewTime) lines.push(['Жуёт', Math.round(Units.stat(fake, 'chewTime')) + ' с', grows('chewTime')]);
    if (def.chain) lines.push(['Цепь', 'до ' + def.chain + ' врагов', false]);
    if (def.pull) lines.push(['Оттаскивает', def.pull + ' кл. назад', false]);
    if (def.shieldRange) lines.push(['Прикрывает', '±' + Math.round(Units.stat(fake, 'shieldRange')) + ' колонки', grows('shieldRange')]);
    if (def.sweep) lines.push(['Задевает', 'три колонки вплотную', false]);
    if (def.root) lines.push(['Пригвождает', Math.round(Units.stat(fake, 'root') * 10) / 10 + ' с', grows('root')]);
    if (def.splash) lines.push(['Разлёт', def.splash + ' кл. вокруг цели', false]);
    if (def.pierce) lines.push(['Прошивает', 'всех в колонке', false]);
    if (def.repair) lines.push(['Ремонт', Math.round(Units.stat(fake, 'repair')) + ' HP/с соседям', grows('repair')]);
    if (def.radius) lines.push(['Взрыв', def.radius + ' кл. вокруг', false]);
    lines.push(['Прочность', Math.round(def.hp * (grows('hp') ? TIER_MUL[level] : 1)), grows('hp')]);
    lines.push(['Перезарядка карточки', def.cooldown + ' с', false]);
    return lines;
  },

  tierCost: function (def, toLevel) {
    return Math.round(def.cost * TIER_COST[toLevel - 1]);
  },

  /* ======================================================================
     ОТРИСОВКА
     Каждый защитник рисуется вокруг точки (0,0) в координатах, кратных
     размеру клетки: так форма одинаково читается на любом экране.
     ====================================================================== */
  draw: function (ctx, x, y, cell, typeId, opts) {
    opts = opts || {};
    var t = UNIT_TYPES[typeId];
    var k = cell / 64;
    var s = opts.scale === undefined ? 1 : opts.scale;
    var time = opts.time || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Ступень 3 сидит на постаменте — он рисуется под корпусом
    if (opts.level > 2) Units.tierBase(ctx, cell, k, t, time);

    var shape = Units.shapes[typeId];
    shape(ctx, cell, k, t, opts, time);

    // Капкан с добычей во рту показывает, сколько ещё жевать
    if (opts.busy > 0 && opts.busyMax) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      Draw.bar(ctx, -cell * 0.22, cell * 0.30, cell * 0.44, Math.max(3, 3 * k),
        1 - opts.busy / opts.busyMax, PAL.gridLine, t.color);
      ctx.restore();
    }

    if (opts.level > 1) Units.tierMark(ctx, cell, k, t, opts.level, time);

    ctx.restore();

    // Вспышка выстрела — короткий блик над юнитом
    if (opts.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, opts.flash) * 0.9;
      ctx.fillStyle = t.color;
      Draw.circle(ctx, x, y - cell * 0.30 * s, 3.4 * k * s);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, opts.flash) * 0.3;
      Draw.circle(ctx, x, y - cell * 0.30 * s, 6.5 * k * s);
      ctx.fill();
      ctx.restore();
    }

    // Аномалия: колонка отключена, юнит мигает фиолетовым
    if (opts.stunned) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 14);
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.setLineDash([4 * k, 3 * k]);
      Draw.roundRect(ctx, x - cell * 0.34, y - cell * 0.34, cell * 0.68, cell * 0.68, cell * 0.12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Споры: зелёная дымка над юнитом, темп стрельбы вдвое ниже
    if (opts.spored) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#65A30D';
      Draw.circle(ctx, x, y, cell * 0.34);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#84CC16';
      ctx.lineWidth = Math.max(1, k);
      ctx.setLineDash([3 * k, 3 * k]);
      Draw.circle(ctx, x, y, cell * 0.34);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Ледяная корка: юнит скован и не действует, пока по нему не тапнут
    if (opts.frozen) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = PAL.fillIce;
      Draw.roundRect(ctx, x - cell * 0.33, y - cell * 0.33, cell * 0.66, cell * 0.66, cell * 0.12);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = PAL.ice;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.stroke();
      // Осколки
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x - cell * 0.22, y - cell * 0.06); ctx.lineTo(x - cell * 0.06, y - cell * 0.22);
      ctx.moveTo(x + cell * 0.04, y + cell * 0.20); ctx.lineTo(x + cell * 0.22, y + cell * 0.02);
      ctx.moveTo(x - cell * 0.14, y + cell * 0.18); ctx.lineTo(x - cell * 0.02, y + cell * 0.06);
      ctx.stroke();
      ctx.restore();
    }

    // Полоска здоровья появляется только после урона
    if (opts.hp !== undefined && opts.maxHp && opts.hp < opts.maxHp) {
      var barW = cell * 0.5, barH = Math.max(3, 3.5 * k);
      var by = y + cell * 0.33;
      Draw.bar(ctx, x - barW / 2, by, barW, barH, opts.hp / opts.maxHp, PAL.gridLine, t.color);
    }
  },

  /* Постамент третьей ступени: кольцо под юнитом с четырьмя опорами */
  tierBase: function (ctx, u, k, t, time) {
    var spin = time * 0.6;
    ctx.save();
    ctx.strokeStyle = t.color;
    ctx.lineWidth = Math.max(1, 1.2 * k);

    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, u * 0.30, u * 0.36, u * 0.11, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Опоры медленно вращаются — юнит выглядит работающим, а не наклейкой
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = t.color;
    for (var i = 0; i < 4; i++) {
      var a = spin + i * Math.PI / 2;
      Draw.circle(ctx, Math.cos(a) * u * 0.36, u * 0.30 + Math.sin(a) * u * 0.11, 1.5 * k);
      ctx.fill();
    }
    ctx.restore();
  },

  /* Знак ступени: у второй — шеврон и боковые скобы,
     у третьей — двойной шеврон, рамка по углам и плотное свечение */
  tierMark: function (ctx, u, k, t, level, time) {
    ctx.save();
    ctx.strokeStyle = t.color;
    ctx.lineJoin = 'round';

    // Свечение по контуру корпуса
    ctx.globalAlpha = level > 2 ? 0.3 : 0.18;
    ctx.lineWidth = (level > 2 ? 5 : 3.5) * k;
    Draw.roundRect(ctx, -u * 0.33, -u * 0.33, u * 0.66, u * 0.66, u * 0.16);
    ctx.stroke();

    // Шевроны
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.5 * k;
    var chevrons = level > 2 ? 2 : 1;
    for (var i = 0; i < chevrons; i++) {
      var y = -u * 0.335 - i * u * 0.055;
      ctx.beginPath();
      ctx.moveTo(-u * 0.075, y);
      ctx.lineTo(0, y - u * 0.05);
      ctx.lineTo(u * 0.075, y);
      ctx.stroke();
    }

    // Угловые скобы: у второй ступени две, у третьей четыре
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4 * k;
    var c = u * 0.30, arm = u * 0.09;
    var corners = level > 2
      ? [[-1, -1], [1, -1], [-1, 1], [1, 1]]
      : [[-1, 1], [1, 1]];
    for (var j = 0; j < corners.length; j++) {
      var sx = corners[j][0], sy = corners[j][1];
      ctx.beginPath();
      ctx.moveTo(sx * c, sy * c - sy * arm);
      ctx.lineTo(sx * c, sy * c);
      ctx.lineTo(sx * c - sx * arm, sy * c);
      ctx.stroke();
    }

    // Третья ступень дышит
    if (level > 2) {
      ctx.globalAlpha = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(time * 2.4));
      ctx.lineWidth = 2 * k;
      Draw.circle(ctx, 0, 0, u * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* Общая подложка: корпус с обводкой цвета роли */
  body: function (ctx, t, opts, w, h, r, oy) {
    ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
    Draw.roundRect(ctx, -w / 2, -h / 2 + (oy || 0), w, h, r);
    ctx.fill();
    ctx.strokeStyle = t.color;
    ctx.stroke();
  },

  shapes: {
    /* Маяк: тяжёлая голова-фонарь на клонящемся стебле. Силуэт — подсолнух */
    beacon: function (ctx, u, k, t, opts, time) {
      var sway = Math.sin(time * 1.1) * u * 0.02;
      ctx.lineWidth = Math.max(1, k);
      Draw.stalk(ctx, -u * 0.04, u * 0.32, u * 0.10, u * 0.06,
        sway, -u * 0.06, 3 * k, t.color, 0.5);

      // Лепестки-лучи
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2 * k);
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4 + time * 0.25;
        ctx.beginPath();
        ctx.moveTo(sway + Math.cos(a) * u * 0.17, -u * 0.17 + Math.sin(a) * u * 0.17);
        ctx.lineTo(sway + Math.cos(a) * u * 0.27, -u * 0.17 + Math.sin(a) * u * 0.27);
        ctx.stroke();
      }
      ctx.restore();

      // Голова
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [sway, -u * 0.36], [sway + u * 0.19, -u * 0.25], [sway + u * 0.17, -u * 0.04],
        [sway, u * 0.04], [sway - u * 0.17, -u * 0.04], [sway - u * 0.19, -u * 0.25]
      ]);
      ctx.fill(); ctx.stroke();

      // Сердцевина
      var glow = 0.5 + 0.5 * Math.sin(time * 2.4);
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.3 * glow;
      Draw.circle(ctx, sway, -u * 0.16, u * 0.10 + u * 0.015 * glow); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, sway, -u * 0.16, u * 0.05); ctx.fill();
    },

    /* Стрелок: гнутый стебель и вытянутое рыло вверх */
    shooter: function (ctx, u, k, t, opts, time) {
      var nod = Math.sin(time * 1.4) * u * 0.012;
      ctx.lineWidth = Math.max(1, k);
      Draw.stalk(ctx, -u * 0.10, u * 0.32, -u * 0.16, u * 0.06,
        -u * 0.02, -u * 0.04, 3 * k, t.color, 0.5);

      // Листок у основания
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = t.color;
      Draw.smooth(ctx, [[-u * 0.10, u * 0.20], [-u * 0.28, u * 0.14], [-u * 0.12, u * 0.27]]);
      ctx.fill();
      ctx.restore();

      // Голова с рылом
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [u * 0.02, -u * 0.38 + nod], [u * 0.17, -u * 0.30 + nod], [u * 0.19, -u * 0.10],
        [u * 0.02, u * 0.02], [-u * 0.17, -u * 0.08], [-u * 0.16, -u * 0.28 + nod]
      ]);
      ctx.fill(); ctx.stroke();

      // Ствол-рыло
      Draw.smooth(ctx, [
        [u * 0.01, -u * 0.44 + nod], [u * 0.12, -u * 0.38 + nod],
        [u * 0.10, -u * 0.26], [-u * 0.08, -u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.7;
      Draw.circle(ctx, u * 0.02, -u * 0.42 + nod, u * 0.035); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Барьер: кривобокий валун, шире книзу */
    barrier: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [-u * 0.12, -u * 0.30], [u * 0.16, -u * 0.26], [u * 0.36, -u * 0.02],
        [u * 0.30, u * 0.28], [-u * 0.06, u * 0.32], [-u * 0.34, u * 0.20],
        [-u * 0.36, -u * 0.08]
      ]);
      ctx.fill(); ctx.stroke();

      // Скол и трещины — валун битый, но держится
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, -u * 0.14); ctx.lineTo(-u * 0.06, u * 0.02); ctx.lineTo(-u * 0.14, u * 0.22);
      ctx.moveTo(u * 0.12, -u * 0.18); ctx.lineTo(u * 0.20, u * 0.06);
      ctx.stroke();
      ctx.restore();
    },

    /* Морозилка: та же посадка, что у стрелка, но голова — ледяной кристалл */
    freezer: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Draw.stalk(ctx, u * 0.10, u * 0.32, u * 0.16, u * 0.06,
        u * 0.02, -u * 0.04, 3 * k, t.color, 0.5);

      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      // Гранёная голова
      Draw.poly(ctx, [
        [0, -u * 0.42], [u * 0.20, -u * 0.24], [u * 0.16, u * 0.00],
        [0, u * 0.06], [-u * 0.16, u * 0.00], [-u * 0.20, -u * 0.24]
      ]);
      ctx.fill(); ctx.stroke();

      // Иней вокруг
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 1.9);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      for (var i = 0; i < 3; i++) {
        var a = -Math.PI / 2 + (i - 1) * 0.9;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * u * 0.24, -u * 0.18 + Math.sin(a) * u * 0.24);
        ctx.lineTo(Math.cos(a) * u * 0.34, -u * 0.18 + Math.sin(a) * u * 0.34);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, -u * 0.20, u * 0.045); ctx.fill();
    },

    /* Дробовик: приземистый раструб, широкий зев */
    shotgun: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [-u * 0.30, -u * 0.26], [u * 0.30, -u * 0.26], [u * 0.20, u * 0.06],
        [u * 0.26, u * 0.28], [-u * 0.26, u * 0.28], [-u * 0.20, u * 0.06]
      ]);
      ctx.fill(); ctx.stroke();

      // Тёмный зев
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = PAL.bgDeep;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.24, u * 0.24, u * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.24, u * 0.24, u * 0.07, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-u * 0.16, u * 0.12, u * 0.32, u * 0.05);
      ctx.globalAlpha = 1;
    },

    /* Дуплет: два рыла одно над другим */
    repeater: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Draw.stalk(ctx, -u * 0.08, u * 0.32, -u * 0.14, u * 0.08,
        0, u * 0.02, 3 * k, t.color, 0.5);

      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      // Нижняя голова
      Draw.smooth(ctx, [
        [u * 0.02, -u * 0.14], [u * 0.18, -u * 0.06], [u * 0.14, u * 0.12],
        [-u * 0.04, u * 0.16], [-u * 0.17, u * 0.06], [-u * 0.15, -u * 0.08]
      ]);
      ctx.fill(); ctx.stroke();
      // Верхняя голова
      Draw.smooth(ctx, [
        [u * 0.02, -u * 0.44], [u * 0.16, -u * 0.36], [u * 0.13, -u * 0.20],
        [-u * 0.03, -u * 0.16], [-u * 0.15, -u * 0.24], [-u * 0.13, -u * 0.38]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.7;
      Draw.circle(ctx, u * 0.02, -u * 0.40, u * 0.03); ctx.fill();
      Draw.circle(ctx, u * 0.02, -u * 0.10, u * 0.03); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Горн: обгорелый пень с живым языком пламени */
    torch: function (ctx, u, k, t, opts, time) {
      var flick = 0.5 + 0.5 * Math.sin(time * 7.3);
      ctx.lineWidth = Math.max(1, k);

      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [-u * 0.22, -u * 0.06], [u * 0.22, -u * 0.04], [u * 0.28, u * 0.16],
        [0, u * 0.30], [-u * 0.28, u * 0.16]
      ]);
      ctx.fill(); ctx.stroke();

      // Годовые кольца на срезе
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.03, u * 0.14, u * 0.045, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Пламя
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.22 + 0.18 * flick;
      Draw.smooth(ctx, [
        [0, -u * 0.44 - u * 0.05 * flick], [u * 0.15, -u * 0.18],
        [u * 0.05, -u * 0.04], [-u * 0.05, -u * 0.04], [-u * 0.15, -u * 0.18]
      ]);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      Draw.smooth(ctx, [
        [0, -u * 0.28 - u * 0.04 * flick], [u * 0.07, -u * 0.14],
        [0, -u * 0.05], [-u * 0.07, -u * 0.14]
      ]);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Магнит: гриб, под шляпкой — подкова */
    magnet: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;

      // Ножка
      Draw.smooth(ctx, [
        [-u * 0.09, -u * 0.06], [u * 0.09, -u * 0.06],
        [u * 0.13, u * 0.28], [-u * 0.13, u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      // Шляпка
      Draw.smooth(ctx, [
        [0, -u * 0.38], [u * 0.30, -u * 0.20], [u * 0.26, -u * 0.04],
        [-u * 0.26, -u * 0.04], [-u * 0.30, -u * 0.20]
      ]);
      ctx.fill(); ctx.stroke();

      // Подкова
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(2, 3.5 * k);
      ctx.beginPath();
      ctx.arc(0, -u * 0.16, u * 0.11, Math.PI * 0.95, Math.PI * 2.05);
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.fillRect(-u * 0.145, -u * 0.17, u * 0.06, u * 0.10);
      ctx.fillRect(u * 0.085, -u * 0.17, u * 0.06, u * 0.10);

      ctx.globalAlpha = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(time * 2.6));
      Draw.glowCircle(ctx, 0, -u * 0.16, u * 0.26, t.color, 1, 3 * k);
      ctx.globalAlpha = 1;
    },

    /* Веер: один стебель, три рыла врозь */
    fan: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Draw.stalk(ctx, 0, u * 0.32, 0, u * 0.14, 0, u * 0.04, 3 * k, t.color, 0.5);

      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      var angles = [-0.62, 0, 0.62];
      for (var i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(0, u * 0.02);
        ctx.rotate(angles[i]);
        Draw.smooth(ctx, [
          [0, -u * 0.40], [u * 0.13, -u * 0.32], [u * 0.11, -u * 0.14],
          [0, -u * 0.08], [-u * 0.11, -u * 0.14], [-u * 0.13, -u * 0.32]
        ]);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = t.color;
        ctx.globalAlpha = 0.7;
        Draw.circle(ctx, 0, -u * 0.36, u * 0.028); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
        ctx.restore();
      }
    },

    /* Ремонтник: пузатый корпус с обвисшим манипулятором */
    repair: function (ctx, u, k, t, opts, time) {
      var arm = Math.sin(time * 1.3);
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [-u * 0.06, -u * 0.32], [u * 0.20, -u * 0.20], [u * 0.24, u * 0.10],
        [u * 0.04, u * 0.30], [-u * 0.22, u * 0.18], [-u * 0.24, -u * 0.12]
      ]);
      ctx.fill(); ctx.stroke();

      // Манипулятор
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(u * 0.16, -u * 0.10);
      ctx.quadraticCurveTo(u * 0.34, u * 0.02, u * 0.30 + arm * u * 0.05, u * 0.20);
      ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, u * 0.30 + arm * u * 0.05, u * 0.22, u * 0.045); ctx.fill();
      ctx.restore();

      // Крест
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.04, -u * 0.14); ctx.lineTo(-u * 0.04, u * 0.06);
      ctx.moveTo(-u * 0.14, -u * 0.04); ctx.lineTo(u * 0.06, -u * 0.04);
      ctx.stroke();
    },

    /* Мортира: короткий толстый ствол навесом на земляном холмике */
    mortar: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;

      // Холмик
      Draw.smooth(ctx, [
        [-u * 0.34, u * 0.10], [0, u * 0.00], [u * 0.34, u * 0.10],
        [u * 0.28, u * 0.30], [-u * 0.28, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();

      // Ствол
      ctx.save();
      ctx.rotate(-0.30);
      Draw.smooth(ctx, [
        [-u * 0.13, -u * 0.34], [u * 0.13, -u * 0.34],
        [u * 0.10, u * 0.06], [-u * 0.10, u * 0.06]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = PAL.bgDeep;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.33, u * 0.12, u * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    },

    /* Лазер: тонкий кристалл-шпиль, копящий свет */
    laser: function (ctx, u, k, t, opts, time) {
      var charge = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;

      // Основание
      Draw.smooth(ctx, [
        [-u * 0.22, u * 0.10], [u * 0.22, u * 0.10],
        [u * 0.16, u * 0.30], [-u * 0.16, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();

      // Шпиль
      Draw.poly(ctx, [
        [0, -u * 0.44], [u * 0.12, -u * 0.12], [u * 0.08, u * 0.12],
        [-u * 0.08, u * 0.12], [-u * 0.12, -u * 0.12]
      ]);
      ctx.fill(); ctx.stroke();

      // Свет внутри
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.2 + 0.4 * charge;
      Draw.poly(ctx, [
        [0, -u * 0.34], [u * 0.05, -u * 0.10], [0, u * 0.06], [-u * 0.05, -u * 0.10]
      ]);
      ctx.fill();
      ctx.globalAlpha = 0.25 + 0.3 * charge;
      Draw.circle(ctx, 0, -u * 0.40, u * 0.06 + u * 0.02 * charge); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Мина: бугристый клубень, наполовину в земле */
    mine: function (ctx, u, k, t, opts, time) {
      var blink = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [-u * 0.04, -u * 0.16], [u * 0.14, -u * 0.10], [u * 0.17, u * 0.06],
        [0, u * 0.14], [-u * 0.16, u * 0.06], [-u * 0.15, -u * 0.08]
      ]);
      ctx.fill(); ctx.stroke();

      // Росток-взрыватель
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * blink;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(u * 0.02, -u * 0.14);
      ctx.quadraticCurveTo(u * 0.08, -u * 0.24, u * 0.01, -u * 0.28);
      ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, u * 0.01, -u * 0.29, u * 0.035); ctx.fill();
      ctx.restore();
    },

    /* Шипы: низкий неровный мат с торчащими зубьями */
    spikes: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [-u * 0.34, u * 0.12], [-u * 0.10, u * 0.06], [u * 0.14, u * 0.10],
        [u * 0.34, u * 0.14], [u * 0.24, u * 0.28], [-u * 0.22, u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      // Зубья разной длины — ровный частокол выглядел бы деталью интерфейса
      ctx.fillStyle = t.color;
      var hs = [0.20, 0.30, 0.16, 0.26, 0.19];
      for (var i = 0; i < 5; i++) {
        var x = -u * 0.27 + i * u * 0.135;
        Draw.poly(ctx, [
          [x - u * 0.045, u * 0.10], [x + u * 0.045, u * 0.10], [x + (i % 2 ? 0.01 : -0.01) * u, u * 0.10 - u * hs[i]]
        ]);
        ctx.fill();
      }
    },

    /* Капкан: кособокая голова-пасть на согнутом стебле */
    chomper: function (ctx, u, k, t, opts, time) {
      var open = opts.busy ? 0.06 : 0.34 + 0.06 * Math.sin(time * 1.8);
      ctx.lineWidth = Math.max(1, k);
      Draw.stalk(ctx, u * 0.10, u * 0.32, u * 0.18, u * 0.10,
        -u * 0.02, u * 0.02, 3 * k, t.color, 0.5);

      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;

      // Нижняя челюсть
      ctx.save();
      ctx.translate(-u * 0.02, u * 0.02);
      Draw.smooth(ctx, [
        [-u * 0.26, -u * 0.02], [u * 0.24, u * 0.00],
        [u * 0.18, u * 0.18], [-u * 0.20, u * 0.16]
      ]);
      ctx.fill(); ctx.stroke();
      // Верхняя раскрывается
      ctx.rotate(-open);
      Draw.smooth(ctx, [
        [-u * 0.26, -u * 0.02], [u * 0.26, -u * 0.06],
        [u * 0.20, -u * 0.26], [-u * 0.18, -u * 0.22]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      // Зубы
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#D8DEE6';
      for (var i = 0; i < 3; i++) {
        var x = -u * 0.14 + i * u * 0.14;
        Draw.poly(ctx, [[x - u * 0.03, u * 0.02], [x + u * 0.03, u * 0.02], [x, u * 0.09]]);
        ctx.fill();
      }
      ctx.restore();
    },

    /* Молния: шар на узкой ноге, вокруг бегут дуги */
    tesla: function (ctx, u, k, t, opts, time) {
      var pulse = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;

      Draw.smooth(ctx, [
        [-u * 0.16, u * 0.04], [u * 0.16, u * 0.04],
        [u * 0.22, u * 0.30], [-u * 0.22, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();

      // Витки
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = t.color;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, u * 0.02 - i * u * 0.07, u * 0.11 - i * u * 0.012, u * 0.028, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Шар
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.circle(ctx, 0, -u * 0.26, u * 0.13);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.4 * pulse;
      Draw.circle(ctx, 0, -u * 0.26, u * 0.09); ctx.fill();
      ctx.globalAlpha = 1;

      // Дуга
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.13, -u * 0.34);
      ctx.lineTo(-u * 0.04, -u * 0.28);
      ctx.lineTo(-u * 0.10, -u * 0.20);
      ctx.stroke();
    },

    /* Гарпун: наклонный станок с зазубренным наконечником */
    harpoon: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;

      Draw.smooth(ctx, [
        [-u * 0.26, u * 0.06], [u * 0.26, u * 0.02],
        [u * 0.20, u * 0.30], [-u * 0.22, u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.save();
      ctx.rotate(-0.12);
      // Древко
      Draw.smooth(ctx, [
        [-u * 0.05, -u * 0.30], [u * 0.05, -u * 0.30],
        [u * 0.04, u * 0.08], [-u * 0.04, u * 0.08]
      ]);
      ctx.fill(); ctx.stroke();
      // Зазубренный наконечник
      ctx.fillStyle = t.color;
      Draw.poly(ctx, [
        [0, -u * 0.44], [u * 0.11, -u * 0.24], [u * 0.04, -u * 0.27],
        [0, -u * 0.20], [-u * 0.04, -u * 0.27], [-u * 0.11, -u * 0.24]
      ]);
      ctx.fill();
      ctx.restore();

      // Моток троса
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(u * 0.12, u * 0.18, u * 0.07, u * 0.05, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },

    /* Зонт: широкий ребристый купол на кривой ножке */
    umbrella: function (ctx, u, k, t, opts, time) {
      var tilt = Math.sin(time * 0.9) * 0.05;
      ctx.lineWidth = Math.max(1, k);
      Draw.stalk(ctx, u * 0.04, u * 0.32, u * 0.08, u * 0.12,
        0, -u * 0.04, 2.5 * k, t.color, 0.45);

      ctx.save();
      ctx.rotate(tilt);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.smooth(ctx, [
        [0, -u * 0.40], [u * 0.26, -u * 0.24], [u * 0.36, -u * 0.04],
        [u * 0.12, -u * 0.10], [0, -u * 0.02], [-u * 0.12, -u * 0.10],
        [-u * 0.36, -u * 0.04], [-u * 0.26, -u * 0.24]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.36); ctx.quadraticCurveTo(-u * 0.14, -u * 0.20, -u * 0.20, -u * 0.07);
      ctx.moveTo(0, -u * 0.36); ctx.quadraticCurveTo(u * 0.14, -u * 0.20, u * 0.20, -u * 0.07);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    },

    /* Маятник: кривая рама и тяжёлый груз, ходящий из стороны в сторону */
    pendulum: function (ctx, u, k, t, opts, time) {
      var sway = Math.sin(time * 2.2) * 0.55;
      ctx.lineWidth = Math.max(1, k);

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.28, u * 0.30);
      ctx.quadraticCurveTo(-u * 0.10, -u * 0.20, 0, -u * 0.30);
      ctx.quadraticCurveTo(u * 0.10, -u * 0.20, u * 0.28, u * 0.30);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(0, -u * 0.28);
      ctx.rotate(sway);
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, u * 0.32);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.smooth(ctx, [
        [0, u * 0.26], [u * 0.13, u * 0.36], [u * 0.06, u * 0.50],
        [-u * 0.06, u * 0.50], [-u * 0.13, u * 0.36]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6;
      Draw.circle(ctx, 0, u * 0.38, u * 0.04); ctx.fill();
      ctx.restore();
    },

    /* Сеть: полотно, натянутое между двумя кривыми стойками */
    net: function (ctx, u, k, t, opts, time) {
      var wob = Math.sin(time * 1.6) * u * 0.012;
      ctx.lineWidth = Math.max(1, k);

      // Стойки
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2.4 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.24, u * 0.30);
      ctx.quadraticCurveTo(-u * 0.30, -u * 0.06, -u * 0.22, -u * 0.30);
      ctx.moveTo(u * 0.24, u * 0.30);
      ctx.quadraticCurveTo(u * 0.30, -u * 0.06, u * 0.22, -u * 0.30);
      ctx.stroke();
      ctx.restore();

      // Полотно провисает
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      for (var i = 0; i <= 4; i++) {
        var f = i / 4;
        var x = -u * 0.22 + f * u * 0.44;
        ctx.moveTo(x, -u * 0.30 + Math.abs(f - 0.5) * u * 0.04);
        ctx.lineTo(x, u * 0.10 + wob);
      }
      for (var j = 0; j < 4; j++) {
        var y = -u * 0.26 + j * u * 0.11;
        ctx.moveTo(-u * 0.23, y);
        ctx.quadraticCurveTo(0, y + u * 0.07 + wob, u * 0.23, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
};
