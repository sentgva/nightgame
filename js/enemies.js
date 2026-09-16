/* enemies.js — враги: параметры, особенности, отрисовка.
   Враг почти сливается с фоном поля: его выдают два красных глаза.
   Как только враг станет ярче защитника — композиция сломается. */

/* speed — клеток в секунду, atkRate — ударов в секунду */
var ENEMY_TYPES = {
  walker: {
    id: 'walker', name: 'бродяга',
    hp: 100, speed: 0.18, damage: 20, atkRate: 1.0,
    scale: 1.0, spark: 25, sparkChance: 0.6
  },
  runner: {
    id: 'runner', name: 'бегун',
    hp: 60, speed: 0.38, damage: 12, atkRate: 1.4,
    scale: 0.8, eyeTight: true, spark: 20, sparkChance: 0.6
  },
  armored: {
    id: 'armored', name: 'броненосец',
    hp: 400, armor: 200, speed: 0.11, damage: 30, atkRate: 0.8,
    scale: 1.1, spark: 40, sparkChance: 0.7
  },
  jumper: {
    id: 'jumper', name: 'прыгун',
    hp: 120, speed: 0.23, damage: 20, atkRate: 1.0,
    jumps: 1, scale: 1.0, spark: 25, sparkChance: 0.6
  },
  spitter: {
    id: 'spitter', name: 'плевун',
    hp: 150, speed: 0.15, damage: 12, atkRate: 0.8, rangedRange: 2,
    scale: 1.0, spark: 30, sparkChance: 0.6
  },
  boss: {
    id: 'boss', name: 'колосс',
    hp: 3000, speed: 0.08, damage: 60, atkRate: 0.7,
    width: 2, scale: 1.5, boss: true, spark: 300, sparkChance: 1
  }
};

