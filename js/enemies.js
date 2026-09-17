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

  /* Корпус врага: тёмная заливка, обводка цветом линий сетки или льда */
  shell: function (ctx, e, k, drawPath) {
    ctx.fillStyle = e.hurt > 0 ? '#D8DEE6' : (e.armor > 0 ? PAL.fillArmor : PAL.fillEnemy);
    ctx.strokeStyle = e.slowT > 0 ? PAL.ice : PAL.gridLine;
    ctx.lineWidth = Math.max(1, k);
    drawPath();
    ctx.fill();
    ctx.stroke();
  },

  /* Пара глаз — главный опознавательный признак */
  eyes: function (ctx, u, k, e, gapFactor, ey, r) {
    ctx.fillStyle = PAL.enemy;
    var g = u * gapFactor;
    Draw.circle(ctx, -g, ey, r); ctx.fill();
    Draw.circle(ctx, g, ey, r); ctx.fill();
  },

  /* Ноги в шаге: одна вперёд, другая назад. Без них враг не идёт, а едет. */
  legs: function (ctx, u, k, gait, spread, top, len) {
    ctx.save();
    ctx.strokeStyle = PAL.gridLine;
    ctx.lineWidth = Math.max(1, 2.2 * k);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-spread, top);
    ctx.lineTo(-spread + gait * u * 0.07, top + len);
    ctx.moveTo(spread, top);
    ctx.lineTo(spread - gait * u * 0.07, top + len);
    ctx.stroke();
    ctx.restore();
  },

  /* Рука, тянущаяся вперёд — главный жест ходячего */
  arm: function (ctx, u, k, gait, x, y, reach, curve) {
    ctx.save();
    ctx.strokeStyle = PAL.gridLine;
    ctx.lineWidth = Math.max(1, 2 * k);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + curve, y + reach * 0.5, x + curve * 0.4, y + reach + gait * u * 0.04);
    ctx.stroke();
    ctx.restore();
  },

  mouth: function (ctx, u, k, w, my) {
    ctx.save();
    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = PAL.enemy;
    ctx.fillRect(-w / 2, my, w, Math.max(1, k));
    ctx.restore();
  },

  shapes: {
    /* Бродяга: сутулый, голова набок, одна рука тянется вперёд */
    walker: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, gait, u * 0.10, u * 0.14, u * 0.22);
      Enemies.arm(ctx, u, k, gait, -u * 0.20, -u * 0.04, u * 0.26, -u * 0.12);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.10, -u * 0.30], [u * 0.16, -u * 0.24], [u * 0.24, -u * 0.02],
          [u * 0.16, u * 0.18], [-u * 0.14, u * 0.20], [-u * 0.24, -u * 0.04]
        ]);
      });

      // Голова наклонена — плечи не симметричны, силуэт живой
      ctx.save();
      ctx.translate(-u * 0.03, -u * 0.26);
      ctx.rotate(-0.18);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.16], [u * 0.15, -u * 0.06], [u * 0.12, u * 0.09],
          [-u * 0.10, u * 0.10], [-u * 0.15, -u * 0.05]
        ]);
      });
      Enemies.eyes(ctx, u, k, e, 0.065, -u * 0.02, 1.4 * k);
      ctx.restore();

      Enemies.mouth(ctx, u, k, u * 0.13, -u * 0.16);
    },

    /* Бегун: тощий, завален вперёд, ноги в длинном шаге */
    runner: function (ctx, u, k, e, time, gait) {
      ctx.rotate(0.22);
      Enemies.legs(ctx, u, k, gait * 1.6, u * 0.07, u * 0.16, u * 0.26);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.30], [u * 0.14, -u * 0.18], [u * 0.12, u * 0.14],
          [-u * 0.11, u * 0.16], [-u * 0.15, -u * 0.16]
        ]);
      });

      // Руки отброшены назад
      ctx.save();
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 1.8 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.12, -u * 0.10);
      ctx.quadraticCurveTo(-u * 0.24, -u * 0.22, -u * 0.20, -u * 0.34);
      ctx.moveTo(u * 0.12, -u * 0.08);
      ctx.quadraticCurveTo(u * 0.24, -u * 0.20, u * 0.18, -u * 0.32);
      ctx.stroke();
      ctx.restore();

      // Голова вытянута вперёд
      ctx.save();
      ctx.translate(u * 0.02, -u * 0.34);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.12], [u * 0.12, -u * 0.02], [u * 0.08, u * 0.09],
          [-u * 0.08, u * 0.09], [-u * 0.12, -u * 0.02]
        ]);
      });
      Enemies.eyes(ctx, u, k, e, 0.05, u * 0.00, 1.3 * k);
      ctx.restore();
    },

    /* Броненосец: грузное тело и конус на голове */
    armored: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, gait * 0.6, u * 0.13, u * 0.18, u * 0.18);
      Enemies.arm(ctx, u, k, gait, -u * 0.26, -u * 0.02, u * 0.24, -u * 0.10);
      Enemies.arm(ctx, u, k, -gait, u * 0.26, -u * 0.02, u * 0.24, u * 0.10);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.06, -u * 0.26], [u * 0.24, -u * 0.18], [u * 0.30, u * 0.04],
          [u * 0.18, u * 0.22], [-u * 0.18, u * 0.22], [-u * 0.30, u * 0.02],
          [-u * 0.26, -u * 0.16]
        ]);
      });

      Enemies.eyes(ctx, u, k, e, 0.085, -u * 0.06, 1.5 * k);
      Enemies.mouth(ctx, u, k, u * 0.20, u * 0.08);

      if (e.armor > 0) {
        // Конус: пока цел — глаза прячутся под кромкой
        ctx.save();
        ctx.fillStyle = '#39434F';
        ctx.strokeStyle = '#5A6573';
        ctx.lineWidth = Math.max(1, k);
        Draw.poly(ctx, [
          [-u * 0.02, -u * 0.52], [u * 0.22, -u * 0.14], [-u * 0.26, -u * 0.14]
        ]);
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha *= 0.5;
        ctx.beginPath();
        ctx.moveTo(-u * 0.16, -u * 0.26); ctx.lineTo(u * 0.12, -u * 0.26);
        ctx.stroke();
        ctx.restore();
      }
    },

    /* Прыгун: поджатая туша на мощных согнутых ногах */
    jumper: function (ctx, u, k, e, time, gait) {
      var crouch = e.jumpT > 0;

      // Ноги-пружины
      ctx.save();
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 2.6 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (crouch) {
        ctx.moveTo(-u * 0.12, u * 0.10);
        ctx.quadraticCurveTo(-u * 0.24, u * 0.16, -u * 0.16, u * 0.22);
        ctx.moveTo(u * 0.12, u * 0.10);
        ctx.quadraticCurveTo(u * 0.24, u * 0.16, u * 0.16, u * 0.22);
      } else {
        ctx.moveTo(-u * 0.12, u * 0.08);
        ctx.quadraticCurveTo(-u * 0.26, u * 0.20, -u * 0.14 + gait * u * 0.05, u * 0.34);
        ctx.moveTo(u * 0.12, u * 0.08);
        ctx.quadraticCurveTo(u * 0.26, u * 0.20, u * 0.14 - gait * u * 0.05, u * 0.34);
      }
      ctx.stroke();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.30], [u * 0.22, -u * 0.14], [u * 0.18, u * 0.10],
          [-u * 0.18, u * 0.12], [-u * 0.22, -u * 0.12]
        ]);
      });

      // Гребень
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.strokeStyle = PAL.enemy;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.05, -u * 0.30);
      ctx.quadraticCurveTo(0, -u * 0.44, u * 0.06, -u * 0.32);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.085, -u * 0.12, 1.4 * k);
      Enemies.mouth(ctx, u, k, u * 0.15, u * 0.00);
    },

    /* Плевун: раздутое брюхо и длинное отвисшее рыло */
    spitter: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, gait * 0.7, u * 0.11, u * 0.16, u * 0.18);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.04, -u * 0.26], [u * 0.20, -u * 0.12], [u * 0.26, u * 0.10],
          [0, u * 0.22], [-u * 0.26, u * 0.08], [-u * 0.22, -u * 0.12]
        ]);
      });

      // Рыло свисает вперёд
      ctx.save();
      ctx.translate(u * 0.02, u * 0.06);
      ctx.rotate(0.25);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.07, 0], [u * 0.07, 0], [u * 0.05, u * 0.22], [-u * 0.05, u * 0.22]
        ]);
      });
      if (e.attacking > 0) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, e.attacking);
        ctx.fillStyle = PAL.enemy;
        Draw.circle(ctx, 0, u * 0.24, u * 0.055);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.10, -u * 0.14, 1.4 * k);
    },

    /* Фантом: плечи есть, ног нет — снизу дымный хвост */
    phantom: function (ctx, u, k, e, time, gait) {
      if (e.phased) ctx.globalAlpha *= 0.26;

      // Хвост
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = PAL.fillEnemy;
      Draw.smooth(ctx, [
        [-u * 0.14, u * 0.06], [u * 0.14, u * 0.06],
        [u * 0.06 + Math.sin(time * 2) * u * 0.05, u * 0.34],
        [-u * 0.06 + Math.sin(time * 2) * u * 0.05, u * 0.34]
      ]);
      ctx.fill();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.32], [u * 0.24, -u * 0.12], [u * 0.16, u * 0.10],
          [-u * 0.16, u * 0.10], [-u * 0.24, -u * 0.12]
        ]);
      });

      // Руки-лохмотья
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.strokeStyle = PAL.phase;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.22, -u * 0.06);
      ctx.quadraticCurveTo(-u * 0.32, u * 0.06, -u * 0.26, u * 0.18);
      ctx.moveTo(u * 0.22, -u * 0.06);
      ctx.quadraticCurveTo(u * 0.32, u * 0.06, u * 0.26, u * 0.18);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.075, -u * 0.14, 1.4 * k);

      if (e.phased) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = PAL.phase;
        ctx.lineWidth = Math.max(1, 1.3 * k);
        Draw.circle(ctx, 0, -u * 0.06, u * 0.30);
        ctx.stroke();
        ctx.restore();
      }
    },

    /* Пепельник: круглая растрескавшаяся туша, швы дышат жаром */
    burster: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, gait, u * 0.09, u * 0.18, u * 0.16);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.30], [u * 0.24, -u * 0.16], [u * 0.26, u * 0.08],
          [u * 0.04, u * 0.22], [-u * 0.24, u * 0.10], [-u * 0.26, -u * 0.14]
        ]);
      });

      ctx.save();
      ctx.globalAlpha *= 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(time * 4 + e.wobble));
      ctx.strokeStyle = PAL.ash;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, -u * 0.08);
      ctx.quadraticCurveTo(-u * 0.04, u * 0.00, -u * 0.10, u * 0.18);
      ctx.moveTo(u * 0.20, -u * 0.04);
      ctx.quadraticCurveTo(u * 0.06, u * 0.06, u * 0.12, u * 0.18);
      ctx.moveTo(-u * 0.06, -u * 0.26); ctx.lineTo(u * 0.02, -u * 0.12);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.09, -u * 0.14, 1.4 * k);
    },

    /* Рой: два сросшихся кома на частоколе мелких ног */
    swarm: function (ctx, u, k, e, time, gait) {
      ctx.save();
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (var i = -2; i <= 2; i++) {
        var x = i * u * 0.10;
        ctx.moveTo(x, u * 0.16);
        ctx.lineTo(x + gait * u * 0.04 * (i % 2 ? 1 : -1), u * 0.30);
      }
      ctx.stroke();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.14, -u * 0.26], [u * 0.14, -u * 0.26], [u * 0.30, -u * 0.06],
          [u * 0.18, u * 0.18], [-u * 0.18, u * 0.18], [-u * 0.30, -u * 0.06]
        ]);
      });

      // Два ядра просвечивают
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.strokeStyle = PAL.enemy;
      ctx.lineWidth = Math.max(1, k);
      Draw.circle(ctx, -u * 0.12, -u * 0.02, u * 0.13); ctx.stroke();
      Draw.circle(ctx, u * 0.12, -u * 0.02, u * 0.13); ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.12, -u * 0.08, 1.3 * k);
    },

    /* Лекарь: высокий, в балахоне, с посохом и нимбом */
    healer: function (ctx, u, k, e, time, gait) {
      var pulse = 0.5 + 0.5 * Math.sin(time * 3 + e.wobble);

      // Посох
      ctx.save();
      ctx.globalAlpha *= 0.7;
      ctx.strokeStyle = PAL.heal;
      ctx.lineWidth = Math.max(1, 1.8 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(u * 0.26, -u * 0.30); ctx.lineTo(u * 0.22, u * 0.30);
      ctx.stroke();
      ctx.fillStyle = PAL.heal;
      ctx.globalAlpha *= 0.4 + 0.5 * pulse;
      Draw.circle(ctx, u * 0.26, -u * 0.32, u * 0.05); ctx.fill();
      ctx.restore();

      // Нимб
      ctx.save();
      ctx.globalAlpha *= 0.22 + 0.28 * pulse;
      ctx.strokeStyle = PAL.heal;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.ellipse(-u * 0.04, -u * 0.40, u * 0.15, u * 0.05, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Балахон книзу расширяется
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.04, -u * 0.32], [u * 0.14, -u * 0.20], [u * 0.22, u * 0.18],
          [0, u * 0.28], [-u * 0.22, u * 0.18], [-u * 0.14, -u * 0.20]
        ]);
      });

      ctx.save();
      ctx.globalAlpha *= 0.6;
      ctx.strokeStyle = PAL.heal;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.04, u * 0.00); ctx.lineTo(-u * 0.04, u * 0.16);
      ctx.moveTo(-u * 0.12, u * 0.08); ctx.lineTo(u * 0.04, u * 0.08);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.06, -u * 0.22, 1.3 * k);
    },

    /* Носитель: горбатая туша с коконом на спине */
    carrier: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, gait * 0.6, u * 0.14, u * 0.18, u * 0.18);

      // Кокон за спиной
      ctx.save();
      ctx.globalAlpha *= 0.9;
      ctx.fillStyle = PAL.fillArmor;
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, k);
      Draw.smooth(ctx, [
        [0, -u * 0.40], [u * 0.22, -u * 0.26], [u * 0.18, -u * 0.02],
        [-u * 0.18, -u * 0.02], [-u * 0.22, -u * 0.26]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.enemy;
      ctx.globalAlpha *= 0.55;
      for (var i = -1; i <= 1; i++) {
        Draw.circle(ctx, i * u * 0.10, -u * 0.20 + Math.sin(time * 3 + i) * u * 0.015, u * 0.032);
        ctx.fill();
      }
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.10, -u * 0.14], [u * 0.20, -u * 0.08], [u * 0.28, u * 0.08],
          [0, u * 0.22], [-u * 0.28, u * 0.08], [-u * 0.22, -u * 0.06]
        ]);
      });

      Enemies.eyes(ctx, u, k, e, 0.11, u * 0.02, 1.5 * k);
    },

    /* Ревун: вместо головы раструб, руки закинуты назад */
    howler: function (ctx, u, k, e, time, gait) {
      var ring = (time * 0.8) % 1;
      ctx.save();
      ctx.globalAlpha *= 0.30 * (1 - ring);
      ctx.strokeStyle = PAL.aura;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      Draw.circle(ctx, 0, -u * 0.10, u * 0.28 + ring * u * 0.32);
      ctx.stroke();
      ctx.restore();

      Enemies.legs(ctx, u, k, gait, u * 0.10, u * 0.16, u * 0.20);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.08, -u * 0.18], [u * 0.18, -u * 0.10], [u * 0.22, u * 0.10],
          [-u * 0.20, u * 0.14], [-u * 0.22, -u * 0.06]
        ]);
      });

      // Раструб
      ctx.save();
      ctx.fillStyle = e.hurt > 0 ? '#D8DEE6' : PAL.fillEnemy;
      ctx.strokeStyle = PAL.aura;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      Draw.smooth(ctx, [
        [-u * 0.06, -u * 0.20], [u * 0.06, -u * 0.20],
        [u * 0.24, -u * 0.44], [-u * 0.24, -u * 0.44]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.065, -u * 0.06, 1.3 * k);
    },

    /* Щитоносец: тащит перед собой створку размером с себя */
    shielder: function (ctx, u, k, e, time, gait) {
      Enemies.legs(ctx, u, k, gait * 0.5, u * 0.12, u * 0.18, u * 0.16);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.30], [u * 0.20, -u * 0.16], [u * 0.22, u * 0.08],
          [-u * 0.22, u * 0.10], [-u * 0.20, -u * 0.16]
        ]);
      });
      Enemies.eyes(ctx, u, k, e, 0.085, -u * 0.16, 1.4 * k);

      // Створка
      ctx.save();
      ctx.globalAlpha *= 0.95;
      ctx.fillStyle = '#26323F';
      ctx.strokeStyle = PAL.shield;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      Draw.smooth(ctx, [
        [-u * 0.34, -u * 0.04], [u * 0.34, -u * 0.06],
        [u * 0.28, u * 0.32], [-u * 0.28, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha *= 0.45;
      ctx.beginPath();
      ctx.moveTo(0, u * 0.00); ctx.lineTo(0, u * 0.30);
      ctx.moveTo(-u * 0.30, u * 0.14); ctx.lineTo(u * 0.30, u * 0.13);
      ctx.stroke();
      ctx.restore();
    },

    /* Пожиратель: почти вся туша — пасть */
    devourer: function (ctx, u, k, e, time, gait) {
      var bite = e.devourLeft > 0 ? 0.5 + 0.5 * Math.sin(time * 4 + e.wobble) : 0.15;
      Enemies.legs(ctx, u, k, gait, u * 0.10, u * 0.18, u * 0.18);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.30], [u * 0.28, -u * 0.12], [u * 0.24, u * 0.12],
          [0, u * 0.22], [-u * 0.24, u * 0.12], [-u * 0.28, -u * 0.12]
        ]);
      });

      // Пасть поперёк всего тела
      ctx.save();
      ctx.fillStyle = PAL.bgDeep;
      Draw.smooth(ctx, [
        [-u * 0.22, u * 0.02], [0, -u * 0.02], [u * 0.22, u * 0.02],
        [u * 0.14, u * 0.18], [-u * 0.14, u * 0.18]
      ]);
      ctx.fill();
      ctx.fillStyle = '#D8DEE6';
      ctx.globalAlpha *= 0.85;
      for (var i = 0; i < 4; i++) {
        var x = -u * 0.16 + i * u * 0.105;
        var h = u * (0.05 + 0.035 * bite);
        Draw.poly(ctx, [[x - u * 0.04, u * 0.01], [x + u * 0.04, u * 0.01], [x, u * 0.01 + h]]);
        ctx.fill();
        Draw.poly(ctx, [[x - u * 0.04, u * 0.17], [x + u * 0.04, u * 0.17], [x, u * 0.17 - h]]);
        ctx.fill();
      }
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.15, -u * 0.18, 1.5 * k);
    },

    /* Колосс: гора с узкой головой, вросшей в плечи */
    boss: function (ctx, u, k, e, time, gait) {
      // Ноги-тумбы
      ctx.save();
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 5 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, u * 0.20); ctx.lineTo(-u * 0.22 + gait * u * 0.05, u * 0.38);
      ctx.moveTo(u * 0.20, u * 0.20); ctx.lineTo(u * 0.22 - gait * u * 0.05, u * 0.38);
      ctx.stroke();
      ctx.restore();

      // Руки до земли
      Enemies.arm(ctx, u, k, gait, -u * 0.44, -u * 0.10, u * 0.40, -u * 0.10);
      Enemies.arm(ctx, u, k, -gait, u * 0.44, -u * 0.10, u * 0.40, u * 0.10);

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.18, -u * 0.34], [u * 0.18, -u * 0.34], [u * 0.46, -u * 0.12],
          [u * 0.36, u * 0.24], [-u * 0.36, u * 0.24], [-u * 0.46, -u * 0.12]
        ]);
      });

      // Голова вросла в плечи
      ctx.save();
      ctx.translate(0, -u * 0.34);
      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [0, -u * 0.16], [u * 0.16, -u * 0.06], [u * 0.13, u * 0.08],
          [-u * 0.13, u * 0.08], [-u * 0.16, -u * 0.06]
        ]);
      });
      ctx.fillStyle = PAL.enemy;
      var ey = -u * 0.02, r = 1.7 * k;
      Draw.circle(ctx, -u * 0.09, ey, r); ctx.fill();
      Draw.circle(ctx, -u * 0.03, ey, r); ctx.fill();
      Draw.circle(ctx, u * 0.03, ey, r); ctx.fill();
      Draw.circle(ctx, u * 0.09, ey, r); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha *= 0.3;
      ctx.strokeStyle = '#4A5563';
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.30, u * 0.04); ctx.lineTo(u * 0.30, u * 0.04);
      ctx.moveTo(-u * 0.26, u * 0.16); ctx.lineTo(u * 0.26, u * 0.16);
      ctx.stroke();
      ctx.restore();
    },

    /* Титан: тот же размер, но закован в броню и с забралом */
    titan: function (ctx, u, k, e, time, gait) {
      ctx.save();
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 5.5 * k);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, u * 0.22); ctx.lineTo(-u * 0.24 + gait * u * 0.04, u * 0.40);
      ctx.moveTo(u * 0.20, u * 0.22); ctx.lineTo(u * 0.24 - gait * u * 0.04, u * 0.40);
      ctx.stroke();
      ctx.restore();

      // Наплечники
      ctx.save();
      ctx.fillStyle = '#39434F';
      ctx.strokeStyle = '#5A6573';
      ctx.lineWidth = Math.max(1, k);
      Draw.smooth(ctx, [
        [-u * 0.52, -u * 0.26], [-u * 0.30, -u * 0.32],
        [-u * 0.28, -u * 0.04], [-u * 0.52, -u * 0.02]
      ]);
      ctx.fill(); ctx.stroke();
      Draw.smooth(ctx, [
        [u * 0.52, -u * 0.26], [u * 0.30, -u * 0.32],
        [u * 0.28, -u * 0.04], [u * 0.52, -u * 0.02]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.smooth(ctx, [
          [-u * 0.20, -u * 0.32], [u * 0.20, -u * 0.32], [u * 0.40, -u * 0.08],
          [u * 0.32, u * 0.26], [-u * 0.32, u * 0.26], [-u * 0.40, -u * 0.08]
        ]);
      });

      if (e.armor > 0) {
        ctx.save();
        ctx.fillStyle = '#39434F';
        ctx.strokeStyle = '#5A6573';
        ctx.lineWidth = Math.max(1, k);
        Draw.smooth(ctx, [
          [-u * 0.24, -u * 0.06], [u * 0.24, -u * 0.06],
          [u * 0.18, u * 0.22], [-u * 0.18, u * 0.22]
        ]);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // Забрало со щелью
      ctx.save();
      ctx.translate(0, -u * 0.34);
      ctx.fillStyle = '#2A323C';
      ctx.strokeStyle = '#5A6573';
      ctx.lineWidth = Math.max(1, k);
      Draw.smooth(ctx, [
        [0, -u * 0.16], [u * 0.18, -u * 0.04], [u * 0.14, u * 0.10],
        [-u * 0.14, u * 0.10], [-u * 0.18, -u * 0.04]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL.bgDeep;
      ctx.fillRect(-u * 0.13, -u * 0.03, u * 0.26, u * 0.05);
      ctx.fillStyle = PAL.enemy;
      Draw.circle(ctx, -u * 0.07, -u * 0.005, 1.8 * k); ctx.fill();
      Draw.circle(ctx, u * 0.07, -u * 0.005, 1.8 * k); ctx.fill();
      ctx.restore();
    }
  }
};
