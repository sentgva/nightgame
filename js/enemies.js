/* enemies.js — враги: параметры, особенности, отрисовка.
   Враг почти сливается с фоном поля: его выдают силуэт и красные глаза.
   Как только враг станет ярче защитника — композиция сломается. */

/* speed — клеток в секунду, atkRate — ударов в секунду */
var ENEMY_TYPES = {
  walker: {
    id: 'walker', name: 'Бродяга',
    hp: 100, speed: 0.20, damage: 20, atkRate: 1.0,
    scale: 1.0, spark: 25, sparkChance: 0.6
  },
  runner: {
    id: 'runner', name: 'Бегун',
    hp: 60, speed: 0.38, damage: 12, atkRate: 1.4,
    scale: 0.8, eyeTight: true, spark: 20, sparkChance: 0.6
  },
  armored: {
    id: 'armored', name: 'Броненосец',
    hp: 400, armor: 200, speed: 0.15, damage: 30, atkRate: 0.8,
    scale: 1.1, spark: 40, sparkChance: 0.7
  },
  jumper: {
    id: 'jumper', name: 'Прыгун',
    hp: 120, speed: 0.23, damage: 20, atkRate: 1.0,
    jumps: 1, scale: 1.0, spark: 25, sparkChance: 0.6
  },
  spitter: {
    id: 'spitter', name: 'Плевун',
    hp: 150, speed: 0.15, damage: 12, atkRate: 0.8, rangedRange: 2,
    scale: 1.0, spark: 30, sparkChance: 0.6
  },
  phantom: {
    id: 'phantom', name: 'Фантом',
    hp: 140, speed: 0.22, damage: 18, atkRate: 1.0,
    phaseEvery: 3.5, phaseFor: 1.2,          // уходит в фазу и не ловит снаряды
    scale: 1.0, spark: 30, sparkChance: 0.6
  },
  burster: {
    id: 'burster', name: 'Пепельник',
    hp: 110, speed: 0.20, damage: 14, atkRate: 1.0,
    deathBlast: 80,                          // при смерти обжигает защитника под собой
    scale: 1.0, spark: 25, sparkChance: 0.6
  },
  swarm: {
    id: 'swarm', name: 'Рой',
    hp: 180, speed: 0.16, damage: 16, atkRate: 1.0,
    splitInto: 'runner', splitCount: 2,      // при смерти распадается надвое
    scale: 1.15, spark: 30, sparkChance: 0.6
  },
  healer: {
    id: 'healer', name: 'Лекарь',
    hp: 200, speed: 0.17, damage: 10, atkRate: 0.6,
    heal: 8, healRange: 2,                  // чинит соседей в своей колонке
    scale: 1.0, spark: 45, sparkChance: 0.7
  },
  carrier: {
    id: 'carrier', name: 'Носитель',
    hp: 260, speed: 0.13, damage: 16, atkRate: 0.8,
    spawnEvery: 6, spawnType: 'runner',      // на ходу высаживает бегунов
    scale: 1.2, spark: 40, sparkChance: 0.7
  },
  howler: {
    id: 'howler', name: 'Ревун',
    hp: 180, speed: 0.18, damage: 14, atkRate: 1.0,
    auraSpeed: 1.28, auraRange: 2,           // разгоняет соседей
    scale: 1.05, spark: 35, sparkChance: 0.6
  },
  shielder: {
    id: 'shielder', name: 'Щитоносец',
    hp: 220, speed: 0.14, damage: 18, atkRate: 0.8,
    auraGuard: 0.8, auraRange: 2,            // вдвое режет урон по соседям
    scale: 1.1, spark: 40, sparkChance: 0.7
  },
  devourer: {
    id: 'devourer', name: 'Пожиратель',
    hp: 200, speed: 0.20, damage: 25, atkRate: 1.2,
    devour: 1,                               // первого защитника съедает целиком
    scale: 1.05, spark: 35, sparkChance: 0.6
  },
  titan: {
    id: 'titan', name: 'Титан',
    hp: 3000, armor: 800, speed: 0.10, damage: 90, atkRate: 0.6,
    width: 2, scale: 1.5, boss: true, spark: 400, sparkChance: 1
  },
  boss: {
    id: 'boss', name: 'Колосс',
    hp: 1800, speed: 0.15, damage: 70, atkRate: 0.8,
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
      attacking: 0,               // подсветка момента удара
      phaseT: Math.random() * (t.phaseEvery || 1),
      spawnEveryT: t.spawnEvery || 0,
      devourLeft: t.devour || 0,
      rootT: 0,                   // пригвождён сетью: стоит, но бьётся
      hasted: false,              // подсветка ауры ревуна
      guarded: false,             // подсветка ауры щитоносца
      phased: false,              // в фазе снаряды проходят насквозь
      healT: 0,
      target: null,
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

  /* ======================================================================
     ОТРИСОВКА
     ====================================================================== */
  draw: function (ctx, enemy, cell, time) {
    var k = cell / 64;
    var x = Enemies.centerX(enemy, cell);
    var y = enemy.y;
    var sc = enemy.def.scale || 1;

    // Дуга прыжка — короткий подъём над полем
    if (enemy.jumpT > 0) y -= Math.sin(enemy.jumpT * Math.PI) * cell * 0.35;

    // Шаг: тело чуть покачивается и кренится
    var moving = enemy.jumpT > 0 || !enemy.attacking;
    var gait = Math.sin(time * 5.5 * (enemy.slowT > 0 ? 0.5 : 1) + enemy.wobble);
    var bob = moving ? gait * cell * 0.014 : 0;
    var lean = moving ? gait * 0.05 : 0;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(sc, sc);
    if (lean) ctx.rotate(lean);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (enemy.spawnT < 1) ctx.globalAlpha = enemy.spawnT;

    var shape = Enemies.shapes[enemy.type] || Enemies.shapes.walker;
    shape(ctx, cell, k, enemy, time, gait);

    // Сеть: враг пригвождён к месту
    if (enemy.rootT > 0) {
      ctx.save();
      ctx.globalAlpha *= 0.7;
      ctx.strokeStyle = '#84CC16';
      ctx.lineWidth = Math.max(1, 1.2 * k);
      var h = Enemies.bodySize(enemy, cell) * 0.5;
      ctx.beginPath();
      for (var q = -1; q <= 1; q++) {
        ctx.moveTo(q * h * 0.7, -h); ctx.lineTo(q * h * 0.7, h);
        ctx.moveTo(-h, q * h * 0.7); ctx.lineTo(h, q * h * 0.7);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Аура соседей: видно, кого прикрыли или разогнали
    if (enemy.guarded) {
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.strokeStyle = PAL.shield;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      Draw.circle(ctx, 0, 0, cell * 0.36);
      ctx.stroke();
      ctx.restore();
    }
    if (enemy.hasted) {
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.strokeStyle = PAL.aura;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(-cell * 0.30, -cell * 0.26); ctx.lineTo(-cell * 0.20, -cell * 0.34);
      ctx.moveTo(cell * 0.20, -cell * 0.34); ctx.lineTo(cell * 0.30, -cell * 0.26);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Полоска HP — ровно по ширине тела, только после первого урона
    if (enemy.damaged && !enemy.dead) {
      var w = Enemies.bodySize(enemy, cell) * (enemy.width > 1 ? 1.7 : 1);
      var barH = Math.max(3, 3.5 * k);
      var barY = y + Enemies.bodySize(enemy, cell) * 0.62;
      var total = enemy.maxHp + enemy.maxArmor;
      var left = enemy.hp + enemy.armor;
      Draw.bar(ctx, x - w / 2, barY, w, barH, left / total, PAL.gridLine, PAL.enemy);
    }
  },

  /* Корпус: яркая заливка с толстой тёмной обводкой */
  shell: function (ctx, e, k, drawPath, fill) {
    ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : (fill || PAL.zombieCloth);
    ctx.strokeStyle = e.slowT > 0 ? '#0277BD' : PAL.outline;
    ctx.lineWidth = Math.max(1.6, 2.4 * k);
    ctx.lineJoin = 'round';
    drawPath();
    ctx.fill();
    ctx.stroke();
  },

  /* Голова зомби: кожа, белые глаза с тёмными зрачками и кривая ухмылка */
  head: function (ctx, u, k, e, x, y, r, time, seed) {
    var skin = e.hurt > 0 ? '#FFFFFF' : PAL.zombieSkin;
    ctx.save();
    ctx.fillStyle = skin;
    ctx.strokeStyle = e.slowT > 0 ? '#0277BD' : PAL.outline;
    ctx.lineWidth = Math.max(1.6, 2.2 * k);
    Draw.smooth(ctx, [
      [x, y - r], [x + r * 0.95, y - r * 0.35], [x + r * 0.85, y + r * 0.6],
      [x - r * 0.1, y + r], [x - r * 0.9, y + r * 0.5], [x - r * 0.95, y - r * 0.4]
    ]);
    ctx.fill(); ctx.stroke();

    // Глаза: один прищурен — лицо выходит несимметричным
    var blink = Math.sin(time * 0.7 + (seed || 0)) > 0.96 ? 0.15 : 1;
    var er = r * 0.26;
    for (var i = -1; i <= 1; i += 2) {
      var ex = x + i * r * 0.36, ey = y - r * 0.14;
      ctx.fillStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1.2, 1.6 * k);
      ctx.beginPath();
      ctx.ellipse(ex, ey, er, er * (i < 0 ? blink : blink * 0.82), 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      if (blink > 0.5) {
        ctx.fillStyle = PAL.enemy;
        Draw.circle(ctx, ex + er * 0.12, ey + er * 0.1, er * 0.46);
        ctx.fill();
      }
    }

    // Рот с торчащим зубом
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = Math.max(1.2, 1.8 * k);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.34, y + r * 0.44);
    ctx.quadraticCurveTo(x, y + r * 0.62, x + r * 0.34, y + r * 0.40);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    Draw.poly(ctx, [
      [x + r * 0.06, y + r * 0.46], [x + r * 0.24, y + r * 0.42], [x + r * 0.15, y + r * 0.66]
    ]);
    ctx.fill();
    ctx.restore();
  },

  /* Руки вытянуты вперёд — визитная карточка зомби */
  arms: function (ctx, u, k, e, gait, y, reach) {
    var skin = e.hurt > 0 ? '#FFFFFF' : PAL.zombieSkin;
    ctx.save();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = Math.max(2.4, 4.2 * k);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-u * 0.20, y); ctx.lineTo(-u * 0.24, y + reach + gait * u * 0.03);
    ctx.moveTo(u * 0.20, y); ctx.lineTo(u * 0.24, y + reach - gait * u * 0.03);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = Math.max(1.4, 2.4 * k);
    ctx.stroke();
    ctx.restore();
  },

  /* Ноги в шаге */
  legs: function (ctx, u, k, e, gait, spread, top, len) {
    ctx.save();
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = Math.max(2.4, 4.4 * k);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-spread, top); ctx.lineTo(-spread + gait * u * 0.07, top + len);
    ctx.moveTo(spread, top); ctx.lineTo(spread - gait * u * 0.07, top + len);
    ctx.stroke();
    ctx.strokeStyle = e.hurt > 0 ? '#FFFFFF' : PAL.zombieClothD;
    ctx.lineWidth = Math.max(1.4, 2.6 * k);
    ctx.stroke();
    ctx.restore();
  },

  /* Прежние помощники остаются ради совместимости с механиками */
  eyes: function () {},
  mouth: function () {},

  shapes: {
    /* Бродяга: классический зомби в рваной рубахе */
    walker: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, e, gait, u * 0.11, u * 0.16, u * 0.22);
      Enemies.arms(ctx, u, k, e, gait, -u * 0.04, u * 0.30);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.16, -u * 0.14], [u * 0.16, -u * 0.14], [u * 0.24, u * 0.02],
          [u * 0.16, u * 0.20], [-u * 0.16, u * 0.20], [-u * 0.24, u * 0.02]
        ]);
      });
      // Прореха на рубахе
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.06, u * 0.00); ctx.lineTo(u * 0.02, u * 0.10); ctx.lineTo(-u * 0.02, u * 0.18);
      ctx.stroke();
      ctx.restore();
      Enemies.head(ctx, u, k, e, -u * 0.02, -u * 0.30, u * 0.19, time, 1);
    },

    /* Бегун: тощий, в наклоне, ноги в широком шаге */
    runner: function (ctx, u, k, e, time, gait) {
      ctx.rotate(0.24);
      Enemies.legs(ctx, u, k, e, gait * 1.7, u * 0.08, u * 0.14, u * 0.26);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.12, -u * 0.16], [u * 0.12, -u * 0.16], [u * 0.16, u * 0.02],
          [u * 0.10, u * 0.18], [-u * 0.10, u * 0.18], [-u * 0.16, u * 0.02]
        ]);
      }, '#7E57C2');
      // Руки отброшены назад
      ctx.save();
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(2, 3.6 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, -u * 0.08); ctx.lineTo(-u * 0.26, -u * 0.30);
      ctx.moveTo(u * 0.14, -u * 0.08); ctx.lineTo(u * 0.24, -u * 0.28);
      ctx.stroke();
      ctx.strokeStyle = e.hurt > 0 ? '#FFFFFF' : PAL.zombieSkin;
      ctx.lineWidth = Math.max(1.2, 2 * k);
      ctx.stroke();
      ctx.restore();
      Enemies.head(ctx, u, k, e, u * 0.02, -u * 0.32, u * 0.16, time, 2);
    },

    /* Броненосец: зомби в дорожном конусе */
    armored: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, e, gait * 0.7, u * 0.13, u * 0.18, u * 0.18);
      Enemies.arms(ctx, u, k, e, gait, -u * 0.02, u * 0.30);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.20, -u * 0.12], [u * 0.20, -u * 0.12], [u * 0.28, u * 0.04],
          [u * 0.18, u * 0.22], [-u * 0.18, u * 0.22], [-u * 0.28, u * 0.04]
        ]);
      });
      Enemies.head(ctx, u, k, e, 0, -u * 0.28, u * 0.19, time, 3);

      if (e.armor > 0) {
        ctx.save();
        ctx.fillStyle = '#FF7043';
        ctx.strokeStyle = PAL.outline;
        ctx.lineWidth = Math.max(1.6, 2.4 * k);
        Draw.poly(ctx, [[0, -u * 0.62], [u * 0.20, -u * 0.30], [-u * 0.20, -u * 0.30]]);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-u * 0.13, -u * 0.44, u * 0.26, u * 0.05);
        ctx.restore();
      }
    },

    /* Прыгун: зомби на пружинящих согнутых ногах */
    jumper: function (ctx, u, k, e, time, gait) {
      var crouch = e.jumpT > 0;
      ctx.save();
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(2.4, 4.6 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (crouch) {
        ctx.moveTo(-u * 0.12, u * 0.10); ctx.quadraticCurveTo(-u * 0.26, u * 0.16, -u * 0.16, u * 0.24);
        ctx.moveTo(u * 0.12, u * 0.10); ctx.quadraticCurveTo(u * 0.26, u * 0.16, u * 0.16, u * 0.24);
      } else {
        ctx.moveTo(-u * 0.12, u * 0.08); ctx.quadraticCurveTo(-u * 0.26, u * 0.22, -u * 0.14 + gait * u * 0.05, u * 0.34);
        ctx.moveTo(u * 0.12, u * 0.08); ctx.quadraticCurveTo(u * 0.26, u * 0.22, u * 0.14 - gait * u * 0.05, u * 0.34);
      }
      ctx.stroke();
      ctx.strokeStyle = e.hurt > 0 ? '#FFFFFF' : '#00897B';
      ctx.lineWidth = Math.max(1.4, 2.8 * k);
      ctx.stroke();
      ctx.restore();

      Enemies.arms(ctx, u, k, e, gait, -u * 0.08, u * 0.24);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.16, -u * 0.16], [u * 0.16, -u * 0.16], [u * 0.22, u * 0.00],
          [u * 0.14, u * 0.14], [-u * 0.14, u * 0.14], [-u * 0.22, u * 0.00]
        ]);
      }, '#26A69A');
      Enemies.head(ctx, u, k, e, 0, -u * 0.32, u * 0.17, time, 4);
    },

    /* Плевун: пузатый зомби с раздутой щекой */
    spitter: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, e, gait * 0.7, u * 0.12, u * 0.18, u * 0.18);
      Enemies.arms(ctx, u, k, e, gait, u * 0.00, u * 0.26);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.18, -u * 0.12], [u * 0.18, -u * 0.12], [u * 0.28, u * 0.06],
          [0, u * 0.24], [-u * 0.28, u * 0.06]
        ]);
      }, '#8D6E63');
      Enemies.head(ctx, u, k, e, -u * 0.02, -u * 0.30, u * 0.19, time, 5);

      // Раздутая щека
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : '#9CCC65';
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.4, 2 * k);
      Draw.circle(ctx, u * 0.18, -u * 0.24, u * 0.09 * (e.attacking > 0 ? 1.3 : 1));
      ctx.fill(); ctx.stroke();
      ctx.restore();
    },

    /* Фантом: полупрозрачный зомби без ног, снизу дымный хвост */
    phantom: function (ctx, u, k, e, time, gait) {
      if (e.phased) ctx.globalAlpha *= 0.3;
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.fillStyle = PAL.phase;
      Draw.smooth(ctx, [
        [-u * 0.15, u * 0.06], [u * 0.15, u * 0.06],
        [u * 0.07 + Math.sin(time * 2) * u * 0.05, u * 0.34],
        [-u * 0.07 + Math.sin(time * 2) * u * 0.05, u * 0.34]
      ]);
      ctx.fill();
      ctx.restore();

      Enemies.arms(ctx, u, k, e, gait, -u * 0.08, u * 0.22);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.17, -u * 0.16], [u * 0.17, -u * 0.16], [u * 0.22, u * 0.02],
          [0, u * 0.14], [-u * 0.22, u * 0.02]
        ]);
      }, '#78909C');
      Enemies.head(ctx, u, k, e, 0, -u * 0.32, u * 0.17, time, 6);

      if (e.phased) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = PAL.phase;
        ctx.lineWidth = Math.max(1.4, 2 * k);
        Draw.circle(ctx, 0, -u * 0.08, u * 0.34);
        ctx.stroke();
        ctx.restore();
      }
    },

    /* Пепельник: обугленный зомби, по телу бегут раскалённые трещины */
    burster: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, e, gait, u * 0.10, u * 0.18, u * 0.16);
      Enemies.arms(ctx, u, k, e, gait, -u * 0.04, u * 0.26);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.20], [u * 0.24, -u * 0.06], [u * 0.24, u * 0.10],
          [0, u * 0.24], [-u * 0.24, u * 0.10], [-u * 0.24, -u * 0.06]
        ]);
      }, '#5D4037');
      ctx.save();
      ctx.globalAlpha *= 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(time * 4 + e.wobble));
      ctx.strokeStyle = PAL.ash;
      ctx.lineWidth = Math.max(1.4, 2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.18, -u * 0.06);
      ctx.quadraticCurveTo(-u * 0.02, u * 0.02, -u * 0.08, u * 0.18);
      ctx.moveTo(u * 0.18, -u * 0.02);
      ctx.quadraticCurveTo(u * 0.04, u * 0.08, u * 0.10, u * 0.20);
      ctx.stroke();
      ctx.restore();
      Enemies.head(ctx, u, k, e, 0, -u * 0.34, u * 0.17, time, 7);
    },

    /* Рой: двухголовый зомби — при смерти и разваливается надвое */
    swarm: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, e, gait, u * 0.15, u * 0.16, u * 0.20);
      Enemies.arms(ctx, u, k, e, gait, -u * 0.02, u * 0.28);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.26, -u * 0.12], [u * 0.26, -u * 0.12], [u * 0.32, u * 0.04],
          [u * 0.18, u * 0.20], [-u * 0.18, u * 0.20], [-u * 0.32, u * 0.04]
        ]);
      }, '#6D4C41');
      Enemies.head(ctx, u, k, e, -u * 0.15, -u * 0.28, u * 0.15, time, 8);
      Enemies.head(ctx, u, k, e, u * 0.15, -u * 0.26, u * 0.15, time, 9);
    },

    /* Лекарь: зомби-знахарь в балахоне с посохом */
    healer: function (ctx, u, k, e, time, gait) {
      var pulse = 0.5 + 0.5 * Math.sin(time * 3 + e.wobble);
      ctx.save();
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(2, 3.4 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(u * 0.26, -u * 0.32); ctx.lineTo(u * 0.22, u * 0.30);
      ctx.stroke();
      ctx.strokeStyle = '#8D6E63';
      ctx.lineWidth = Math.max(1.4, 2 * k);
      ctx.stroke();
      ctx.fillStyle = PAL.heal;
      ctx.globalAlpha *= 0.5 + 0.5 * pulse;
      Draw.circle(ctx, u * 0.26, -u * 0.34, u * 0.07); ctx.fill();
      ctx.restore();

      Enemies.legs(ctx, u, k, e, gait * 0.6, u * 0.08, u * 0.20, u * 0.14);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.10, -u * 0.20], [u * 0.10, -u * 0.20], [u * 0.24, u * 0.14],
          [0, u * 0.26], [-u * 0.24, u * 0.14]
        ]);
      }, PAL.heal);
      Enemies.head(ctx, u, k, e, -u * 0.02, -u * 0.34, u * 0.16, time, 10);

      ctx.save();
      ctx.globalAlpha *= 0.25 + 0.3 * pulse;
      ctx.strokeStyle = PAL.heal;
      ctx.lineWidth = Math.max(1.4, 2 * k);
      ctx.beginPath();
      ctx.ellipse(-u * 0.02, -u * 0.52, u * 0.16, u * 0.05, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },

    /* Носитель: зомби с коконом-рюкзаком за спиной */
    carrier: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, e, gait * 0.6, u * 0.14, u * 0.18, u * 0.18);
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : '#795548';
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.6, 2.4 * k);
      Draw.smooth(ctx, [
        [0, -u * 0.40], [u * 0.24, -u * 0.26], [u * 0.20, u * 0.00],
        [-u * 0.20, u * 0.00], [-u * 0.24, -u * 0.26]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#AED581';
      for (var i = -1; i <= 1; i++) {
        Draw.circle(ctx, i * u * 0.10, -u * 0.20 + Math.sin(time * 3 + i) * u * 0.015, u * 0.04);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();

      Enemies.arms(ctx, u, k, e, gait, u * 0.02, u * 0.26);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.20, -u * 0.04], [u * 0.20, -u * 0.04], [u * 0.28, u * 0.08],
          [0, u * 0.24], [-u * 0.28, u * 0.08]
        ]);
      });
      Enemies.head(ctx, u, k, e, 0, -u * 0.16, u * 0.16, time, 11);
    },

    /* Ревун: зомби с рупором вместо головы */
    howler: function (ctx, u, k, e, time, gait) {
      var ring = (time * 0.8) % 1;
      ctx.save();
      ctx.globalAlpha *= 0.35 * (1 - ring);
      ctx.strokeStyle = PAL.aura;
      ctx.lineWidth = Math.max(1.6, 2.4 * k);
      Draw.circle(ctx, 0, -u * 0.10, u * 0.30 + ring * u * 0.34);
      ctx.stroke();
      ctx.restore();

      Enemies.legs(ctx, u, k, e, gait, u * 0.10, u * 0.16, u * 0.20);
      Enemies.arms(ctx, u, k, e, gait, -u * 0.02, u * 0.26);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.17, -u * 0.12], [u * 0.17, -u * 0.12], [u * 0.24, u * 0.02],
          [u * 0.14, u * 0.20], [-u * 0.14, u * 0.20], [-u * 0.24, u * 0.02]
        ]);
      }, '#FFB300');
      Enemies.head(ctx, u, k, e, 0, -u * 0.28, u * 0.16, time, 12);

      // Рупор
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : '#FFD54F';
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.6, 2.2 * k);
      Draw.smooth(ctx, [
        [-u * 0.07, -u * 0.38], [u * 0.07, -u * 0.38],
        [u * 0.26, -u * 0.60], [-u * 0.26, -u * 0.60]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    },

    /* Щитоносец: зомби тащит перед собой дверь */
    shielder: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, e, gait * 0.5, u * 0.12, u * 0.18, u * 0.16);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.17, -u * 0.12], [u * 0.17, -u * 0.12], [u * 0.22, u * 0.04],
          [u * 0.14, u * 0.18], [-u * 0.14, u * 0.18], [-u * 0.22, u * 0.04]
        ]);
      });
      Enemies.head(ctx, u, k, e, 0, -u * 0.30, u * 0.17, time, 13);

      // Дверь
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : '#8D6E63';
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.8, 2.6 * k);
      Draw.roundRect(ctx, -u * 0.32, -u * 0.06, u * 0.64, u * 0.38, u * 0.04);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha *= 0.4;
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, -u * 0.02); ctx.lineTo(-u * 0.20, u * 0.28);
      ctx.moveTo(u * 0.20, -u * 0.02); ctx.lineTo(u * 0.20, u * 0.28);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFD54F';
      Draw.circle(ctx, u * 0.24, u * 0.14, u * 0.035);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    },

    /* Пожиратель: зомби, у которого почти вся голова — челюсть */
    devourer: function (ctx, u, k, e, time, gait) {
      var bite = e.devourLeft > 0 ? 0.5 + 0.5 * Math.sin(time * 4 + e.wobble) : 0.2;
      Enemies.legs(ctx, u, k, e, gait, u * 0.11, u * 0.18, u * 0.18);
      Enemies.arms(ctx, u, k, e, gait, -u * 0.02, u * 0.28);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.18, -u * 0.10], [u * 0.18, -u * 0.10], [u * 0.26, u * 0.06],
          [0, u * 0.22], [-u * 0.26, u * 0.06]
        ]);
      }, '#4E342E');

      // Голова-пасть
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : PAL.zombieSkin;
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.8, 2.6 * k);
      Draw.smooth(ctx, [
        [0, -u * 0.50], [u * 0.26, -u * 0.36], [u * 0.24, -u * 0.12],
        [-u * 0.24, -u * 0.12], [-u * 0.26, -u * 0.36]
      ]);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = PAL.outline;
      Draw.smooth(ctx, [
        [-u * 0.20, -u * 0.26], [0, -u * 0.30], [u * 0.20, -u * 0.26],
        [u * 0.14, -u * 0.12], [-u * 0.14, -u * 0.12]
      ]);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      for (var i = 0; i < 4; i++) {
        var x = -u * 0.15 + i * u * 0.10;
        var h = u * (0.04 + 0.03 * bite);
        Draw.poly(ctx, [[x - u * 0.035, -u * 0.27], [x + u * 0.035, -u * 0.27], [x, -u * 0.27 + h]]);
        ctx.fill();
        Draw.poly(ctx, [[x - u * 0.035, -u * 0.13], [x + u * 0.035, -u * 0.13], [x, -u * 0.13 - h]]);
        ctx.fill();
      }
      // Глаза над пастью
      for (var j = -1; j <= 1; j += 2) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = PAL.outline;
        ctx.lineWidth = Math.max(1.2, 1.6 * k);
        Draw.circle(ctx, j * u * 0.12, -u * 0.40, u * 0.05);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = PAL.enemy;
        Draw.circle(ctx, j * u * 0.12, -u * 0.40, u * 0.022);
        ctx.fill();
      }
      ctx.restore();
    },

    /* Колосс: громила с бревном на плече */
    boss: function (ctx, u, k, e, time, gait) {
      ctx.save();
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(3, 7 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, u * 0.18); ctx.lineTo(-u * 0.24 + gait * u * 0.05, u * 0.40);
      ctx.moveTo(u * 0.20, u * 0.18); ctx.lineTo(u * 0.24 - gait * u * 0.05, u * 0.40);
      ctx.stroke();
      ctx.strokeStyle = e.hurt > 0 ? '#FFFFFF' : '#37474F';
      ctx.lineWidth = Math.max(2, 4.6 * k);
      ctx.stroke();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.26, -u * 0.30], [u * 0.26, -u * 0.30], [u * 0.46, -u * 0.06],
          [u * 0.34, u * 0.22], [-u * 0.34, u * 0.22], [-u * 0.46, -u * 0.06]
        ]);
      }, '#455A64');

      // Бревно на плече
      ctx.save();
      ctx.translate(-u * 0.30, -u * 0.34);
      ctx.rotate(-0.5);
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : '#8D6E63';
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.8, 2.8 * k);
      Draw.roundRect(ctx, -u * 0.09, -u * 0.34, u * 0.18, u * 0.62, u * 0.05);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      Enemies.head(ctx, u, k, e, u * 0.04, -u * 0.40, u * 0.20, time, 14);
      Enemies.arms(ctx, u, k, e, gait, u * 0.00, u * 0.34);
    },

    /* Титан: тот же громила, но закованный в железо */
    titan: function (ctx, u, k, e, time, gait) {
      ctx.save();
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(3, 7.4 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, u * 0.20); ctx.lineTo(-u * 0.26 + gait * u * 0.04, u * 0.42);
      ctx.moveTo(u * 0.20, u * 0.20); ctx.lineTo(u * 0.26 - gait * u * 0.04, u * 0.42);
      ctx.stroke();
      ctx.strokeStyle = e.hurt > 0 ? '#FFFFFF' : '#37474F';
      ctx.lineWidth = Math.max(2, 4.8 * k);
      ctx.stroke();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.26, -u * 0.30], [u * 0.26, -u * 0.30], [u * 0.44, -u * 0.04],
          [u * 0.32, u * 0.24], [-u * 0.32, u * 0.24], [-u * 0.44, -u * 0.04]
        ]);
      }, '#546E7A');

      // Наплечники
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : PAL.armorPlate;
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.8, 2.6 * k);
      Draw.smooth(ctx, [
        [-u * 0.52, -u * 0.26], [-u * 0.28, -u * 0.34], [-u * 0.26, -u * 0.04], [-u * 0.52, u * 0.00]
      ]);
      ctx.fill(); ctx.stroke();
      Draw.smooth(ctx, [
        [u * 0.52, -u * 0.26], [u * 0.28, -u * 0.34], [u * 0.26, -u * 0.04], [u * 0.52, u * 0.00]
      ]);
      ctx.fill(); ctx.stroke();

      if (e.armor > 0) {
        Draw.smooth(ctx, [
          [-u * 0.24, -u * 0.08], [u * 0.24, -u * 0.08], [u * 0.18, u * 0.20], [-u * 0.18, u * 0.20]
        ]);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();

      // Шлем с прорезью
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#FFFFFF' : PAL.armorPlateD;
      ctx.strokeStyle = PAL.outline;
      ctx.lineWidth = Math.max(1.8, 2.6 * k);
      Draw.smooth(ctx, [
        [0, -u * 0.58], [u * 0.22, -u * 0.44], [u * 0.18, -u * 0.24],
        [-u * 0.18, -u * 0.24], [-u * 0.22, -u * 0.44]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.outline;
      ctx.fillRect(-u * 0.16, -u * 0.40, u * 0.32, u * 0.07);
      ctx.fillStyle = PAL.enemy;
      Draw.circle(ctx, -u * 0.08, -u * 0.365, 2.2 * k); ctx.fill();
      Draw.circle(ctx, u * 0.08, -u * 0.365, 2.2 * k); ctx.fill();
      ctx.restore();

      Enemies.arms(ctx, u, k, e, gait, u * 0.02, u * 0.32);
    }
  }
};