var Enemies = {
  /* Создание врага. opts.hpMul — множитель HP для усиленных волн. */
  create: function (typeId, col, opts) {
    var t = ENEMY_TYPES[typeId];
    opts = opts || {};
    var mul = opts.hpMul || 1;
    return {
      type: typeId,
      def: t,
      col: col,
      width: t.width || 1,
      y: 0,                       // центр тела в координатах поля
      hp: t.hp * mul,
      maxHp: t.hp * mul,
      armor: (t.armor || 0) * mul,
      maxArmor: (t.armor || 0) * mul,
      speed: t.speed,
      slowT: 0,                   // остаток заморозки
      atkCd: 0,
      target: null,               // атакуемый защитник
      jumpsLeft: t.jumps || 0,
      jumpT: 0,                   // прогресс прыжка 0..1
      jumpFrom: 0, jumpTo: 0,
      spawnT: 0,                  // fade in при появлении
      hurt: 0,                    // мигание белым
      damaged: false,             // полоска HP появляется только после урона
      dead: false,
      wobble: Math.random() * Math.PI * 2
    };
  },

  /* Урон с учётом брони: первые N единиц поглощает пластина */
  hurt: function (enemy, amount) {
    enemy.damaged = true;
    enemy.hurt = 0.06;
    if (enemy.armor > 0) {
      var absorbed = Math.min(enemy.armor, amount);
      enemy.armor -= absorbed;
      amount -= absorbed;
    }
    if (amount > 0) enemy.hp -= amount;
    if (enemy.hp <= 0) enemy.dead = true;
    return enemy.dead;
  },

  /* Центр врага по X в координатах поля (босс занимает две колонки) */
  centerX: function (enemy, cell) {
    return (enemy.col + enemy.width / 2) * cell;
  },

  bodySize: function (enemy, cell) {
    return cell * 0.6 * (enemy.def.scale || 1);
  },

  /* ---------- Отрисовка ---------- */
  draw: function (ctx, enemy, cell, time) {
    var k = cell / 64;
    var x = Enemies.centerX(enemy, cell);
    var size = Enemies.bodySize(enemy, cell);
    var w = size * (enemy.width > 1 ? 1.6 : 1);
    var h = size;
    var y = enemy.y;

    // Дуга прыжка — короткий подъём над полем
    if (enemy.jumpT > 0) y -= Math.sin(enemy.jumpT * Math.PI) * cell * 0.35;

    ctx.save();
    if (enemy.spawnT < 1) ctx.globalAlpha = enemy.spawnT;

    var bx = x - w / 2, by = y - h / 2, r = cell * 0.13;

    // Голубая обводка, пока враг заморожен
    if (enemy.slowT > 0) Draw.glowRect(ctx, bx, by, w, h, r, PAL.ice, 0.5, 2 * k);

    ctx.fillStyle = enemy.hurt > 0 ? '#D8DEE6' : (enemy.armor > 0 ? PAL.fillArmor : PAL.fillEnemy);
    Draw.roundRect(ctx, bx, by, w, h, r);
    ctx.fill();
    ctx.lineWidth = Math.max(1, k);
    ctx.strokeStyle = enemy.slowT > 0 ? PAL.ice : PAL.gridLine;
    ctx.stroke();

    // Пластина брони поверх верхней половины тела
    if (enemy.armor > 0) {
      ctx.fillStyle = '#39434F';
      ctx.globalAlpha = (enemy.spawnT < 1 ? enemy.spawnT : 1) * 0.85;
      Draw.roundRect(ctx, bx + w * 0.08, by + h * 0.10, w * 0.84, h * 0.34, r * 0.5);
      ctx.fill();
      ctx.globalAlpha = enemy.spawnT < 1 ? enemy.spawnT : 1;
    }

    // Глаза — главный опознавательный признак
    var eyeR = 1.3 * k * (enemy.def.scale || 1);
    var gap = w * (enemy.def.eyeTight ? 0.20 : 0.26);
    var eyeY = y - h * 0.08;
    ctx.fillStyle = PAL.enemy;
    if (enemy.def.boss) {
      // У босса четыре глаза
      Draw.circle(ctx, x - gap * 1.35, eyeY, eyeR * 1.3); ctx.fill();
      Draw.circle(ctx, x - gap * 0.45, eyeY, eyeR * 1.3); ctx.fill();
      Draw.circle(ctx, x + gap * 0.45, eyeY, eyeR * 1.3); ctx.fill();
      Draw.circle(ctx, x + gap * 1.35, eyeY, eyeR * 1.3); ctx.fill();
    } else {
      Draw.circle(ctx, x - gap, eyeY, eyeR); ctx.fill();
      Draw.circle(ctx, x + gap, eyeY, eyeR); ctx.fill();
    }

    // Рот — тонкая полоса под глазами
    ctx.globalAlpha = (enemy.spawnT < 1 ? enemy.spawnT : 1) * 0.5;
    ctx.fillStyle = PAL.enemy;
    ctx.fillRect(x - w * 0.18, y + h * 0.20, w * 0.36, Math.max(1, k));
    ctx.globalAlpha = enemy.spawnT < 1 ? enemy.spawnT : 1;

    ctx.restore();

    // Полоска HP — ровно по ширине тела, только после первого урона
    if (enemy.damaged && !enemy.dead) {
      var barH = Math.max(2, 3 * k);
      var barY = y + h / 2 + 3 * k;
      var total = enemy.maxHp + enemy.maxArmor;
      var left = enemy.hp + enemy.armor;
      ctx.fillStyle = PAL.gridLine;
      ctx.fillRect(x - w / 2, barY, w, barH);
      ctx.fillStyle = PAL.enemy;
      ctx.fillRect(x - w / 2, barY, w * Math.max(0, left / total), barH);
    }
  },

  /* Иконка врага для обучающего оверлея и меню — не используется в поле */
  drawIcon: function (ctx, x, y, cell, typeId) {
    var fake = Enemies.create(typeId, 0, {});
    fake.y = y; fake.col = 0; fake.spawnT = 1;
    var savedCenter = Enemies.centerX;
    Enemies.centerX = function () { return x; };
    Enemies.draw(ctx, fake, cell, 0);
    Enemies.centerX = savedCenter;
  }
};
