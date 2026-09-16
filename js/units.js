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
    produce: 25, interval: 8,
    upgradeKey: 'produce',
    role: 'Производит искры'
  },
  shooter: {
    id: 'shooter', name: 'Стрелок', cost: 100, hp: 120, cooldown: 5,
    color: PAL.ally, fill: PAL.fillAlly,
    damage: 20, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage',
    role: '20 урона, выстрел в секунду'
  },
  barrier: {
    id: 'barrier', name: 'Барьер', cost: 50, hp: 600, cooldown: 12,
    color: PAL.textMuted, fill: PAL.fillNeutral,
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
    color: PAL.ally, fill: PAL.fillAlly,
    damage: 60, fireRate: 1 / 1.5, range: 2, spread: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: '60 урона на две клетки'
  },
  mine: {
    id: 'mine', name: 'Мина', cost: 25, hp: 1, cooldown: 12,
    color: PAL.danger, fill: PAL.fillNeutral,
    damage: 300, radius: 1.5, oneShot: true,
    upgradeKey: 'damage',
    role: 'Взрывается при контакте'
  }
};

/* Порядок карточек в нижней панели */
var UNIT_ORDER = ['beacon', 'shooter', 'barrier', 'freezer', 'shotgun', 'mine'];

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
      dead: false
    };
  },

  /* Параметр с учётом улучшения (+50% к основному) */
  stat: function (unit, key) {
    var base = unit.def[key];
    if (base === undefined) return undefined;
    if (unit.level > 1 && unit.def.upgradeKey === key) return base * 1.5;
    return base;
  },

  canUpgrade: function (unit) { return unit.level < 2; },
  upgradeCost: function (unit) { return unit.def.cost * 2; },
  sellPrice: function (unit) {
    var paid = unit.def.cost + (unit.level > 1 ? Units.upgradeCost(unit) : 0);
    return Math.floor(paid * CONFIG.sellRefund);
  },

  upgrade: function (unit) {
    unit.level = 2;
    if (unit.def.upgradeKey === 'hp') {
      unit.maxHp = unit.def.hp * 1.5;
      unit.hp = unit.maxHp;
    }
    unit.spawnT = 0;
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

    var shape = Units.shapes[typeId];
    shape(ctx, cell, k, t, opts, time);

    // Улучшенный юнит: акцентная метка-шеврон над корпусом
    if (opts.level > 1) {
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath();
      ctx.moveTo(-cell * 0.07, -cell * 0.335);
      ctx.lineTo(0, -cell * 0.385);
      ctx.lineTo(cell * 0.07, -cell * 0.335);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

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

    // Полоска здоровья появляется только после урона
    if (opts.hp !== undefined && opts.maxHp && opts.hp < opts.maxHp) {
      var barW = cell * 0.5, barH = Math.max(2, 3 * k);
      var by = y + cell * 0.33;
      ctx.fillStyle = PAL.gridLine;
      ctx.fillRect(x - barW / 2, by, barW, barH);
      ctx.fillStyle = t.color;
      ctx.fillRect(x - barW / 2, by, barW * Math.max(0, opts.hp / opts.maxHp), barH);
    }
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
