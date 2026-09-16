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

  mouth: function (ctx, u, k, w, my) {
    ctx.save();
    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = PAL.enemy;
    ctx.fillRect(-w / 2, my, w, Math.max(1, k));
    ctx.restore();
  },

  shapes: {
    /* Бродяга: сутулый силуэт с покатыми плечами и висящими руками */
    walker: function (ctx, u, k, e, time, gait) {
      Enemies.shell(ctx, e, k, function () {
        Draw.poly(ctx, [
          [-u * 0.20, -u * 0.26], [u * 0.20, -u * 0.26],
          [u * 0.28, -u * 0.10], [u * 0.28, u * 0.26],
          [-u * 0.28, u * 0.26], [-u * 0.28, -u * 0.10]
        ]);
      });

      // Руки качаются в противофазе
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.30, -u * 0.04); ctx.lineTo(-u * 0.32, u * 0.14 + gait * u * 0.03);
      ctx.moveTo(u * 0.30, -u * 0.04); ctx.lineTo(u * 0.32, u * 0.14 - gait * u * 0.03);
      ctx.stroke();

      Enemies.eyes(ctx, u, k, e, 0.115, -u * 0.09, 1.4 * k);
      Enemies.mouth(ctx, u, k, u * 0.20, u * 0.09);
    },

    /* Бегун: узкое тело, наклон вперёд и штрихи скорости позади */
    runner: function (ctx, u, k, e, time, gait) {
      ctx.rotate(0.14);   // постоянный наклон по ходу движения

      Enemies.shell(ctx, e, k, function () {
        Draw.roundRect(ctx, -u * 0.20, -u * 0.30, u * 0.40, u * 0.58, u * 0.13);
      });

      // Штрихи скорости за спиной
      ctx.save();
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = PAL.enemy;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.12, -u * 0.40); ctx.lineTo(-u * 0.12, -u * 0.50);
      ctx.moveTo(u * 0.06, -u * 0.38); ctx.lineTo(u * 0.06, -u * 0.46);
      ctx.stroke();
      ctx.restore();

      // Ноги в беге
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.07, u * 0.27); ctx.lineTo(-u * 0.10 + gait * u * 0.06, u * 0.38);
      ctx.moveTo(u * 0.07, u * 0.27); ctx.lineTo(u * 0.10 - gait * u * 0.06, u * 0.38);
      ctx.stroke();

      Enemies.eyes(ctx, u, k, e, 0.075, -u * 0.13, 1.3 * k);
    },

    /* Броненосец: широкий корпус под съёмной пластиной с заклёпками */
    armored: function (ctx, u, k, e, time, gait) {
      Enemies.shell(ctx, e, k, function () {
        Draw.roundRect(ctx, -u * 0.32, -u * 0.28, u * 0.64, u * 0.56, u * 0.10);
      });

      if (e.armor > 0) {
        // Пластина поверх верхней половины
        ctx.fillStyle = '#39434F';
        ctx.strokeStyle = '#4A5563';
        ctx.lineWidth = Math.max(1, k);
        Draw.poly(ctx, [
          [-u * 0.30, -u * 0.26], [u * 0.30, -u * 0.26],
          [u * 0.26, u * 0.02], [-u * 0.26, u * 0.02]
        ]);
        ctx.fill(); ctx.stroke();

        // Заклёпки
        ctx.fillStyle = '#5A6573';
        Draw.circle(ctx, -u * 0.18, -u * 0.19, u * 0.022); ctx.fill();
        Draw.circle(ctx, 0, -u * 0.19, u * 0.022); ctx.fill();
        Draw.circle(ctx, u * 0.18, -u * 0.19, u * 0.022); ctx.fill();

        // Глаза светятся из-под пластины
        Enemies.eyes(ctx, u, k, e, 0.13, u * 0.13, 1.4 * k);
      } else {
        // Броня сбита: остались сколы на корпусе
        ctx.save();
        ctx.globalAlpha *= 0.5;
        ctx.strokeStyle = '#4A5563';
        ctx.lineWidth = Math.max(1, k);
        ctx.beginPath();
        ctx.moveTo(-u * 0.26, -u * 0.20); ctx.lineTo(-u * 0.14, -u * 0.24);
        ctx.moveTo(u * 0.14, -u * 0.24); ctx.lineTo(u * 0.26, -u * 0.20);
        ctx.stroke();
        ctx.restore();
        Enemies.eyes(ctx, u, k, e, 0.13, -u * 0.06, 1.5 * k);
        Enemies.mouth(ctx, u, k, u * 0.26, u * 0.12);
      }
    },

    /* Прыгун: компактное тело на длинных согнутых ногах */
    jumper: function (ctx, u, k, e, time, gait) {
      var crouch = e.jumpT > 0 ? 1 : 0;

      // Ноги: в прыжке поджаты, при ходьбе шагают
      ctx.strokeStyle = PAL.gridLine;
      ctx.lineWidth = Math.max(1, 1.8 * k);
      ctx.beginPath();
      if (crouch) {
        ctx.moveTo(-u * 0.10, u * 0.14); ctx.lineTo(-u * 0.17, u * 0.05);
        ctx.moveTo(u * 0.10, u * 0.14); ctx.lineTo(u * 0.17, u * 0.05);
      } else {
        ctx.moveTo(-u * 0.10, u * 0.14); ctx.lineTo(-u * 0.13 + gait * u * 0.05, u * 0.33);
        ctx.moveTo(u * 0.10, u * 0.14); ctx.lineTo(u * 0.13 - gait * u * 0.05, u * 0.33);
      }
      ctx.stroke();

      Enemies.shell(ctx, e, k, function () {
        Draw.roundRect(ctx, -u * 0.23, -u * 0.30, u * 0.46, u * 0.46, u * 0.16);
      });

      // Гребень на макушке
      ctx.strokeStyle = PAL.enemy;
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.30); ctx.lineTo(0, -u * 0.39);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.105, -u * 0.13, 1.4 * k);
      Enemies.mouth(ctx, u, k, u * 0.18, u * 0.02);
    },

    /* Плевун: тело с соплом снизу, оно вспыхивает в момент выстрела */
    spitter: function (ctx, u, k, e, time, gait) {
      Enemies.shell(ctx, e, k, function () {
        Draw.poly(ctx, [
          [-u * 0.26, -u * 0.24], [u * 0.26, -u * 0.24],
          [u * 0.22, u * 0.14], [-u * 0.22, u * 0.14]
        ]);
      });

      // Сопло
      ctx.fillStyle = e.hurt > 0 ? '#D8DEE6' : PAL.fillEnemy;
      ctx.strokeStyle = e.slowT > 0 ? PAL.ice : PAL.gridLine;
      ctx.lineWidth = Math.max(1, k);
      Draw.poly(ctx, [
        [-u * 0.09, u * 0.14], [u * 0.09, u * 0.14],
        [u * 0.06, u * 0.30], [-u * 0.06, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();

      // Свечение при плевке
      if (e.attacking > 0) {
        ctx.save();
        ctx.globalAlpha *= Math.min(1, e.attacking);
        ctx.fillStyle = PAL.enemy;
        Draw.circle(ctx, 0, u * 0.30, u * 0.05);
        ctx.fill();
        ctx.restore();
      }

      Enemies.eyes(ctx, u, k, e, 0.125, -u * 0.11, 1.4 * k);
    },

    /* Фантом: в фазе тело почти исчезает, остаётся только контур */
    phantom: function (ctx, u, k, e, time, gait) {
      if (e.phased) ctx.globalAlpha *= 0.28;

      Enemies.shell(ctx, e, k, function () {
        Draw.poly(ctx, [
          [0, -u * 0.30], [u * 0.26, -u * 0.08],
          [u * 0.20, u * 0.26], [-u * 0.20, u * 0.26],
          [-u * 0.26, -u * 0.08]
        ]);
      });

      // Дымный шлейф снизу
      ctx.save();
      ctx.globalAlpha *= 0.4;
      ctx.strokeStyle = PAL.phase;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.12, u * 0.26); ctx.lineTo(-u * 0.15, u * 0.36 + gait * u * 0.03);
      ctx.moveTo(0, u * 0.26); ctx.lineTo(0, u * 0.38 - gait * u * 0.03);
      ctx.moveTo(u * 0.12, u * 0.26); ctx.lineTo(u * 0.15, u * 0.36 + gait * u * 0.03);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.10, -u * 0.10, 1.4 * k);

      // В фазе по контуру бежит голубая искра
      if (e.phased) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = PAL.phase;
        ctx.lineWidth = Math.max(1, 1.4 * k);
        Draw.circle(ctx, 0, 0, u * 0.30);
        ctx.stroke();
        ctx.restore();
      }
    },

    /* Пепельник: растрескавшийся корпус с раскалёнными швами */
    burster: function (ctx, u, k, e, time, gait) {
      Enemies.shell(ctx, e, k, function () {
        Draw.ngon(ctx, 0, 0, u * 0.29, 7, -Math.PI / 2);
      });

      // Швы светятся и пульсируют
      ctx.save();
      ctx.globalAlpha *= 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(time * 4 + e.wobble));
      ctx.strokeStyle = PAL.ash;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, -u * 0.06); ctx.lineTo(-u * 0.04, u * 0.04);
      ctx.lineTo(-u * 0.10, u * 0.22);
      ctx.moveTo(u * 0.20, -u * 0.04); ctx.lineTo(u * 0.06, u * 0.10);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.11, -u * 0.12, 1.4 * k);
    },

    /* Рой: бугристый ком, внутри просвечивают два ядра */
    swarm: function (ctx, u, k, e, time, gait) {
      Enemies.shell(ctx, e, k, function () {
        Draw.roundRect(ctx, -u * 0.30, -u * 0.26, u * 0.60, u * 0.52, u * 0.24);
      });

      // Два ядра — намёк, что развалится надвое
      ctx.save();
      ctx.globalAlpha *= 0.5;
      ctx.strokeStyle = PAL.enemy;
      ctx.lineWidth = Math.max(1, k);
      Draw.circle(ctx, -u * 0.12, u * 0.02, u * 0.13); ctx.stroke();
      Draw.circle(ctx, u * 0.12, u * 0.02, u * 0.13); ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.12, -u * 0.07, 1.3 * k);
    },

    /* Лекарь: сутулая фигура под пульсирующим нимбом */
    healer: function (ctx, u, k, e, time, gait) {
      var pulse = 0.5 + 0.5 * Math.sin(time * 3 + e.wobble);

      // Нимб
      ctx.save();
      ctx.globalAlpha *= 0.25 + 0.3 * pulse;
      ctx.strokeStyle = PAL.heal;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.34, u * 0.17, u * 0.06, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.poly(ctx, [
          [-u * 0.17, -u * 0.24], [u * 0.17, -u * 0.24],
          [u * 0.26, u * 0.26], [-u * 0.26, u * 0.26]
        ]);
      });

      // Крест на груди
      ctx.save();
      ctx.globalAlpha *= 0.7;
      ctx.strokeStyle = PAL.heal;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.02); ctx.lineTo(0, u * 0.18);
      ctx.moveTo(-u * 0.08, u * 0.10); ctx.lineTo(u * 0.08, u * 0.10);
      ctx.stroke();
      ctx.restore();

      Enemies.eyes(ctx, u, k, e, 0.09, -u * 0.12, 1.3 * k);
    },

    /* Колосс: две колонки в ширину, рога и четыре глаза */
    boss: function (ctx, u, k, e, time, gait) {
      // Рога
      ctx.strokeStyle = PAL.enemy;
      ctx.save();
      ctx.globalAlpha *= 0.7;
      ctx.lineWidth = Math.max(1, 1.8 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.34, -u * 0.30); ctx.lineTo(-u * 0.42, -u * 0.46);
      ctx.moveTo(u * 0.34, -u * 0.30); ctx.lineTo(u * 0.42, -u * 0.46);
      ctx.stroke();
      ctx.restore();

      Enemies.shell(ctx, e, k, function () {
        Draw.poly(ctx, [
          [-u * 0.38, -u * 0.30], [u * 0.38, -u * 0.30],
          [u * 0.50, -u * 0.06], [u * 0.44, u * 0.30],
          [-u * 0.44, u * 0.30], [-u * 0.50, -u * 0.06]
        ]);
      });

      // Грудные плиты
      ctx.save();
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = '#4A5563';
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.30, u * 0.10); ctx.lineTo(u * 0.30, u * 0.10);
      ctx.moveTo(-u * 0.24, u * 0.20); ctx.lineTo(u * 0.24, u * 0.20);
      ctx.stroke();
      ctx.restore();

      // Четыре глаза в один ряд
      ctx.fillStyle = PAL.enemy;
      var ey = -u * 0.13, r = 1.8 * k;
      Draw.circle(ctx, -u * 0.27, ey, r); ctx.fill();
      Draw.circle(ctx, -u * 0.09, ey, r); ctx.fill();
      Draw.circle(ctx, u * 0.09, ey, r); ctx.fill();
      Draw.circle(ctx, u * 0.27, ey, r); ctx.fill();

      Enemies.mouth(ctx, u, k, u * 0.44, u * 0.01);
    }
  }
};
