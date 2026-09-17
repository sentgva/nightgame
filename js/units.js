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
    /* Маяк: приземистая башня с пульсирующей линзой и двумя лучами */
    beacon: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var pulse = 0.5 + 0.5 * Math.sin(time * 2.2);

      // Основание
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.21, u * 0.28], [u * 0.21, u * 0.28],
        [u * 0.14, -u * 0.12], [-u * 0.14, -u * 0.12]
      ]);
      ctx.fill(); ctx.stroke();

      // Поясок на башне
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(-u * 0.175, u * 0.09); ctx.lineTo(u * 0.175, u * 0.09);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Фонарь
      Draw.roundRect(ctx, -u * 0.15, -u * 0.30, u * 0.30, u * 0.19, u * 0.04);
      ctx.fill(); ctx.stroke();

      // Линза: ореол пульсирует, ядро горит ровно
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.18 + 0.22 * pulse;
      Draw.circle(ctx, 0, -u * 0.205, u * 0.115 + u * 0.02 * pulse);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.205, u * 0.055);
      ctx.fill();

      // Лучи в стороны
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.25 * pulse;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.21, -u * 0.245); ctx.lineTo(-u * 0.32, -u * 0.275);
      ctx.moveTo(u * 0.21, -u * 0.245); ctx.lineTo(u * 0.32, -u * 0.275);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Стрелок: корпус с плечами, ствол вверх и светящийся прицел */
    shooter: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Ствол
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.055, -u * 0.34, u * 0.11, u * 0.20, u * 0.025);
      ctx.fill(); ctx.stroke();

      // Корпус
      Units.body(ctx, t, opts, u * 0.46, u * 0.42, u * 0.11, u * 0.04);

      // Плечи-опоры
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-u * 0.29, -u * 0.06, u * 0.06, u * 0.16);
      ctx.fillRect(u * 0.23, -u * 0.06, u * 0.06, u * 0.16);
      ctx.globalAlpha = 1;

      // Прицел
      ctx.globalAlpha = 0.22;
      Draw.circle(ctx, 0, u * 0.05, u * 0.105);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, u * 0.05, u * 0.05);
      ctx.fill();
    },

    /* Барьер: широкий блок из плит с заклёпками */
    barrier: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.74, u * 0.44, u * 0.07, u * 0.03);

      // Вертикальные швы между плитами
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.125, -u * 0.17); ctx.lineTo(-u * 0.125, u * 0.23);
      ctx.moveTo(u * 0.125, -u * 0.17); ctx.lineTo(u * 0.125, u * 0.23);
      ctx.stroke();

      // Заклёпки по углам
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = t.color;
      var rx = u * 0.30, ry1 = -u * 0.12, ry2 = u * 0.18;
      Draw.circle(ctx, -rx, ry1, u * 0.022); ctx.fill();
      Draw.circle(ctx, rx, ry1, u * 0.022); ctx.fill();
      Draw.circle(ctx, -rx, ry2, u * 0.022); ctx.fill();
      Draw.circle(ctx, rx, ry2, u * 0.022); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Морозилка: шестигранник со снежинкой и инеем */
    freezer: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.ngon(ctx, 0, 0, u * 0.29, 6, Math.PI / 6);
      ctx.fill(); ctx.stroke();

      // Снежинка: три луча через центр
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      var r = u * 0.155;
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var a = i * Math.PI / 3 + Math.PI / 6;
        ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();

      // Иней: точка в центре и лёгкое мерцание по кромке
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, 0, u * 0.035); ctx.fill();
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 1.7);
      Draw.glowCircle(ctx, 0, 0, u * 0.29, t.color, 1, 2 * k);
      ctx.globalAlpha = 1;
    },

    /* Дробовик: приземистый корпус с двумя стволами */
    shotgun: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Два ствола
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.13, -u * 0.32, u * 0.10, u * 0.18, u * 0.02);
      ctx.fill(); ctx.stroke();
      Draw.roundRect(ctx, u * 0.03, -u * 0.32, u * 0.10, u * 0.18, u * 0.02);
      ctx.fill(); ctx.stroke();

      // Корпус трапецией — шире книзу
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.poly(ctx, [
        [-u * 0.22, -u * 0.16], [u * 0.22, -u * 0.16],
        [u * 0.29, u * 0.27], [-u * 0.29, u * 0.27]
      ]);
      ctx.fill(); ctx.stroke();

      // Затвор
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-u * 0.15, u * 0.02, u * 0.30, u * 0.045);
      ctx.globalAlpha = 1;
    },

    /* Дуплет: широкий корпус с двумя параллельными стволами */
    repeater: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;

      Draw.roundRect(ctx, -u * 0.155, -u * 0.36, u * 0.11, u * 0.24, u * 0.025);
      ctx.fill(); ctx.stroke();
      Draw.roundRect(ctx, u * 0.045, -u * 0.36, u * 0.11, u * 0.24, u * 0.025);
      ctx.fill(); ctx.stroke();

      Units.body(ctx, t, opts, u * 0.52, u * 0.40, u * 0.11, u * 0.05);

      // Два прицела
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25;
      Draw.circle(ctx, -u * 0.10, u * 0.06, u * 0.085); ctx.fill();
      Draw.circle(ctx, u * 0.10, u * 0.06, u * 0.085); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, -u * 0.10, u * 0.06, u * 0.04); ctx.fill();
      Draw.circle(ctx, u * 0.10, u * 0.06, u * 0.04); ctx.fill();
    },

    /* Веер: три ствола, расходящиеся в стороны */
    fan: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.strokeStyle = t.color;
      ctx.fillStyle = t.fill;

      // Стволы веером
      var angles = [-0.42, 0, 0.42];
      for (var i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(angles[i]);
        Draw.roundRect(ctx, -u * 0.045, -u * 0.36, u * 0.09, u * 0.20, u * 0.02);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      Units.body(ctx, t, opts, u * 0.50, u * 0.36, u * 0.10, u * 0.07);

      // Веерная риска на корпусе
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.arc(0, u * 0.10, u * 0.12, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Горн: жаровня с живым языком пламени */
    torch: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var flick = 0.5 + 0.5 * Math.sin(time * 7.3);

      // Чаша
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.26, u * 0.02], [u * 0.26, u * 0.02],
        [u * 0.17, u * 0.27], [-u * 0.17, u * 0.27]
      ]);
      ctx.fill(); ctx.stroke();

      // Ножка
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-u * 0.10, u * 0.27, u * 0.20, u * 0.04);
      ctx.globalAlpha = 1;

      // Пламя: внешний язык дышит, ядро ровное
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.2 * flick;
      Draw.poly(ctx, [
        [0, -u * 0.34 - u * 0.04 * flick],
        [u * 0.13, u * 0.01], [-u * 0.13, u * 0.01]
      ]);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.poly(ctx, [
        [0, -u * 0.20 - u * 0.03 * flick],
        [u * 0.06, u * 0.01], [-u * 0.06, u * 0.01]
      ]);
      ctx.fill();
    },

    /* Магнит: подкова с двумя полюсами */
    magnet: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.50, u * 0.46, u * 0.12, 0);

      // Дуга подковы
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(2, 4 * k);
      ctx.beginPath();
      ctx.arc(0, u * 0.03, u * 0.14, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Полюса
      ctx.fillStyle = t.color;
      ctx.fillRect(-u * 0.175, u * 0.03, u * 0.07, u * 0.11);
      ctx.fillRect(u * 0.105, u * 0.03, u * 0.07, u * 0.11);

      // Поле вокруг — дышит
      ctx.globalAlpha = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(time * 2.6));
      Draw.glowCircle(ctx, 0, 0, u * 0.26, t.color, 1, 3 * k);
      ctx.globalAlpha = 1;
    },

    /* Мортира: короткий толстый ствол под углом на станине */
    mortar: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Станина
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.28, u * 0.10], [u * 0.28, u * 0.10],
        [u * 0.22, u * 0.28], [-u * 0.22, u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      // Ствол навесом
      ctx.save();
      ctx.rotate(-0.28);
      Draw.roundRect(ctx, -u * 0.105, -u * 0.32, u * 0.21, u * 0.38, u * 0.05);
      ctx.fill(); ctx.stroke();
      // Дульный срез
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = t.color;
      ctx.fillRect(-u * 0.08, -u * 0.30, u * 0.16, u * 0.035);
      ctx.globalAlpha = 1;
      ctx.restore();

      // Опорные колёса
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.55;
      Draw.circle(ctx, -u * 0.21, u * 0.20, u * 0.045); ctx.fill();
      Draw.circle(ctx, u * 0.21, u * 0.20, u * 0.045); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Лазер: узкая стойка с линзой и разрядником сверху */
    laser: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var charge = 0.5 + 0.5 * Math.sin(time * 6);

      // Стойка
      Units.body(ctx, t, opts, u * 0.34, u * 0.44, u * 0.09, u * 0.06);

      // Излучатель
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.13, -u * 0.16], [u * 0.13, -u * 0.16],
        [u * 0.06, -u * 0.34], [-u * 0.06, -u * 0.34]
      ]);
      ctx.fill(); ctx.stroke();

      // Линза копит заряд
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.35 * charge;
      Draw.circle(ctx, 0, -u * 0.31, u * 0.055 + u * 0.015 * charge);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.31, u * 0.025);
      ctx.fill();

      // Рёбра охлаждения
      ctx.globalAlpha = 0.45;
      for (var i = -1; i <= 1; i++) {
        ctx.fillRect(-u * 0.17 + (i + 1) * u * 0.115, u * 0.02, u * 0.045, u * 0.14);
      }
      ctx.globalAlpha = 1;
    },

    /* Ремонтник: корпус с манипулятором и вращающимся ключом */
    repair: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.46, u * 0.42, u * 0.13, u * 0.04);

      // Манипулятор описывает круг — видно, что юнит работает
      var a = time * 1.4;
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.02);
      ctx.lineTo(Math.cos(a) * u * 0.22, u * 0.02 + Math.sin(a) * u * 0.22);
      ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, Math.cos(a) * u * 0.22, u * 0.02 + Math.sin(a) * u * 0.22, u * 0.035);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Крест ремонта в центре
      ctx.lineWidth = Math.max(1, 1.5 * k);
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.07); ctx.lineTo(0, u * 0.11);
      ctx.moveTo(-u * 0.09, u * 0.02); ctx.lineTo(u * 0.09, u * 0.02);
      ctx.stroke();
    },

    /* Шипы: плоская гребёнка на земле */
    spikes: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.32, u * 0.06, u * 0.64, u * 0.18, u * 0.05);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = t.color;
      for (var i = 0; i < 5; i++) {
        var x = -u * 0.26 + i * u * 0.13;
        Draw.poly(ctx, [[x - u * 0.045, u * 0.06], [x + u * 0.045, u * 0.06], [x, u * 0.06 - u * 0.16]]);
        ctx.fill();
      }
    },

    /* Капкан: раскрытая пасть, в жевании закрывается */
    chomper: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var open = opts.busy ? 0.08 : 0.30 + 0.05 * Math.sin(time * 2);

      // Стебель
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.30); ctx.lineTo(0, u * 0.02);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, k);

      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      // Нижняя челюсть
      Draw.poly(ctx, [[-u * 0.24, u * 0.04], [u * 0.24, u * 0.04],
                      [u * 0.16, u * 0.20], [-u * 0.16, u * 0.20]]);
      ctx.fill(); ctx.stroke();
      // Верхняя челюсть раскрывается
      ctx.save();
      ctx.translate(0, u * 0.02);
      ctx.rotate(-open);
      Draw.poly(ctx, [[-u * 0.24, 0], [u * 0.24, 0], [u * 0.16, -u * 0.20], [-u * 0.16, -u * 0.20]]);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, u * 0.11, u * 0.03); ctx.fill();
    },

    /* Молния: катушка с дугой разряда */
    tesla: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.34, u * 0.34, u * 0.08, u * 0.12);

      // Катушка
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.7;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, u * 0.02 + i * u * 0.075, u * 0.14, u * 0.035, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Шар и разряд
      ctx.fillStyle = t.color;
      var pulse = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      Draw.circle(ctx, 0, -u * 0.20, u * 0.12); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.20, u * 0.055); ctx.fill();

      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.10, -u * 0.30);
      ctx.lineTo(-u * 0.03, -u * 0.24);
      ctx.lineTo(-u * 0.08, -u * 0.18);
      ctx.stroke();
    },

    /* Гарпун: станок с наконечником и тросом */
    harpoon: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.42, u * 0.32, u * 0.09, u * 0.14);

      // Направляющая
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.05, -u * 0.26, u * 0.10, u * 0.34, u * 0.03);
      ctx.fill(); ctx.stroke();

      // Наконечник
      ctx.fillStyle = t.color;
      Draw.poly(ctx, [[0, -u * 0.36], [u * 0.09, -u * 0.22], [-u * 0.09, -u * 0.22]]);
      ctx.fill();

      // Трос
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, u * 0.12);
      ctx.quadraticCurveTo(0, u * 0.04, u * 0.14, u * 0.12);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Зонт: купол на короткой ножке */
    umbrella: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Ножка
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.28); ctx.lineTo(0, -u * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, k);

      // Купол
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.beginPath();
      ctx.moveTo(-u * 0.32, -u * 0.04);
      ctx.quadraticCurveTo(0, -u * 0.40, u * 0.32, -u * 0.04);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Рёбра
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-u * 0.16, -u * 0.04); ctx.quadraticCurveTo(-u * 0.14, -u * 0.24, 0, -u * 0.30);
      ctx.moveTo(u * 0.16, -u * 0.04); ctx.quadraticCurveTo(u * 0.14, -u * 0.24, 0, -u * 0.30);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Маятник: груз на подвесе, ходит из стороны в сторону */
    pendulum: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var sway = Math.sin(time * 2.2) * 0.5;

      // Рама
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.26, u * 0.28); ctx.lineTo(0, -u * 0.26);
      ctx.lineTo(u * 0.26, u * 0.28);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Подвес с грузом
      ctx.save();
      ctx.translate(0, -u * 0.26);
      ctx.rotate(sway);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, u * 0.34);
      ctx.stroke();
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.circle(ctx, 0, u * 0.40, u * 0.11);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, u * 0.40, u * 0.04);
      ctx.fill();
      ctx.restore();
    },

    /* Сеть: катушка с растянутым полотном */
    net: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.40, u * 0.30, u * 0.08, u * 0.15);

      // Полотно
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      for (var i = -2; i <= 2; i++) {
        ctx.moveTo(i * u * 0.09, -u * 0.30);
        ctx.lineTo(i * u * 0.09 * 0.55, -u * 0.04);
      }
      for (var j = 0; j < 3; j++) {
        var y = -u * 0.28 + j * u * 0.10;
        var half = u * 0.19 * (1 - j * 0.22);
        ctx.moveTo(-half, y); ctx.lineTo(half, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Мина: диск с шипами и мигающим взрывателем */
    mine: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var blink = 0.5 + 0.5 * Math.sin(time * 5);

      // Шипы
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * u * 0.13, Math.sin(a) * u * 0.13);
        ctx.lineTo(Math.cos(a) * u * 0.185, Math.sin(a) * u * 0.185);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Корпус
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.lineWidth = Math.max(1, k);
      Draw.circle(ctx, 0, 0, u * 0.135);
      ctx.fill(); ctx.stroke();

      // Взрыватель
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.3 + 0.7 * blink;
      Draw.circle(ctx, 0, 0, u * 0.05);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
};
