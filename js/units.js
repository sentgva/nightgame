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
  /* Свечение без blur: просто фигура большего размера с малой альфой */
  glowRect: function (ctx, x, y, w, h, r, color, alpha, spread) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = spread;
    Draw.roundRect(ctx, x - spread / 2, y - spread / 2, w + spread, h + spread, r + spread / 2);
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
    id: 'beacon', name: 'маяк', cost: 50, hp: 100, cooldown: 5,
    color: PAL.spark, fill: PAL.fillSpark,
    produce: 25, interval: 8,
    upgradeKey: 'produce',
    role: 'производит 25 искр каждые 8 сек'
  },
  shooter: {
    id: 'shooter', name: 'стрелок', cost: 100, hp: 120, cooldown: 5,
    color: PAL.ally, fill: PAL.fillAlly,
    damage: 20, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage',
    role: '20 урона, выстрел в секунду'
  },
  barrier: {
    id: 'barrier', name: 'барьер', cost: 50, hp: 600, cooldown: 12,
    color: PAL.textMuted, fill: PAL.fillNeutral,
    upgradeKey: 'hp',
    role: 'не атакует, держит удар'
  },
  freezer: {
    id: 'freezer', name: 'морозильник', cost: 175, hp: 100, cooldown: 8,
    color: PAL.ice, fill: PAL.fillIce,
    damage: 10, fireRate: 1.0, range: 7, slow: 0.4, slowTime: 3, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'замедляет врага на 40%'
  },
  shotgun: {
    id: 'shotgun', name: 'дробовик', cost: 200, hp: 150, cooldown: 8,
    color: PAL.ally, fill: PAL.fillAlly,
    damage: 60, fireRate: 1 / 1.5, range: 2, spread: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: '60 урона на две клетки'
  },
  mine: {
    id: 'mine', name: 'мина', cost: 25, hp: 1, cooldown: 12,
    color: PAL.danger, fill: PAL.fillNeutral,
    damage: 300, radius: 1.5, oneShot: true,
    upgradeKey: 'damage',
    role: 'взрывается при контакте'
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

  /* ---------- Отрисовка ----------
     x, y — центр клетки; cell — сторона клетки. */
  draw: function (ctx, x, y, cell, typeId, opts) {
    opts = opts || {};
    var t = UNIT_TYPES[typeId];
    var k = cell / 64;                 // масштаб «спецификационных» пикселей
    var scale = opts.scale === undefined ? 1 : opts.scale;

    var w = cell * 0.6, h = cell * 0.6, r = cell * 0.14;
    if (typeId === 'barrier') { w = cell * 0.72; h = cell * 0.44; r = cell * 0.10; }
    if (typeId === 'mine') { w = cell * 0.3; h = cell * 0.3; r = cell * 0.15; }
    w *= scale; h *= scale; r *= scale;

    var bx = x - w / 2, by = y - h / 2;

    // Улучшенный юнит — акцентное свечение по контуру
    if (opts.level > 1) Draw.glowRect(ctx, bx, by, w, h, r, t.color, 0.22, 4 * k);

    ctx.save();
    ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
    Draw.roundRect(ctx, bx, by, w, h, r);
    ctx.fill();
    ctx.lineWidth = Math.max(1, k);
    ctx.strokeStyle = t.color;
    ctx.stroke();

    ctx.fillStyle = t.color;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = Math.max(1, 1.2 * k) * scale;

    // Символ внутри — показывает функцию юнита
    if (typeId === 'beacon') {
      Draw.circle(ctx, x, y, cell * 0.13 * scale); ctx.stroke();
      Draw.circle(ctx, x, y, cell * 0.045 * scale); ctx.fill();
    } else if (typeId === 'shooter') {
      Draw.circle(ctx, x, y, cell * 0.10 * scale); ctx.fill();
    } else if (typeId === 'barrier') {
      var bw = w * 0.52;
      for (var i = -1; i <= 1; i++) {
        ctx.fillRect(x - bw / 2, y + i * cell * 0.085 * scale - 0.5 * k, bw, Math.max(1, 1.5 * k));
      }
    } else if (typeId === 'freezer') {
      var d = cell * 0.12 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y - d); ctx.lineTo(x + d, y); ctx.lineTo(x, y + d); ctx.lineTo(x - d, y);
      ctx.closePath(); ctx.stroke();
    } else if (typeId === 'shotgun') {
      var s = cell * 0.12 * scale;
      ctx.beginPath();
      ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8);
      ctx.closePath(); ctx.fill();
    } else if (typeId === 'mine') {
      Draw.circle(ctx, x, y, cell * 0.06 * scale); ctx.fill();
    }
    ctx.restore();

    // Вспышка выстрела — 6px круг, гаснет за 80мс
    if (opts.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, opts.flash);
      ctx.fillStyle = t.color;
      Draw.circle(ctx, x, y - h / 2, 3 * k);
      ctx.fill();
      ctx.restore();
    }

    // Полоска здоровья появляется только после урона
    if (opts.hp !== undefined && opts.maxHp && opts.hp < opts.maxHp) {
      var barW = w, barH = Math.max(2, 3 * k);
      var byy = y + h / 2 + 3 * k;
      ctx.fillStyle = PAL.gridLine;
      ctx.fillRect(x - barW / 2, byy, barW, barH);
      ctx.fillStyle = t.color;
      ctx.fillRect(x - barW / 2, byy, barW * Math.max(0, opts.hp / opts.maxHp), barH);
    }
  }
};
