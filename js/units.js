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

  /* Толстая тёмная обводка — главный приём мультяшной подачи */
  ink: function (ctx, t, k, mul) {
    ctx.strokeStyle = t.color;
    ctx.lineWidth = Math.max(1.6, (mul || 2.4) * k);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  },

  /* Лист: каплевидная форма под углом */
  leaf: function (ctx, x, y, len, wid, ang, fill, line, k) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = fill;
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1.4, 2 * k);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(len * 0.1, 0); ctx.lineTo(len * 0.85, 0);
    ctx.stroke();
    ctx.restore();
  },

  /* Глаза растения: крупный белок и тёмный зрачок. Моргают редко
     и вразнобой, зрачок косится вверх — туда, откуда идут зомби. */
  face: function (ctx, u, k, gap, ey, r, time, seed, outline) {
    var blink = Math.sin(time * 0.8 + seed) > 0.97 ? 0.15 : 1;
    var look = Math.sin(time * 0.5 + seed) * r * 0.22;
    ctx.save();
    for (var i = -1; i <= 1; i += 2) {
      var ex = i * gap;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1.2, 1.7 * k);
      ctx.beginPath();
      ctx.ellipse(ex, ey, r, r * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (blink > 0.5) {
        ctx.fillStyle = outline;
        Draw.circle(ctx, ex + look, ey - r * 0.18, r * 0.46);
        ctx.fill();
      }
    }
    ctx.restore();
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
    color: PAL.sparkEdge, fill: PAL.spark,
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
    color: '#0277BD', fill: '#81D4FA',
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
    Draw.ink(ctx, t, k);

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

  /* Постамент третьей ступени: золотой венок под растением */
  tierBase: function (ctx, u, k, t, time) {
    ctx.save();
    ctx.strokeStyle = '#E09B00';
    ctx.fillStyle = '#FFD54F';
    ctx.lineWidth = Math.max(1.4, 2 * k);
    ctx.beginPath();
    ctx.ellipse(0, u * 0.30, u * 0.34, u * 0.10, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2 + time * 0.5;
      Draw.circle(ctx, Math.cos(a) * u * 0.34, u * 0.30 + Math.sin(a) * u * 0.10, 2.2 * k);
      ctx.fill();
    }
    ctx.restore();
  },

  /* Знак ступени: вторая — золотой лист над растением,
     третья — корона и искры вокруг. Улучшение должно быть видно
     с одного взгляда, не разглядывая обводку. */
  tierMark: function (ctx, u, k, t, level, time) {
    var gold = '#FFD54F', goldEdge = '#E09B00';
    ctx.save();
    ctx.lineJoin = 'round';

    if (level === 2) {
      ctx.fillStyle = gold;
      ctx.strokeStyle = goldEdge;
      ctx.lineWidth = Math.max(1.2, 1.8 * k);
      Draw.leaf(ctx, -u * 0.06, -u * 0.40, u * 0.16, u * 0.055, -0.5, gold, goldEdge, k);
    } else {
      // Корона
      ctx.fillStyle = gold;
      ctx.strokeStyle = goldEdge;
      ctx.lineWidth = Math.max(1.2, 1.8 * k);
      Draw.poly(ctx, [
        [-u * 0.15, -u * 0.36], [-u * 0.15, -u * 0.50], [-u * 0.07, -u * 0.42],
        [0, -u * 0.54], [u * 0.07, -u * 0.42], [u * 0.15, -u * 0.50],
        [u * 0.15, -u * 0.36]
      ]);
      ctx.fill(); ctx.stroke();

      // Искры по кругу
      ctx.fillStyle = gold;
      for (var i = 0; i < 4; i++) {
        var a = time * 1.2 + i * Math.PI / 2;
        ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(time * 2 + i));
        Draw.circle(ctx, Math.cos(a) * u * 0.40, Math.sin(a) * u * 0.34, 2.4 * k);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
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
    /* Подсолнух: лепестки, круглая голова и добродушное лицо */
    beacon: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var sway = Math.sin(time * 1.2) * u * 0.02;
      Draw.stalk(ctx, 0, u * 0.34, u * 0.04, u * 0.10, sway, -u * 0.06, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, -u * 0.02, u * 0.16, u * 0.22, u * 0.09, 3.5, '#5BA83F', '#2E6B1E', k);
      Draw.leaf(ctx, u * 0.02, u * 0.08, u * 0.20, u * 0.08, -0.5, '#5BA83F', '#2E6B1E', k);

      // Лепестки
      ctx.save();
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2);
      for (var i = 0; i < 10; i++) {
        var a = i * Math.PI / 5 + time * 0.12;
        ctx.save();
        ctx.translate(sway + Math.cos(a) * u * 0.21, -u * 0.18 + Math.sin(a) * u * 0.21);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, u * 0.10, u * 0.055, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Сердцевина
      ctx.fillStyle = '#8D5524'; Draw.ink(ctx, t, k, 2.4);
      Draw.circle(ctx, sway, -u * 0.18, u * 0.17);
      ctx.fill(); ctx.stroke();

      Draw.face(ctx, u, k, u * 0.065, -u * 0.20, u * 0.052, time, 1.1, L);
      ctx.strokeStyle = L; ctx.lineWidth = Math.max(1.2, 1.8 * k);
      ctx.beginPath();
      ctx.arc(sway, -u * 0.13, u * 0.055, 0.25, Math.PI - 0.25);
      ctx.stroke();
    },

    /* Горохострел: зелёная голова с трубкой-дулом */
    shooter: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var nod = Math.sin(time * 1.5) * u * 0.012;
      Draw.stalk(ctx, -u * 0.06, u * 0.34, -u * 0.16, u * 0.10, -u * 0.02, u * 0.00, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, -u * 0.05, u * 0.18, u * 0.22, u * 0.09, 3.4, '#5BA83F', '#2E6B1E', k);

      // Дуло
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.4);
      Draw.smooth(ctx, [
        [u * 0.06, -u * 0.40 + nod], [u * 0.22, -u * 0.34 + nod],
        [u * 0.22, -u * 0.20], [u * 0.06, -u * 0.16]
      ]);
      ctx.fill(); ctx.stroke();

      // Голова
      Draw.smooth(ctx, [
        [0, -u * 0.38 + nod], [u * 0.16, -u * 0.30 + nod], [u * 0.18, -u * 0.08],
        [0, u * 0.00], [-u * 0.18, -u * 0.08], [-u * 0.16, -u * 0.30 + nod]
      ]);
      ctx.fill(); ctx.stroke();

      Draw.face(ctx, u, k, u * 0.068, -u * 0.22 + nod, u * 0.055, time, 2.3, L);
    },

    /* Орех: круглая физиономия, вся суть — в лице */
    barrier: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.8);
      Draw.smooth(ctx, [
        [0, -u * 0.34], [u * 0.30, -u * 0.16], [u * 0.32, u * 0.14],
        [0, u * 0.32], [-u * 0.32, u * 0.14], [-u * 0.30, -u * 0.16]
      ]);
      ctx.fill(); ctx.stroke();

      // Прожилки скорлупы
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, -u * 0.12); ctx.quadraticCurveTo(-u * 0.10, u * 0.04, -u * 0.18, u * 0.20);
      ctx.moveTo(u * 0.20, -u * 0.10); ctx.quadraticCurveTo(u * 0.10, u * 0.06, u * 0.18, u * 0.22);
      ctx.stroke();
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.10, -u * 0.06, u * 0.07, time, 0.4, L);
      // Сосредоточенный рот
      ctx.strokeStyle = L; ctx.lineWidth = Math.max(1.4, 2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.07, u * 0.14); ctx.lineTo(u * 0.07, u * 0.14);
      ctx.stroke();
    },

    /* Снежный горох: та же посадка, тело ледяное, изо рта идёт пар */
    freezer: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      Draw.stalk(ctx, u * 0.06, u * 0.34, u * 0.16, u * 0.10, u * 0.02, u * 0.00, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, u * 0.05, u * 0.18, u * 0.22, u * 0.09, -0.3, '#5BA83F', '#2E6B1E', k);

      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.4);
      Draw.smooth(ctx, [
        [u * 0.06, -u * 0.40], [u * 0.22, -u * 0.34], [u * 0.22, -u * 0.20], [u * 0.06, -u * 0.16]
      ]);
      ctx.fill(); ctx.stroke();
      Draw.smooth(ctx, [
        [0, -u * 0.38], [u * 0.16, -u * 0.30], [u * 0.18, -u * 0.08],
        [0, u * 0.00], [-u * 0.18, -u * 0.08], [-u * 0.16, -u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();

      // Снежинка на макушке
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1.2, 1.6 * k);
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 2);
      for (var i = 0; i < 3; i++) {
        var a = i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * u * 0.07, -u * 0.44 - Math.sin(a) * u * 0.07);
        ctx.lineTo(Math.cos(a) * u * 0.07, -u * 0.44 + Math.sin(a) * u * 0.07);
        ctx.stroke();
      }
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.068, -u * 0.22, u * 0.055, time, 3.1, L);
    },

    /* Дробовик: пузатый стручок с широким раструбом */
    shotgun: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      Draw.leaf(ctx, -u * 0.18, u * 0.22, u * 0.20, u * 0.08, 3.3, '#5BA83F', '#2E6B1E', k);
      Draw.leaf(ctx, u * 0.18, u * 0.22, u * 0.20, u * 0.08, -0.2, '#5BA83F', '#2E6B1E', k);

      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.6);
      Draw.smooth(ctx, [
        [-u * 0.30, -u * 0.22], [u * 0.30, -u * 0.22], [u * 0.22, u * 0.10],
        [u * 0.26, u * 0.30], [-u * 0.26, u * 0.30], [-u * 0.22, u * 0.10]
      ]);
      ctx.fill(); ctx.stroke();

      // Раструб
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.22, u * 0.26, u * 0.085, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = L;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.22, u * 0.17, u * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.09, u * 0.02, u * 0.06, time, 1.7, L);
    },

    /* Повторитель: две головы одна над другой */
    repeater: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      Draw.stalk(ctx, -u * 0.04, u * 0.34, -u * 0.14, u * 0.12, 0, u * 0.04, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, -u * 0.04, u * 0.20, u * 0.22, u * 0.09, 3.4, '#5BA83F', '#2E6B1E', k);

      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.3);
      // Нижняя голова
      Draw.smooth(ctx, [
        [0, -u * 0.12], [u * 0.16, -u * 0.04], [u * 0.16, u * 0.12],
        [0, u * 0.18], [-u * 0.16, u * 0.12], [-u * 0.16, -u * 0.04]
      ]);
      ctx.fill(); ctx.stroke();
      // Верхняя голова с дулом
      Draw.smooth(ctx, [
        [u * 0.06, -u * 0.40], [u * 0.22, -u * 0.34], [u * 0.22, -u * 0.22], [u * 0.06, -u * 0.18]
      ]);
      ctx.fill(); ctx.stroke();
      Draw.smooth(ctx, [
        [0, -u * 0.40], [u * 0.16, -u * 0.32], [u * 0.16, -u * 0.16],
        [0, -u * 0.10], [-u * 0.16, -u * 0.16], [-u * 0.16, -u * 0.32]
      ]);
      ctx.fill(); ctx.stroke();

      Draw.face(ctx, u, k, u * 0.060, -u * 0.26, u * 0.048, time, 2.9, L);
      Draw.face(ctx, u, k, u * 0.060, u * 0.02, u * 0.045, time, 4.2, L);
    },

    /* Факельный пень: горящая чаша на пеньке с лицом */
    torch: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var flick = 0.5 + 0.5 * Math.sin(time * 7.3);

      ctx.fillStyle = '#A9744F'; Draw.ink(ctx, t, k, 2.6);
      Draw.smooth(ctx, [
        [-u * 0.24, -u * 0.08], [u * 0.24, -u * 0.06], [u * 0.28, u * 0.16],
        [0, u * 0.30], [-u * 0.28, u * 0.16]
      ]);
      ctx.fill(); ctx.stroke();

      // Срез со следами колец
      ctx.fillStyle = '#C08A5E';
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.07, u * 0.23, u * 0.07, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Пламя
      ctx.fillStyle = F;
      Draw.smooth(ctx, [
        [0, -u * 0.46 - u * 0.05 * flick], [u * 0.16, -u * 0.20],
        [u * 0.05, -u * 0.08], [-u * 0.05, -u * 0.08], [-u * 0.16, -u * 0.20]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#FFD54F';
      Draw.smooth(ctx, [
        [0, -u * 0.32 - u * 0.04 * flick], [u * 0.08, -u * 0.16],
        [0, -u * 0.08], [-u * 0.08, -u * 0.16]
      ]);
      ctx.fill();
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.085, u * 0.10, u * 0.055, time, 5.5, L);
    },

    /* Магнит-гриб: фиолетовая шляпка и подкова */
    magnet: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      ctx.fillStyle = '#F3E5C0'; Draw.ink(ctx, t, k, 2.4);
      Draw.smooth(ctx, [
        [-u * 0.12, -u * 0.06], [u * 0.12, -u * 0.06],
        [u * 0.16, u * 0.28], [-u * 0.16, u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = F;
      Draw.smooth(ctx, [
        [0, -u * 0.40], [u * 0.32, -u * 0.20], [u * 0.28, -u * 0.04],
        [-u * 0.28, -u * 0.04], [-u * 0.32, -u * 0.20]
      ]);
      ctx.fill(); ctx.stroke();

      // Крапины на шляпке
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#FFFFFF';
      Draw.circle(ctx, -u * 0.15, -u * 0.20, u * 0.045); ctx.fill();
      Draw.circle(ctx, u * 0.13, -u * 0.24, u * 0.035); ctx.fill();
      Draw.circle(ctx, u * 0.02, -u * 0.30, u * 0.03); ctx.fill();
      ctx.restore();

      // Подкова
      ctx.strokeStyle = '#B0BEC5';
      ctx.lineWidth = Math.max(2, 4 * k);
      ctx.beginPath();
      ctx.arc(0, u * 0.10, u * 0.10, Math.PI * 0.98, Math.PI * 2.02);
      ctx.stroke();
      ctx.fillStyle = '#EF5350';
      ctx.fillRect(-u * 0.135, u * 0.09, u * 0.06, u * 0.09);
      ctx.fillStyle = '#42A5F5';
      ctx.fillRect(u * 0.075, u * 0.09, u * 0.06, u * 0.09);

      Draw.face(ctx, u, k, u * 0.075, -u * 0.14, u * 0.05, time, 6.1, L);
    },

    /* Тройной горох: три головы веером на одном стебле */
    fan: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      Draw.stalk(ctx, 0, u * 0.34, 0, u * 0.16, 0, u * 0.06, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, -u * 0.04, u * 0.22, u * 0.22, u * 0.09, 3.4, '#5BA83F', '#2E6B1E', k);

      var angles = [-0.6, 0, 0.6];
      for (var i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(0, u * 0.04);
        ctx.rotate(angles[i]);
        ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.2);
        Draw.smooth(ctx, [
          [u * 0.04, -u * 0.40], [u * 0.16, -u * 0.35], [u * 0.16, -u * 0.25], [u * 0.04, -u * 0.21]
        ]);
        ctx.fill(); ctx.stroke();
        Draw.smooth(ctx, [
          [0, -u * 0.38], [u * 0.12, -u * 0.31], [u * 0.12, -u * 0.17],
          [0, -u * 0.11], [-u * 0.12, -u * 0.17], [-u * 0.12, -u * 0.31]
        ]);
        ctx.fill(); ctx.stroke();
        Draw.face(ctx, u, k, u * 0.048, -u * 0.26, u * 0.038, time, 7 + i, L);
        ctx.restore();
      }
    },

    /* Ремонтник: цветок с лейкой */
    repair: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var arm = Math.sin(time * 1.4);
      Draw.stalk(ctx, 0, u * 0.34, -u * 0.06, u * 0.14, 0, u * 0.02, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, -u * 0.04, u * 0.20, u * 0.20, u * 0.08, 3.4, '#5BA83F', '#2E6B1E', k);

      // Лепестки
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.2);
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 + 0.3;
        ctx.save();
        ctx.translate(Math.cos(a) * u * 0.19, -u * 0.14 + Math.sin(a) * u * 0.19);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, u * 0.11, u * 0.07, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#FFE082';
      Draw.circle(ctx, 0, -u * 0.14, u * 0.13);
      ctx.fill(); ctx.stroke();

      Draw.face(ctx, u, k, u * 0.055, -u * 0.16, u * 0.044, time, 8.2, L);

      // Лейка на «руке»
      ctx.save();
      ctx.translate(u * 0.26, u * 0.06 + arm * u * 0.03);
      ctx.fillStyle = '#90A4AE';
      ctx.strokeStyle = '#455A64';
      ctx.lineWidth = Math.max(1.2, 1.8 * k);
      Draw.roundRect(ctx, -u * 0.07, -u * 0.06, u * 0.14, u * 0.12, u * 0.03);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(u * 0.07, -u * 0.03); ctx.lineTo(u * 0.15, -u * 0.09);
      ctx.stroke();
      ctx.restore();
    },

    /* Кукурузная пушка: початок с задранным стволом */
    mortar: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      Draw.leaf(ctx, -u * 0.20, u * 0.20, u * 0.22, u * 0.09, 3.3, '#5BA83F', '#2E6B1E', k);
      Draw.leaf(ctx, u * 0.20, u * 0.20, u * 0.22, u * 0.09, -0.15, '#5BA83F', '#2E6B1E', k);

      ctx.fillStyle = '#8D6E63'; Draw.ink(ctx, t, k, 2.6);
      Draw.smooth(ctx, [
        [-u * 0.30, u * 0.06], [0, -u * 0.04], [u * 0.30, u * 0.06],
        [u * 0.24, u * 0.30], [-u * 0.24, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();

      // Ствол-початок
      ctx.save();
      ctx.rotate(-0.34);
      ctx.fillStyle = F;
      Draw.smooth(ctx, [
        [-u * 0.13, -u * 0.36], [u * 0.13, -u * 0.36],
        [u * 0.11, u * 0.04], [-u * 0.11, u * 0.04]
      ]);
      ctx.fill(); ctx.stroke();
      // Зёрна
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#FFE082';
      for (var r = 0; r < 4; r++) for (var c = -1; c <= 1; c++) {
        Draw.circle(ctx, c * u * 0.07, -u * 0.30 + r * u * 0.09, u * 0.025);
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.075, u * 0.17, u * 0.05, time, 9.4, L);
    },

    /* Лазерный цветок: белый бутон с копящимся светом */
    laser: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var charge = 0.5 + 0.5 * Math.sin(time * 5);
      Draw.stalk(ctx, 0, u * 0.34, u * 0.04, u * 0.16, 0, u * 0.06, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, u * 0.04, u * 0.22, u * 0.20, u * 0.08, -0.2, '#5BA83F', '#2E6B1E', k);

      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.4);
      Draw.smooth(ctx, [
        [0, -u * 0.46], [u * 0.16, -u * 0.20], [u * 0.13, u * 0.06],
        [-u * 0.13, u * 0.06], [-u * 0.16, -u * 0.20]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.3 + 0.5 * charge;
      ctx.fillStyle = '#4FC3F7';
      Draw.circle(ctx, 0, -u * 0.34, u * 0.07 + u * 0.02 * charge);
      ctx.fill();
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.058, -u * 0.12, u * 0.046, time, 10.6, L);
    },

    /* Картофельная мина: клубень с ростком, наполовину в земле */
    mine: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var blink = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.2);
      Draw.smooth(ctx, [
        [0, -u * 0.17], [u * 0.17, -u * 0.08], [u * 0.18, u * 0.08],
        [0, u * 0.16], [-u * 0.18, u * 0.08], [-u * 0.17, -u * 0.08]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * blink;
      ctx.strokeStyle = '#EF5350';
      ctx.lineWidth = Math.max(1.4, 2 * k);
      ctx.beginPath();
      ctx.moveTo(u * 0.02, -u * 0.16);
      ctx.quadraticCurveTo(u * 0.10, -u * 0.26, u * 0.01, -u * 0.30);
      ctx.stroke();
      ctx.fillStyle = '#EF5350';
      Draw.circle(ctx, u * 0.01, -u * 0.31, u * 0.04); ctx.fill();
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.055, -u * 0.02, u * 0.042, time, 11.8, L);
    },

    /* Колючка: низкая гребёнка, лица нет — это ловушка, а не растение */
    spikes: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      ctx.fillStyle = '#4E7A2A'; Draw.ink(ctx, t, k, 2.2);
      Draw.smooth(ctx, [
        [-u * 0.34, u * 0.14], [-u * 0.08, u * 0.08], [u * 0.16, u * 0.12],
        [u * 0.34, u * 0.16], [u * 0.24, u * 0.30], [-u * 0.24, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = F;
      var hs = [0.22, 0.32, 0.18, 0.28, 0.20];
      for (var i = 0; i < 5; i++) {
        var x = -u * 0.27 + i * u * 0.135;
        Draw.poly(ctx, [
          [x - u * 0.05, u * 0.12], [x + u * 0.05, u * 0.12],
          [x + (i % 2 ? 0.012 : -0.012) * u, u * 0.12 - u * hs[i]]
        ]);
        ctx.fill(); ctx.stroke();
      }
    },

    /* Хищник: фиолетовая башка с пастью на кривом стебле */
    chomper: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var open = opts.busy ? 0.05 : 0.42 + 0.07 * Math.sin(time * 1.8);
      Draw.stalk(ctx, u * 0.08, u * 0.34, u * 0.20, u * 0.14, -u * 0.02, u * 0.06, 4.5 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, u * 0.08, u * 0.22, u * 0.20, u * 0.08, -0.2, '#5BA83F', '#2E6B1E', k);

      ctx.save();
      ctx.translate(-u * 0.02, u * 0.04);
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.6);

      // Нижняя челюсть
      Draw.smooth(ctx, [
        [-u * 0.28, -u * 0.02], [u * 0.26, u * 0.00],
        [u * 0.18, u * 0.20], [-u * 0.20, u * 0.18]
      ]);
      ctx.fill(); ctx.stroke();

      // Верхняя раскрывается
      ctx.save();
      ctx.rotate(-open);
      Draw.smooth(ctx, [
        [-u * 0.28, -u * 0.02], [u * 0.28, -u * 0.08],
        [u * 0.20, -u * 0.30], [-u * 0.20, -u * 0.26]
      ]);
      ctx.fill(); ctx.stroke();
      Draw.face(ctx, u, k, u * 0.085, -u * 0.20, u * 0.05, time, 12.9, L);
      ctx.restore();

      // Зубы
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = L;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      for (var i = 0; i < 3; i++) {
        var x = -u * 0.14 + i * u * 0.14;
        Draw.poly(ctx, [[x - u * 0.04, u * 0.00], [x + u * 0.04, u * 0.00], [x, u * 0.10]]);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    },

    /* Гриб-молния: голубая шляпка и шар разряда */
    tesla: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var pulse = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.fillStyle = '#F3E5C0'; Draw.ink(ctx, t, k, 2.4);
      Draw.smooth(ctx, [
        [-u * 0.11, u * 0.00], [u * 0.11, u * 0.00],
        [u * 0.15, u * 0.28], [-u * 0.15, u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = F;
      Draw.smooth(ctx, [
        [0, -u * 0.34], [u * 0.30, -u * 0.14], [u * 0.26, u * 0.02],
        [-u * 0.26, u * 0.02], [-u * 0.30, -u * 0.14]
      ]);
      ctx.fill(); ctx.stroke();

      // Шар над шляпкой
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.4 * pulse;
      ctx.fillStyle = '#FFFFFF';
      Draw.circle(ctx, 0, -u * 0.44, u * 0.10 + u * 0.02 * pulse);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1.2, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.09, -u * 0.52); ctx.lineTo(-u * 0.02, -u * 0.45); ctx.lineTo(-u * 0.07, -u * 0.38);
      ctx.stroke();

      Draw.face(ctx, u, k, u * 0.07, -u * 0.12, u * 0.048, time, 14.1, L);
    },

    /* Гарпунник: бутон с зазубренным наконечником */
    harpoon: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      Draw.stalk(ctx, 0, u * 0.34, u * 0.06, u * 0.16, 0, u * 0.04, 4 * k, '#2E6B1E', 1);
      Draw.leaf(ctx, -u * 0.04, u * 0.22, u * 0.20, u * 0.08, 3.4, '#5BA83F', '#2E6B1E', k);

      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.4);
      Draw.smooth(ctx, [
        [0, -u * 0.24], [u * 0.20, -u * 0.10], [u * 0.16, u * 0.10],
        [-u * 0.16, u * 0.10], [-u * 0.20, -u * 0.10]
      ]);
      ctx.fill(); ctx.stroke();

      // Наконечник
      ctx.fillStyle = '#CFD8DC';
      Draw.poly(ctx, [
        [0, -u * 0.50], [u * 0.11, -u * 0.28], [u * 0.04, -u * 0.31],
        [0, -u * 0.24], [-u * 0.04, -u * 0.31], [-u * 0.11, -u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      Draw.face(ctx, u, k, u * 0.075, -u * 0.06, u * 0.05, time, 15.3, L);
    },

    /* Зонтик-лист: широкий купол над головой */
    umbrella: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var tilt = Math.sin(time * 0.9) * 0.05;
      Draw.stalk(ctx, 0, u * 0.34, u * 0.05, u * 0.16, 0, u * 0.02, 4 * k, '#2E6B1E', 1);

      ctx.save();
      ctx.rotate(tilt);
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.6);
      Draw.smooth(ctx, [
        [0, -u * 0.44], [u * 0.28, -u * 0.26], [u * 0.38, -u * 0.02],
        [u * 0.13, -u * 0.09], [0, -u * 0.01], [-u * 0.13, -u * 0.09],
        [-u * 0.38, -u * 0.02], [-u * 0.28, -u * 0.26]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.40); ctx.quadraticCurveTo(-u * 0.15, -u * 0.22, -u * 0.22, -u * 0.06);
      ctx.moveTo(0, -u * 0.40); ctx.quadraticCurveTo(u * 0.15, -u * 0.22, u * 0.22, -u * 0.06);
      ctx.stroke();
      ctx.restore();
      ctx.restore();

      Draw.face(ctx, u, k, u * 0.075, u * 0.12, u * 0.05, time, 16.5, L);
    },

    /* Маятник: цветок с тяжёлым бутоном на подвесе */
    pendulum: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var sway = Math.sin(time * 2.2) * 0.5;

      ctx.strokeStyle = '#2E6B1E';
      ctx.lineWidth = Math.max(2, 3.4 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.26, u * 0.32);
      ctx.quadraticCurveTo(-u * 0.10, -u * 0.20, 0, -u * 0.32);
      ctx.quadraticCurveTo(u * 0.10, -u * 0.20, u * 0.26, u * 0.32);
      ctx.stroke();

      ctx.save();
      ctx.translate(0, -u * 0.30);
      ctx.rotate(sway);
      ctx.strokeStyle = '#2E6B1E';
      ctx.lineWidth = Math.max(1.4, 2 * k);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, u * 0.30);
      ctx.stroke();
      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.4);
      Draw.smooth(ctx, [
        [0, u * 0.24], [u * 0.15, u * 0.34], [u * 0.10, u * 0.52],
        [-u * 0.10, u * 0.52], [-u * 0.15, u * 0.34]
      ]);
      ctx.fill(); ctx.stroke();
      Draw.face(ctx, u, k, u * 0.055, u * 0.38, u * 0.042, time, 17.7, L);
      ctx.restore();
    },

    /* Сеть: растение-паутина между двумя побегами */
    net: function (ctx, u, k, t, opts, time) {
      var F = opts.hurt ? '#FFFFFF' : t.fill, L = t.color;
      var wob = Math.sin(time * 1.6) * u * 0.012;

      ctx.strokeStyle = '#2E6B1E';
      ctx.lineWidth = Math.max(2, 3.2 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.24, u * 0.32);
      ctx.quadraticCurveTo(-u * 0.32, -u * 0.04, -u * 0.22, -u * 0.30);
      ctx.moveTo(u * 0.24, u * 0.32);
      ctx.quadraticCurveTo(u * 0.32, -u * 0.04, u * 0.22, -u * 0.30);
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = F;
      ctx.lineWidth = Math.max(1.2, 1.8 * k);
      ctx.beginPath();
      for (var i = 0; i <= 4; i++) {
        var f = i / 4;
        var x = -u * 0.22 + f * u * 0.44;
        ctx.moveTo(x, -u * 0.28);
        ctx.lineTo(x, u * 0.10 + wob);
      }
      for (var j = 0; j < 4; j++) {
        var y = -u * 0.26 + j * u * 0.11;
        ctx.moveTo(-u * 0.23, y);
        ctx.quadraticCurveTo(0, y + u * 0.08 + wob, u * 0.23, y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = F; Draw.ink(ctx, t, k, 2.2);
      Draw.circle(ctx, 0, u * 0.20, u * 0.13);
      ctx.fill(); ctx.stroke();
      Draw.face(ctx, u, k, u * 0.055, u * 0.18, u * 0.042, time, 18.9, L);
    }
  }
};
