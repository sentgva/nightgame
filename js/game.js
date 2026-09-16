/* game.js — игровой цикл, состояние боя и отрисовка поля.
   Вся отрисовка идёт в один <canvas>; интерфейс вокруг поля — обычный DOM. */

/* ======================================================================
   БАЛАНС. Все числа, влияющие на игру, собраны здесь и в UNIT_TYPES /
   ENEMY_TYPES / LEVELS. Логика ниже читает только эти значения.
   ====================================================================== */
var CONFIG = {
  lives: 3,                // жизней на уровень
  prepTime: 5,             // пауза между волнами, сек
  firstPrepTime: 12,       // фора перед самой первой волной уровня
  earlyBonusPerSec: 5,     // искр за каждую секунду, срезанную кнопкой «начать раньше»
  sparkLife: 8,            // сколько искра лежит на поле, сек
  sparkBlink: 2,           // за сколько секунд до исчезновения начинает мигать
  sparkBob: 3,             // амплитуда покачивания искры, px

  /* --- экономика ---
     Три источника дохода вместо одного: маяки (искры надо подбирать),
     убитые враги (падают в счётчик сразу) и награда за зачищенную волну.
     Базовый ручеёк не даёт застрять навсегда, если поле снесли под ноль. */
  trickle: 1.2,            // базовый доход, искр в секунду
  killRewardMul: 0.75,     // множитель наград с врагов
  waveBonusBase: 25,       // награда за зачищенную волну
  waveBonusPerWave: 5,     // и надбавка за её номер
  autoCollect: 1.2,        // за сколько секунд до угасания искра улетает в счётчик сама
  placeDebounce: 150,      // защита от двойного тапа, мс
  bulletSpeed: 9,          // скорость снаряда защитника, клеток/сек
  spitSpeed: 4.5,          // скорость плевка врага, клеток/сек
  fixedStep: 1 / 60,       // шаг логики
  maxSteps: 5,             // максимум догоняющих шагов за кадр
  sellRefund: 0.5,         // доля возврата при продаже
  jumpTime: 0.5,           // длительность прыжка прыгуна, сек
  iceThaw: 10,             // само оттаивает за столько секунд, если не тапнуть
  sporeTime: 6,            // сколько секунд споры душат темп стрельбы
  sporeSlow: 2,            // во сколько раз реже стреляет заспоренный юнит
  breachPulseCells: 2      // за сколько клеток до рубежа он начинает пульсировать
};

var Game = {
  canvas: null, ctx: null, dpr: 1,
  running: false, paused: false, over: false,
  raf: 0, lastTs: 0, acc: 0, time: 0,

  level: null, levelId: 1, endless: false,
  sparks: 0, lives: 3, waveIndex: 0,
  phase: 'prep',            // 'prep' | 'wave' | 'done'
  prepT: 0, waveT: 0,
  spawnQueue: [],
  kills: 0, collected: 0,

  enemies: [], projectiles: [], particles: [], drops: [], flights: [], popups: [],
  trickleAcc: 0,
  cardCd: {},
  selected: null, lastPlaceTs: 0, menuUnit: null,
  iceT: 0, collapseT: 0, sporeT: 0,
  shake: 0, edgeFlash: 0,

  /* ---------------- Инициализация ---------------- */
  init: function (canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    var self = this;

    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      self.onPointer(e.clientX, e.clientY);
    }, { passive: false });

    // Фолбэк для старых мобильных браузеров без PointerEvent
    if (!window.PointerEvent) {
      canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        var t = e.changedTouches[0];
        self.onPointer(t.clientX, t.clientY);
      }, { passive: false });
    }
  },

  /* Пересчёт геометрии поля под текущий размер окна */
  resize: function () {
    var wrap = document.getElementById('field-wrap');
    if (!wrap || !this.canvas) return;
    var availW = wrap.clientWidth - 12;
    var availH = wrap.clientHeight - 12;
    if (availW <= 0 || availH <= 0) return;

    Grid.layout(availW, availH);
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(Grid.w * this.dpr);
    this.canvas.height = Math.round(Grid.h * this.dpr);
    this.canvas.style.width = Grid.w + 'px';
    this.canvas.style.height = Grid.h + 'px';
    if (!this.running) this.render();
  },

  /* ---------------- Старт уровня ---------------- */
  start: function (levelId, endless) {
    this.endless = !!endless;
    this.levelId = endless ? 0 : levelId;
    this.level = endless ? Waves.endlessLevel() : Waves.get(levelId);

    Grid.clear();
    this.placeCraters(this.level.craters);
    this.placeVines(this.level.vines);
    this.iceT = this.level.iceEvery || 0;
    this.collapseT = this.level.collapseEvery || 0;
    this.sporeT = this.level.sporeEvery || 0;
    this.sparks = this.level.startSparks;
    this.lives = CONFIG.lives;
    this.waveIndex = 0;
    this.kills = 0;
    this.collected = 0;
    this.enemies.length = 0;
    this.drops.length = 0;
    this.flights.length = 0;
    this.popups.length = 0;
    this.trickleAcc = 0;
    this.projectiles.length = 0;
    this.particles.length = 0;
    this.spawnQueue.length = 0;
    this.selected = null;
    this.menuUnit = null;
    this.over = false;
    this.paused = false;
    this.shake = 0;
    this.edgeFlash = 0;
    this.time = 0;
    this.acc = 0;

    this.cardCd = {};
    for (var i = 0; i < UNIT_ORDER.length; i++) this.cardCd[UNIT_ORDER[i]] = 0;

    this.phase = 'prep';
    this.prepT = CONFIG.firstPrepTime;

    UI.enterGame(this);   // экран должен быть виден до расчёта размеров поля
    this.resize();
    this.syncHud();

    this.running = true;
    this.lastTs = 0;
    var self = this;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });
  },

  stop: function () {
    this.running = false;
    cancelAnimationFrame(this.raf);
  },

  restart: function () {
    this.start(this.endless ? 0 : this.levelId, this.endless);
  },

  /* ---------------- Цикл ---------------- */
  loop: function (ts) {
    if (!this.running) return;
    var self = this;
    this.raf = requestAnimationFrame(function (t) { self.loop(t); });

    if (!this.lastTs) this.lastTs = ts;
    var dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (dt > 0.25) dt = 0.25;               // вкладка была неактивна — не догоняем

    if (!this.paused && !this.over) {
      this.acc += dt;
      var steps = 0;
      while (this.acc >= CONFIG.fixedStep && steps < CONFIG.maxSteps) {
        this.step(CONFIG.fixedStep);
        this.acc -= CONFIG.fixedStep;
        steps++;
      }
      if (steps === CONFIG.maxSteps) this.acc = 0;
    }
    this.render();
  },

  pause: function (on) {
    if (this.over) return;
    this.paused = !!on;
    if (this.paused) { this.closeUnitMenu(); UI.showPause(true); }
    else { UI.showPause(false); this.lastTs = 0; }
  },

  /* ---------------- Шаг логики ---------------- */
  step: function (dt) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt / 0.3);
    if (this.edgeFlash > 0) this.edgeFlash = Math.max(0, this.edgeFlash - dt / 0.3);

    for (var i = 0; i < UNIT_ORDER.length; i++) {
      var id = UNIT_ORDER[i];
      if (this.cardCd[id] > 0) this.cardCd[id] = Math.max(0, this.cardCd[id] - dt);
    }

    this.stepUnits(dt);
    this.stepEnemies(dt);
    this.stepProjectiles(dt);
    this.stepDrops(dt);
    this.stepParticles(dt);
    this.stepFlights(dt);
    this.stepPopups(dt);
    this.stepTrickle(dt);
    this.stepIce(dt);
    this.stepCollapse(dt);
    this.stepSpores(dt);
    this.stepWaves(dt);

    UI.tickCards(this);
    UI.tickUnitMenu(this);
  },

  /* ---------------- Защитники ---------------- */
  stepUnits: function (dt) {
    var self = this;
    Grid.each(function (u, col, row) {
      if (u.dead) return;
      if (u.spawnT < 1) u.spawnT = Math.min(1, u.spawnT + dt / 0.2);
      if (u.flash > 0) u.flash -= dt / 0.08;
      if (u.hurt > 0) u.hurt -= dt;
      if (u.frozen > 0) { u.frozen = Math.max(0, u.frozen - dt); return; }
      if (u.spored > 0) u.spored = Math.max(0, u.spored - dt);

      // Ремонтник чинит соседей по сторонам света
      if (u.def.repair) {
        u.cd -= dt;
        if (u.cd > 0) return;
        u.cd = 1 / u.def.fireRate;
        var around = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        var healed = false;
        for (var a = 0; a < around.length; a++) {
          var n = Grid.get(col + around[a][0], row + around[a][1]);
          if (!n || n.dead || n.hp >= n.maxHp) continue;
          n.hp = Math.min(n.maxHp, n.hp + Units.stat(u, 'repair'));
          healed = true;
        }
        if (healed) {
          u.flash = 1;
          self.spawnParticles(Grid.centerX(col), Grid.centerY(row), 3, u.def.color, 90, 0.3, true);
        }
        return;
      }

      if (u.type === 'beacon') {
        if (self.phase !== 'wave') return;   // в паузе маяки не работают
        u.prodT -= dt;
        if (u.prodT <= 0) {
          u.prodT = u.def.interval;
          u.flash = 1;
          self.dropSpark(Grid.centerX(col), Grid.centerY(row), Math.round(Units.stat(u, 'produce')));
        }
        return;
      }

      if (u.type === 'mine') {
        var mx = Grid.centerX(col), my = Grid.centerY(row);
        for (var i = 0; i < self.enemies.length; i++) {
          var e = self.enemies[i];
          if (e.dead || e.spawnT < 1) continue;
          if (!self.enemyCoversColumn(e, col)) continue;
          if (Math.abs(e.y - my) < Grid.cell * 0.42) { self.explodeMine(u, mx, my); break; }
        }
        return;
      }

      // Магнит: раз в несколько секунд срывает броню с ближайшего броненосца
      if (u.def.strip) {
        u.cd -= dt;
        if (u.cd > 0) return;
        var victim = self.findArmored(u, col, row);
        if (!victim) { u.cd = 0.25; return; }
        u.cd = 1 / u.def.fireRate;
        u.flash = 1;
        victim.armor = 0;
        victim.damaged = true;
        Sound.play('freeze');
        self.spawnParticles(Enemies.centerX(victim, Grid.cell), victim.y, 6, PAL.ice, 150, 0.3, false);
        return;
      }

      if (!u.def.damage) return;   // барьер и горн не атакуют

      u.cd -= dt;
      if (u.cd > 0) return;
      var target = self.findEnemyForUnit(u, col, row);
      if (!target) return;
      u.cd = (1 / u.def.fireRate) * (u.spored > 0 ? CONFIG.sporeSlow : 1);
      u.flash = 1;
      Sound.play(u.def.shotSound || 'shot');
      self.fire(u, col, row);
    });
  },

  enemyCoversColumn: function (enemy, col) {
    return col >= enemy.col && col < enemy.col + enemy.width;
  },

  /* Ближайший враг выше юнита в его колонке, в пределах дальности */
  findEnemyForUnit: function (u, col, row) {
    var cy = Grid.centerY(row);
    var reach = Units.stat(u, 'range') * Grid.cell;
    var best = null;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      if (!this.enemyCoversColumn(e, col)) continue;
      if (e.y > cy + Grid.cell * 0.2) continue;        // уже прошёл мимо
      if (e.y < -Grid.cell * 0.5) continue;            // ещё не вошёл в поле
      if (cy - e.y > reach) continue;
      if (!best || e.y > best.y) best = e;
    }
    return best;
  },

  /* Выстрел. Веер бьёт в три колонки, дуплет — сдвоенным залпом. */
  fire: function (u, col, row) {
    var cols = u.def.spreadCols ? [col - 1, col, col + 1] : [col];
    var burst = u.def.burst || 1;
    for (var c = 0; c < cols.length; c++) {
      if (cols[c] < 0 || cols[c] >= Grid.cols) continue;
      for (var b = 0; b < burst; b++) {
        this.spawnBullet(u, cols[c], row, b * Grid.cell * 0.2);
      }
    }
  },

  spawnBullet: function (u, col, row, lag) {
    var p = this.getProjectile();
    p.x = Grid.centerX(col);
    p.y = Grid.centerY(row) - Grid.cell * 0.3 + lag;
    p.vy = -CONFIG.bulletSpeed * Grid.cell;
    p.col = col;
    p.width = 1;
    p.hostile = false;
    p.dmg = Units.stat(u, 'damage');
    p.color = u.def.color;
    p.boosted = false;
    p.splash = u.def.splash || 0;
    p.pierce = !!u.def.pierce;
    p.hits = p.hits || [];
    p.hits.length = 0;
    p.slow = u.def.slow || 0;
    p.slowTime = u.level > 1 && u.def.upgradeKey === 'damage'
      ? (u.def.slowTime || 0) * 1.5 : (u.def.slowTime || 0);
    p.maxDist = Units.stat(u, 'range') * Grid.cell;
    p.dist = 0;
    p.trail[0] = p.y; p.trail[1] = p.y;
  },

  /* Ближайший бронированный враг в радиусе действия магнита */
  findArmored: function (u, col, row) {
    var reach = Units.stat(u, 'range') * Grid.cell;
    var ux = Grid.centerX(col), uy = Grid.centerY(row);
    var best = null, bestD = Infinity;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead || e.armor <= 0 || e.y < 0) continue;
      var dx = Enemies.centerX(e, Grid.cell) - ux, dy = e.y - uy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= reach && d < bestD) { best = e; bestD = d; }
    }
    return best;
  },

  explodeMine: function (u, mx, my) {
    var r = u.def.radius * Grid.cell;
    var dmg = Units.stat(u, 'damage');
    Sound.play('mine');
    TG.haptic('heavy');
    this.spawnParticles(mx, my, 10, PAL.danger, 240, 0.4, false);
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead || e.phased) continue;
      var ex = Enemies.centerX(e, Grid.cell);
      if (Math.abs(ex - mx) <= r && Math.abs(e.y - my) <= r) this.hitEnemy(e, dmg);
    }
    u.dead = true;
    Grid.set(u.col, u.row, null);
  },

  /* ---------------- Враги ---------------- */
  stepEnemies: function (dt) {
    var cell = Grid.cell;
    this.stepAuras();
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }

      if (e.spawnT < 1) e.spawnT = Math.min(1, e.spawnT + dt / 0.3);
      if (e.hurt > 0) e.hurt -= dt;
      if (e.slowT > 0) e.slowT = Math.max(0, e.slowT - dt);

      // Прыжок прыгуна — пока он в воздухе, его ничто не держит
      if (e.jumpT > 0) {
        e.jumpT = Math.min(1, e.jumpT + dt / CONFIG.jumpTime);
        e.y = e.jumpFrom + (e.jumpTo - e.jumpFrom) * e.jumpT;
        if (e.jumpT >= 1) e.jumpT = 0;
        continue;
      }

      if (e.attacking > 0) e.attacking = Math.max(0, e.attacking - dt);

      // Фантом циклично уходит в фазу: в ней снаряды проходят насквозь
      if (e.def.phaseEvery) {
        e.phaseT += dt;
        var cycle = e.def.phaseEvery + e.def.phaseFor;
        if (e.phaseT >= cycle) e.phaseT -= cycle;
        e.phased = e.phaseT > e.def.phaseEvery && e.y > 0;
      }

      // Лекарь чинит соседей по колонке
      if (e.def.heal) {
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = 1;
          this.healAround(e);
        }
      }
      // Носитель высаживает личинок прямо на ходу
      if (e.def.spawnEvery && e.y > 0) {
        e.spawnEveryT -= dt;
        if (e.spawnEveryT <= 0) {
          e.spawnEveryT = e.def.spawnEvery;
          var kid = Enemies.create(e.def.spawnType, e.col, { hpMul: (this.level.hpScale || 1) * 0.7 });
          kid.y = e.y - cell * 0.4;
          kid.spawnT = 1;
          this.enemies.push(kid);
          this.spawnParticles(Enemies.centerX(e, cell), e.y, 4, PAL.enemy, 110, 0.3, false);
        }
      }

      var slowMul = e.slowT > 0 ? 0.6 : 1;
      if (e.hasted) slowMul *= e.hasted;
      var blocker = this.findBlockingUnit(e);
      e.blocked = !!blocker;

      // Плевун останавливается за две клетки и бьёт оттуда.
      // Но только войдя в поле: иначе он замирал бы за верхней границей,
      // недосягаемый для защитников, и волна не кончалась бы никогда.
      if (e.def.rangedRange && !blocker && e.y > cell * 0.3) {
        var far = this.findUnitAhead(e, e.def.rangedRange);
        if (far) {
          e.atkCd -= dt;
          e.blocked = true;
          if (e.atkCd <= 0) { e.atkCd = 1 / e.def.atkRate; e.attacking = 0.3; this.spit(e, far); }
          continue;
        }
      }

      if (blocker) {
        // Прыгун один раз за уровень перескакивает через ряд защитников.
        // Через последний ряд не прыгает — иначе прыжок был бы мгновенным прорывом.
        if (e.jumpsLeft > 0 && blocker.row < Grid.rows - 1) {
          e.jumpsLeft--;
          e.jumpT = 0.0001;
          e.jumpFrom = e.y;
          e.jumpTo = Grid.centerY(blocker.row) + cell * 0.75;
          continue;
        }
        // Пожиратель первого встречного защитника съедает целиком.
        // Барьер ему не по зубам — это и есть контра: без барьеров строй
        // растворялся бесплатно, и уровень становился нечестным.
        if (e.devourLeft > 0 && blocker.type !== 'barrier') {
          e.devourLeft--;
          e.attacking = 0.4;
          Sound.play('mine');
          TG.haptic('heavy');
          this.spawnParticles(Grid.centerX(blocker.col), Grid.centerY(blocker.row),
            10, PAL.enemy, 210, 0.35, false);
          this.damageUnit(blocker, blocker.maxHp * 10);
          continue;
        }

        e.atkCd -= dt;
        if (e.atkCd <= 0) {
          e.atkCd = 1 / e.def.atkRate;
          e.attacking = 0.3;
          this.damageUnit(blocker, e.def.damage);
        }
        continue;
      }

      e.y += e.speed * cell * dt * slowMul;

      // Прорыв рубежа
      if (e.y > Grid.h) {
        e.dead = true;
        this.enemies.splice(i, 1);
        this.loseLife();
      }
    }
  },

  /* Защитник, в который упёрся враг (мины не блокируют — на них наступают) */
  findBlockingUnit: function (e) {
    var cell = Grid.cell;
    var front = e.y + Enemies.bodySize(e, cell) / 2;
    for (var r = 0; r < Grid.rows; r++) {
      for (var c = e.col; c < e.col + e.width; c++) {
        var u = Grid.get(c, r);
        if (!u || u.dead || u.type === 'mine') continue;
        var cy = Grid.centerY(r);
        if (front >= cy - cell * 0.30 && e.y <= cy + cell * 0.30) return u;
      }
    }
    return null;
  },

  /* Защитник впереди в пределах n клеток — для плевуна */
  findUnitAhead: function (e, cells) {
    var cell = Grid.cell;
    for (var r = 0; r < Grid.rows; r++) {
      for (var c = e.col; c < e.col + e.width; c++) {
        var u = Grid.get(c, r);
        if (!u || u.dead || u.type === 'mine') continue;
        var cy = Grid.centerY(r);
        if (cy > e.y && cy - e.y <= cells * cell) return u;
      }
    }
    return null;
  },

  spit: function (e, target) {
    var p = this.getProjectile();
    p.x = Enemies.centerX(e, Grid.cell);
    p.y = e.y + Grid.cell * 0.2;
    p.vy = CONFIG.spitSpeed * Grid.cell;
    p.col = target.col;
    p.width = 1;
    p.hostile = true;
    p.dmg = e.def.damage;
    p.color = PAL.enemy;
    p.slow = 0; p.slowTime = 0;
    p.maxDist = Grid.h;
    p.dist = 0;
    p.trail[0] = p.y; p.trail[1] = p.y;
  },

  damageUnit: function (u, amount) {
    u.hp -= amount;
    u.hurt = 0.06;
    Sound.play('hit');
    if (u.hp <= 0) {
      u.dead = true;
      Grid.set(u.col, u.row, null);
      this.spawnParticles(Grid.centerX(u.col), Grid.centerY(u.row), 7, u.def.color, 150, 0.3, false);
      if (this.menuUnit === u) this.closeUnitMenu();
    }
  },

  killEnemy: function (e) {
    if (e.counted) return;
    e.counted = true;
    e.dead = true;
    this.kills++;
    Sound.play('death');
    TG.haptic('medium');
    var x = Enemies.centerX(e, Grid.cell);
    this.spawnParticles(x, e.y, e.def.boss ? 16 : 7, PAL.enemy, e.def.boss ? 260 : 170, 0.3, false);

    // Награда идёт в счётчик сразу: подбирать нужно только искры маяков,
    // иначе в плотной волне половина дохода просто истлевала бы на поле.
    this.gain(e.def.spark * CONFIG.killRewardMul, x, e.y);

    // Пепельник напоследок обжигает защитника под собой
    if (e.def.deathBlast) {
      var row = Math.floor((e.y + Grid.cell * 0.5) / Grid.cell);
      for (var r = row; r < Grid.rows; r++) {
        var u = Grid.get(e.col, r);
        if (u && !u.dead) { this.damageUnit(u, e.def.deathBlast); break; }
      }
      Sound.play('mine');
      this.spawnParticles(x, e.y, 9, PAL.ash, 200, 0.35, false);
    }

    // Рой распадается на двух мелких
    if (e.def.splitInto) {
      for (var s = 0; s < e.def.splitCount; s++) {
        var kid = Enemies.create(e.def.splitInto, e.col, { hpMul: (this.level.hpScale || 1) * 0.5 });
        kid.y = e.y + (s - 0.5) * Grid.cell * 0.3;
        kid.spawnT = 1;
        this.enemies.push(kid);
      }
    }
  },

  /* Лекарь возвращает здоровье врагам вокруг себя */
  healAround: function (healer) {
    var reach = healer.def.healRange * Grid.cell;
    var hx = Enemies.centerX(healer, Grid.cell);
    var healed = false;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e === healer || e.dead || e.hp >= e.maxHp) continue;
      var dx = Enemies.centerX(e, Grid.cell) - hx, dy = e.y - healer.y;
      if (Math.sqrt(dx * dx + dy * dy) > reach) continue;
      e.hp = Math.min(e.maxHp, e.hp + healer.def.heal);
      healed = true;
    }
    if (healed) this.spawnParticles(hx, healer.y, 3, PAL.heal, 90, 0.35, true);
  },

  loseLife: function () {
    if (this.over) return;      // уровень уже завершён — жизни больше не снимаем
    this.lives--;
    this.shake = 1;
    this.edgeFlash = 1;
    Sound.play('life');
    TG.haptic('error');
    this.syncHud();
    if (this.lives <= 0) this.finish(false);
  },

  /* ---------------- Снаряды ---------------- */
  getProjectile: function () {
    for (var i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].active) { this.projectiles[i].active = true; return this.projectiles[i]; }
    }
    var p = { active: true, x: 0, y: 0, vy: 0, col: 0, width: 1, hostile: false, dmg: 0,
              color: PAL.ally, slow: 0, slowTime: 0, maxDist: 0, dist: 0, trail: [0, 0] };
    this.projectiles.push(p);
    return p;
  },

  stepProjectiles: function (dt) {
    var cell = Grid.cell;
    for (var i = 0; i < this.projectiles.length; i++) {
      var p = this.projectiles[i];
      if (!p.active) continue;

      p.trail[1] = p.trail[0];
      p.trail[0] = p.y;
      var dy = p.vy * dt;
      p.y += dy;
      p.dist += Math.abs(dy);

      if (p.dist > p.maxDist || p.y < -cell || p.y > Grid.h + cell) { p.active = false; continue; }

      if (p.hostile) {
        // Плевок ищет защитника в своей колонке
        var row = Math.floor(p.y / cell);
        var u = Grid.get(p.col, row);
        if (u && !u.dead && u.type !== 'mine') {
          this.damageUnit(u, p.dmg);
          this.spawnParticles(p.x, p.y, 4, PAL.enemy, 110, 0.25, true);
          p.active = false;
        }
        continue;
      }

      // Горн: снаряд, прошедший сквозь его клетку, бьёт сильнее
      if (!p.boosted) {
        var trow = Math.floor(p.y / cell);
        var tu = Grid.get(p.col, trow);
        if (tu && !tu.dead && tu.def.boost) {
          p.boosted = true;
          p.dmg *= Units.stat(tu, 'boost');
          p.color = PAL.spark;
          tu.flash = 1;
        }
      }

      // Снаряд защитника — первый враг в колонке
      for (var j = 0; j < this.enemies.length; j++) {
        var e = this.enemies[j];
        if (e.dead || e.spawnT < 0.3 || e.phased) continue;
        if (!this.enemyCoversColumn(e, p.col)) continue;
        var half = Enemies.bodySize(e, cell) / 2;
        if (Math.abs(e.y - p.y) > half) continue;

        // Лазер прошивает колонку: каждого задевает ровно один раз
        if (p.pierce) {
          if (p.hits.indexOf(e) !== -1) continue;
          p.hits.push(e);
          this.hitEnemy(e, p.dmg);
          this.spawnParticles(p.x, p.y, 2, p.color, 90, 0.2, true);
          continue;
        }

        if (p.slow > 0) { e.slowT = Math.max(e.slowT, p.slowTime); }
        if (p.splash > 0) this.splashHit(p, e);
        else this.hitEnemy(e, p.dmg);
        this.spawnParticles(p.x, p.y, 5, p.color, 130, 0.25, true);
        p.active = false;
        break;
      }
    }
  },

  /* ---------------- Частицы ---------------- */
  spawnParticles: function (x, y, count, color, speed, life, fanUp) {
    for (var i = 0; i < count; i++) {
      var p = null;
      for (var j = 0; j < this.particles.length; j++) {
        if (!this.particles[j].active) { p = this.particles[j]; break; }
      }
      if (!p) { p = {}; this.particles.push(p); }
      var a = fanUp
        ? (-Math.PI / 2 + (Math.random() - 0.5) * 1.5)
        : (Math.random() * Math.PI * 2);
      var v = speed * (0.5 + Math.random() * 0.6);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = life; p.maxLife = life;
      p.color = color;
      p.size = Grid.cell * (0.025 + Math.random() * 0.025);
    }
  },

  stepParticles: function (dt) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;     // лёгкая гравитация — частицы оседают
    }
  },

  /* Урон врагу с учётом ауры щитоносца */
  hitEnemy: function (e, amount) {
    if (e.guarded) amount *= e.guarded;
    if (Enemies.hurt(e, amount)) { this.killEnemy(e); return true; }
    return false;
  },

  /* Мортира: взрыв по площади вокруг точки попадания */
  splashHit: function (p, target) {
    var r = p.splash * Grid.cell;
    var tx = Enemies.centerX(target, Grid.cell), ty = target.y;
    Sound.play('mine');
    this.spawnParticles(tx, ty, 8, p.color, 200, 0.35, false);
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead || e.phased) continue;
      var dx = Enemies.centerX(e, Grid.cell) - tx, dy = e.y - ty;
      if (Math.sqrt(dx * dx + dy * dy) <= r) this.hitEnemy(e, p.dmg);
    }
  },

  /* Ауры: ревун разгоняет соседей, щитоносец режет им получаемый урон */
  stepAuras: function () {
    var cell = Grid.cell;
    var i, j, e;
    for (i = 0; i < this.enemies.length; i++) {
      this.enemies[i].hasted = false;
      this.enemies[i].guarded = false;
    }
    for (i = 0; i < this.enemies.length; i++) {
      var src = this.enemies[i];
      if (src.dead || src.y < 0) continue;
      if (!src.def.auraSpeed && !src.def.auraGuard) continue;
      var reach = src.def.auraRange * cell;
      var sx = Enemies.centerX(src, cell);
      for (j = 0; j < this.enemies.length; j++) {
        e = this.enemies[j];
        if (e === src || e.dead) continue;
        var dx = Enemies.centerX(e, cell) - sx, dy = e.y - src.y;
        if (Math.sqrt(dx * dx + dy * dy) > reach) continue;
        if (src.def.auraSpeed) e.hasted = src.def.auraSpeed;
        if (src.def.auraGuard) e.guarded = src.def.auraGuard;
      }
    }
  },

  /* ---------------- Механики планет ----------------
     Пустоши: часть клеток выжжена и застроить их нельзя. Раскладка
     детерминированная — переигрывать уровень с новой картой было бы нечестно.
     В колонке не больше двух кратеров, крайние ряды не трогаем: иначе
     колонку нечем было бы закрыть. */
  placeCraters: function (n) {
    if (!n) return;
    var rand = rng(this.levelId * 104729 + 7);
    var perCol = [];
    for (var c = 0; c < Grid.cols; c++) perCol.push(0);
    var placed = 0, guard = 0;
    while (placed < n && guard++ < 400) {
      var col = Math.floor(rand() * Grid.cols);
      var row = 1 + Math.floor(rand() * (Grid.rows - 2));
      if (perCol[col] >= 2 || Grid.isBlocked(col, row)) continue;
      Grid.blocked[Grid.idx(col, row)] = true;
      perCol[col]++;
      placed++;
    }
  },

  /* Джунгли: часть клеток заросла. Строить нельзя, пока не расчистишь тапом —
     это бесплатно, но стоит времени в самый неподходящий момент. */
  placeVines: function (n) {
    if (!n) return;
    var rand = rng(this.levelId * 31337 + 11);
    var perCol = [];
    for (var c = 0; c < Grid.cols; c++) perCol.push(0);
    var placed = 0, guard = 0;
    while (placed < n && guard++ < 400) {
      var col = Math.floor(rand() * Grid.cols);
      var row = 1 + Math.floor(rand() * (Grid.rows - 1));
      if (perCol[col] >= 2 || Grid.isVine(col, row) || Grid.isBlocked(col, row)) continue;
      Grid.vines[Grid.idx(col, row)] = true;
      perCol[col]++;
      placed++;
    }
  },

  /* Рудник: по ходу боя своды обваливаются и отнимают пустые клетки.
     Занятые не трогаем — терять построенное из-за случайности нечестно. */
  stepCollapse: function (dt) {
    var every = this.level.collapseEvery;
    if (!every || this.phase !== 'wave' || this.over) return;
    this.collapseT -= dt;
    if (this.collapseT > 0) return;
    this.collapseT = every;

    var free = [];
    for (var r = 1; r < Grid.rows; r++) {
      for (var c = 0; c < Grid.cols; c++) {
        if (Grid.isFree(c, r)) free.push([c, r]);
      }
    }
    if (free.length <= Grid.cols) return;        // совсем зажимать поле не будем

    var pick = free[Math.floor(Math.random() * free.length)];
    Grid.blocked[Grid.idx(pick[0], pick[1])] = true;
    Sound.play('mine');
    this.spawnParticles(Grid.centerX(pick[0]), Grid.centerY(pick[1]), 8, PAL.ash, 160, 0.4, false);
    UI.toast('Обвал');
  },

  /* Улей: споры оседают на защитнике и вдвое сбивают ему темп.
     Сами выветриваются — в отличие от льда тапать не нужно. */
  stepSpores: function (dt) {
    var every = this.level.sporeEvery;
    if (!every || this.phase !== 'wave' || this.over) return;
    this.sporeT -= dt;
    if (this.sporeT > 0) return;
    this.sporeT = every;

    var list = [];
    Grid.each(function (u) { if (!u.spored && u.def.fireRate) list.push(u); });
    if (!list.length) return;

    var victim = list[Math.floor(Math.random() * list.length)];
    victim.spored = CONFIG.sporeTime;
    this.spawnParticles(Grid.centerX(victim.col), Grid.centerY(victim.row), 6, '#84CC16', 120, 0.4, false);
  },

  /* Станция: раз в несколько секунд случайный защитник покрывается льдом
     и замолкает. Тап отогревает мгновенно, сам оттаивает за iceThaw. */
  stepIce: function (dt) {
    var every = this.level.iceEvery;
    if (!every || this.phase !== 'wave' || this.over) return;
    this.iceT -= dt;
    if (this.iceT > 0) return;
    this.iceT = every;

    var list = [];
    Grid.each(function (u) { if (!u.frozen && u.type !== 'mine') list.push(u); });
    if (!list.length) return;

    var victim = list[Math.floor(Math.random() * list.length)];
    victim.frozen = CONFIG.iceThaw;
    Sound.play('freeze');
    this.spawnParticles(Grid.centerX(victim.col), Grid.centerY(victim.row), 6, PAL.ice, 130, 0.35, false);
  },

  /* Заросшие клетки: решётка из лиан поверх фона */
  drawVines: function (ctx, cell) {
    if (!Grid.vines.length) return;
    ctx.save();
    for (var r = 0; r < Grid.rows; r++) {
      for (var c = 0; c < Grid.cols; c++) {
        if (!Grid.vines[Grid.idx(c, r)]) continue;
        var x = c * cell, y = r * cell;
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#65A30D';
        Draw.roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 8);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#84CC16';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var i = 1; i <= 3; i++) {
          var t = i / 4;
          ctx.moveTo(x + cell * t, y + 4);
          ctx.lineTo(x + cell * t, y + cell - 4);
          ctx.moveTo(x + 4, y + cell * t);
          ctx.lineTo(x + cell - 4, y + cell * t);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  /* Выжженные клетки */
  drawCraters: function (ctx, cell) {
    if (!Grid.blocked.length) return;
    ctx.save();
    for (var r = 0; r < Grid.rows; r++) {
      for (var c = 0; c < Grid.cols; c++) {
        if (!Grid.blocked[Grid.idx(c, r)]) continue;
        var x = c * cell, y = r * cell;
        ctx.fillStyle = PAL.bgDeep;
        ctx.globalAlpha = 0.75;
        Draw.roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 8);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = PAL.ash;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Трещины
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(x + cell * 0.28, y + cell * 0.30); ctx.lineTo(x + cell * 0.72, y + cell * 0.70);
        ctx.moveTo(x + cell * 0.70, y + cell * 0.32); ctx.lineTo(x + cell * 0.32, y + cell * 0.68);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  /* ---------------- Экономика ----------------
     Единая точка прихода искр: и счётчик, и всплывающее число над полем. */
  gain: function (amount, x, y, silent) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    this.sparks += amount;
    this.collected += amount;
    if (!silent) {
      this.popups.push({
        x: Math.max(Grid.cell * 0.4, Math.min(Grid.w - Grid.cell * 0.4, x)),
        y: y, t: 0, dur: 0.9, text: '+' + amount
      });
      UI.popSparks();
    }
    this.syncHud();
  },

  /* Базовый ручеёк: медленный, но не даёт партии зависнуть насмерть.
     В паузе между волнами не капает — передышка не должна быть фермой. */
  stepTrickle: function (dt) {
    if (this.over || this.phase !== 'wave') return;
    this.trickleAcc += CONFIG.trickle * dt;
    if (this.trickleAcc >= 1) {
      var whole = Math.floor(this.trickleAcc);
      this.trickleAcc -= whole;
      this.sparks += whole;
      this.collected += whole;
      this.syncHud();
    }
  },

  stepPopups: function (dt) {
    for (var i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].t += dt;
      if (this.popups[i].t >= this.popups[i].dur) this.popups.splice(i, 1);
    }
  },

  /* ---------------- Искры на поле ---------------- */
  dropSpark: function (x, y, amount) {
    this.drops.push({
      x: Math.max(Grid.cell * 0.3, Math.min(Grid.w - Grid.cell * 0.3, x)),
      y: Math.max(Grid.cell * 0.3, Math.min(Grid.h - Grid.cell * 0.3, y)),
      amount: amount,
      t: CONFIG.sparkLife,
      phase: Math.random() * Math.PI * 2
    });
  },

  stepDrops: function (dt) {
    for (var i = this.drops.length - 1; i >= 0; i--) {
      var d = this.drops[i];
      d.t -= dt;
      d.born = Math.min(1, (d.born || 0) + dt / 0.25);
      // Не подобранная искра не пропадает, а сама улетает в счётчик:
      // тап ускоряет доход, но зевок больше не штрафует.
      if (d.t <= CONFIG.autoCollect) this.collectSpark(i, true);
    }
  },

  collectSpark: function (idx, silent) {
    var d = this.drops[idx];
    this.flights.push({ x0: d.x, y0: d.y, t: 0, dur: 0.4, amount: d.amount });
    this.drops.splice(idx, 1);
    if (!silent) { Sound.play('pick'); TG.haptic('light'); }
    this.gain(d.amount, d.x, d.y);
  },

  stepFlights: function (dt) {
    for (var i = this.flights.length - 1; i >= 0; i--) {
      this.flights[i].t += dt;
      if (this.flights[i].t >= this.flights[i].dur) this.flights.splice(i, 1);
    }
  },

  /* ---------------- Волны ---------------- */
  stepWaves: function (dt) {
    if (this.over) return;

    if (this.phase === 'prep') {
      this.prepT -= dt;
      UI.updateBanner(this);
      if (this.prepT <= 0) this.startWave();
      return;
    }

    if (this.phase === 'wave') {
      this.waveT += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveT) {
        this.spawnEnemy(this.spawnQueue.shift());
      }
      if (!this.spawnQueue.length && !this.enemies.length) this.waveCleared();
    }
  },

  startWave: function () {
    this.phase = 'wave';
    this.waveT = 0;
    UI.updateBanner(this);
    Sound.play('wave');

    var w = this.endless
      ? Waves.endlessWave(this.waveIndex + 1)
      : this.level.waves[this.waveIndex];
    this.spawnQueue = w.enemies.slice().map(function (e) {
      return { type: e.type, t: e.t, col: e.col, hpMul: e.hpMul };
    });
    this.syncHud();
  },

  waveCleared: function () {
    // Награда за зачищенную волну — растёт вместе с её номером
    var bonus = CONFIG.waveBonusBase + CONFIG.waveBonusPerWave * this.waveIndex;
    this.gain(bonus, Grid.w / 2, Grid.h * 0.42);
    this.waveIndex++;
    if (this.endless) {
      this.level.hpScale = 1 + this.waveIndex * 0.07;   // давление растёт прочностью
      Storage.setEndlessBest(this.waveIndex);
      this.phase = 'prep';
      this.prepT = CONFIG.prepTime;
      this.syncHud();
      return;
    }
    if (this.waveIndex >= this.level.waves.length) { this.finish(true); return; }
    this.phase = 'prep';
    this.prepT = CONFIG.prepTime;
    this.syncHud();
  },

  spawnEnemy: function (spec) {
    var width = (ENEMY_TYPES[spec.type].width || 1);
    var col;
    if (spec.col === 'random' || spec.col === undefined) {
      col = Math.floor(Math.random() * (Grid.cols - width + 1));
    } else {
      col = Math.max(0, Math.min(Grid.cols - width, spec.col));
    }
    // Босс уже усилен своим hpMul в конфиге волны — шкалу уровня к нему
    // не применяем, иначе финальная волна превращается в долгий обстрел мешка.
    var scale = ENEMY_TYPES[spec.type].boss ? 1 : (this.level.hpScale || 1);
    var mul = (spec.hpMul || 1) * scale;
    var e = Enemies.create(spec.type, col, { hpMul: mul });
    e.y = -Grid.cell * (0.5 + Math.random() * 0.3);
    this.enemies.push(e);
  },

  /* Кнопка «начать раньше»: бонус тем больше, чем раньше нажал */
  startEarly: function () {
    if (this.phase !== 'prep' || this.over) return;
    var bonus = Math.max(0, Math.round(this.prepT) * CONFIG.earlyBonusPerSec);
    this.sparks += bonus;
    this.collected += bonus;
    this.prepT = 0;
    UI.popSparks();
    UI.toast('+' + bonus + ' искр за смелость');
    this.startWave();
    this.syncHud();
  },

  /* ---------------- Итог уровня ---------------- */
  finish: function (won) {
    if (this.over) return;
    this.over = true;
    this.selected = null;
    this.closeUnitMenu();
    UI.updateBanner(this);

    var stars = 0;
    if (won) {
      stars = this.lives >= 3 ? 3 : (this.lives === 2 ? 2 : 1);
      Sound.play('win');
      TG.haptic('success');
      if (!this.endless) Storage.completeLevel(this.levelId, stars);
    } else {
      Sound.play('lose');
      TG.haptic('error');
    }
    Storage.addStats(this.kills, this.collected);
    UI.showResult(this, won, stars);
  },

  /* ---------------- Ввод ---------------- */
  onPointer: function (clientX, clientY) {
    if (this.paused || this.over) return;
    Sound.resume();

    var rect = this.canvas.getBoundingClientRect();
    var x = (clientX - rect.left) * (Grid.w / rect.width);
    var y = (clientY - rect.top) * (Grid.h / rect.height);

    // 1. Искра под пальцем — приоритетнее всего
    var grab = Grid.cell * 0.42;
    for (var i = this.drops.length - 1; i >= 0; i--) {
      var d = this.drops[i];
      if (Math.abs(d.x - x) < grab && Math.abs(d.y - y) < grab) { this.collectSpark(i); return; }
    }

    var c = Grid.cellAt(x, y);
    if (!c) { this.deselect(); this.closeUnitMenu(); return; }

    // Заросли расчищаются тапом — бесплатно, но занимает ход
    if (Grid.isVine(c.col, c.row)) {
      Grid.vines[Grid.idx(c.col, c.row)] = false;
      Sound.play('pick');
      TG.haptic('light');
      this.spawnParticles(Grid.centerX(c.col), Grid.centerY(c.row), 8, '#65A30D', 150, 0.35, false);
      return;
    }

    // Лёд снимается тапом и всегда важнее любого другого действия по клетке
    var chilled = Grid.get(c.col, c.row);
    if (chilled && chilled.frozen > 0) {
      chilled.frozen = 0;
      Sound.play('pick');
      TG.haptic('light');
      this.spawnParticles(Grid.centerX(c.col), Grid.centerY(c.row), 7, PAL.ice, 140, 0.3, false);
      return;
    }

    if (this.menuUnit) { this.closeUnitMenu(); return; }

    // 2. Выбрана карточка — ставим юнита
    if (this.selected) { this.place(c.col, c.row); return; }

    // 3. Тап по установленному юниту — меню продажи/улучшения
    var u = Grid.get(c.col, c.row);
    if (u) this.openUnitMenu(u);
  },

  selectCard: function (typeId) {
    if (this.over || this.paused) return;
    this.closeUnitMenu();
    if (this.selected === typeId) { this.deselect(); return; }
    var def = UNIT_TYPES[typeId];
    if (this.cardCd[typeId] > 0 || this.sparks < def.cost) {
      UI.shakeCard(typeId);
      Sound.play('deny');
      return;
    }
    this.selected = typeId;
    UI.setSelected(typeId);
  },

  deselect: function () {
    this.selected = null;
    UI.setSelected(null);
  },

  place: function (col, row) {
    var now = Date.now();
    if (now - this.lastPlaceTs < CONFIG.placeDebounce) return;   // защита от двойного тапа
    var typeId = this.selected;
    if (!typeId) return;
    var def = UNIT_TYPES[typeId];

    if (!Grid.isFree(col, row)) { UI.toast('Клетка занята'); return; }
    if (this.sparks < def.cost) { UI.shakeCard(typeId); Sound.play('deny'); this.deselect(); return; }

    this.lastPlaceTs = now;
    var u = Units.create(typeId, col, row);
    u.spawnT = 0;
    Grid.set(col, row, u);
    this.sparks -= def.cost;
    this.cardCd[typeId] = def.cooldown;
    this.deselect();
    Sound.play('place');
    TG.haptic('light');
    this.syncHud();
    UI.refreshCards(this);
  },

  openUnitMenu: function (u) {
    this.menuUnit = u;
    UI.showUnitMenu(this, u);
  },

  closeUnitMenu: function () {
    if (!this.menuUnit) { UI.showUnitMenu(this, null); return; }
    this.menuUnit = null;
    UI.showUnitMenu(this, null);
  },

  sellUnit: function (u) {
    var back = Units.sellPrice(u);
    this.sparks += back;
    u.dead = true;
    Grid.set(u.col, u.row, null);
    this.spawnParticles(Grid.centerX(u.col), Grid.centerY(u.row), 6, PAL.spark, 140, 0.3, false);
    this.closeUnitMenu();
    Sound.play('pick');
    UI.popSparks();
    UI.toast('+' + back + ' искр');
    this.syncHud();
  },

  /* Сколько ступеней улучшения доступно: третья открыта только
     на Ледяной станции и в бесконечном режиме. */
  maxTier: function () {
    return (this.endless || (this.level && this.level.planet === 3)) ? 3 : 2;
  },

  upgradeUnit: function (u) {
    var cost = Units.upgradeCost(u);
    if (!Units.canUpgrade(u, this.maxTier()) || this.sparks < cost) { Sound.play('deny'); return; }
    this.sparks -= cost;
    Units.upgrade(u);
    Sound.play('place');
    TG.haptic('medium');
    this.syncHud();
    // Меню не закрываем: игрок может улучшить дальше, не переоткрывая его
    if (this.menuUnit === u) UI.showUnitMenu(this, u);
  },

  syncHud: function () {
    UI.setSparks(this.sparks);
    UI.setLives(this.lives, CONFIG.lives);
    var total = this.endless ? '∞' : this.level.waves.length;
    var shown = Math.min(this.waveIndex + 1, this.endless ? 9999 : this.level.waves.length);
    UI.setWave(shown, total);
    UI.refreshCards(this);
  },

  /* ======================================================================
     ОТРИСОВКА
     ====================================================================== */
  render: function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var cell = Grid.cell, W = Grid.w, H = Grid.h, k = cell / 64;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Тряска поля при потере жизни
    if (this.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * 4 * this.shake, (Math.random() * 2 - 1) * 4 * this.shake);
    }

    // Корпус: поле — скруглённый прямоугольник, всё рисуем внутри него
    ctx.fillStyle = PAL.bgField;
    Draw.roundRect(ctx, 0, 0, W, H, 16);
    ctx.fill();
    ctx.save();
    Draw.roundRect(ctx, 0, 0, W, H, 16);
    ctx.clip();

    this.drawGrid(ctx, cell, W, H);
    this.drawCraters(ctx, cell);
    this.drawVines(ctx, cell);
    this.drawFog(ctx, W, H);
    this.drawPlacementHint(ctx, cell);
    this.drawUnits(ctx, cell, k);
    this.drawDrops(ctx, k);
    this.drawEnemies(ctx, cell);
    this.drawProjectiles(ctx, k);
    this.drawParticles(ctx);
    this.drawFlights(ctx, k);
    this.drawPopups(ctx, k);
    this.drawVignette(ctx, W, H, k);
    this.drawDefenseLine(ctx, W, H, k, cell);

    // Красная вспышка по краям при потере жизни
    if (this.edgeFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.edgeFlash * 0.55;
      ctx.strokeStyle = PAL.danger;
      ctx.lineWidth = 6 * k;
      Draw.roundRect(ctx, 3 * k, 3 * k, W - 6 * k, H - 6 * k, 14);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  },

  drawGrid: function (ctx, cell, W, H) {
    ctx.save();
    ctx.strokeStyle = PAL.gridLine;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (var c = 1; c < Grid.cols; c++) { ctx.moveTo(c * cell, 0); ctx.lineTo(c * cell, H); }
    for (var r = 1; r < Grid.rows; r++) { ctx.moveTo(0, r * cell); ctx.lineTo(W, r * cell); }
    ctx.stroke();
    ctx.restore();
  },

  /* Туман: три больших размытых пятна, медленно дрейфующих по горизонтали */
  drawFog: function (ctx, W, H) {
    var t = this.time;
    var spots = [
      { p: 20, a: 0.04, y: 0.72, rx: 0.55, ry: 0.16, ph: 0 },
      { p: 27, a: 0.03, y: 0.85, rx: 0.70, ry: 0.13, ph: 2.1 },
      { p: 24, a: 0.035, y: 0.62, rx: 0.45, ry: 0.11, ph: 4.2 }
    ];
    ctx.save();
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var x = W * (0.5 + 0.35 * Math.sin(t * 2 * Math.PI / s.p + s.ph));
      var y = H * s.y;
      var rx = W * s.rx, ry = H * s.ry;
      var gr = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      gr.addColorStop(0, 'rgba(96,165,250,' + s.a + ')');
      gr.addColorStop(1, 'rgba(96,165,250,0)');
      ctx.fillStyle = gr;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / Math.max(rx, ry));
      ctx.translate(-x, -y);
      Draw.circle(ctx, x, y, Math.max(rx, ry));
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  /* Подсветка свободных клеток, когда выбрана карточка */
  drawPlacementHint: function (ctx, cell) {
    if (!this.selected) return;
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 4);
    ctx.strokeStyle = UNIT_TYPES[this.selected].color;
    ctx.lineWidth = 1;
    for (var r = 0; r < Grid.rows; r++) {
      for (var c = 0; c < Grid.cols; c++) {
        if (!Grid.isFree(c, r)) continue;
        Draw.roundRect(ctx, c * cell + 4, r * cell + 4, cell - 8, cell - 8, 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  drawUnits: function (ctx, cell, k) {
    // Мины лежат «под» остальными объектами
    Grid.each(function (u, c, r) {
      if (u.type !== 'mine') return;
      Units.draw(ctx, Grid.centerX(c), Grid.centerY(r), cell, u.type, {
        level: u.level, flash: u.flash, hurt: u.hurt > 0,
        scale: Game.placeScale(u), time: Game.time
      });
    });
    Grid.each(function (u, c, r) {
      if (u.type === 'mine') return;
      Units.draw(ctx, Grid.centerX(c), Grid.centerY(r), cell, u.type, {
        level: u.level, flash: u.flash, hurt: u.hurt > 0, time: Game.time,
        frozen: u.frozen > 0, spored: u.spored > 0,
        hp: u.hp, maxHp: u.maxHp, scale: Game.placeScale(u)
      });
    });

    // Рамка вокруг юнита с открытым меню
    if (this.menuUnit && !this.menuUnit.dead) {
      var u2 = this.menuUnit;
      ctx.save();
      ctx.strokeStyle = PAL.textMain;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1;
      Draw.roundRect(ctx, u2.col * cell + 3, u2.row * cell + 3, cell - 6, cell - 6, 9);
      ctx.stroke();
      ctx.restore();
    }
  },

  /* Появление юнита: scale 0.8 -> 1.0 с лёгким перелётом */
  placeScale: function (u) {
    if (u.spawnT >= 1) return 1;
    var t = u.spawnT;
    var back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    return 0.8 + 0.2 * back;
  },

  drawEnemies: function (ctx, cell) {
    for (var i = 0; i < this.enemies.length; i++) {
      Enemies.draw(ctx, this.enemies[i], cell, this.time);
    }
  },

  drawProjectiles: function (ctx, k) {
    ctx.save();
    for (var i = 0; i < this.projectiles.length; i++) {
      var p = this.projectiles[i];
      if (!p.active) continue;
      ctx.fillStyle = p.color;
      // След: два уменьшающихся круга позади — дешёвая иллюзия скорости
      ctx.globalAlpha = 0.25; Draw.circle(ctx, p.x, p.trail[1], 0.8 * k); ctx.fill();
      ctx.globalAlpha = 0.5;  Draw.circle(ctx, p.x, p.trail[0], 1.2 * k); ctx.fill();
      ctx.globalAlpha = 1;    Draw.circle(ctx, p.x, p.y, 2 * k); ctx.fill();
    }
    ctx.restore();
  },

  drawParticles: function (ctx) {
    ctx.save();
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      Draw.circle(ctx, p.x, p.y, p.size);
      ctx.fill();
    }
    ctx.restore();
  },

  /* Искра на поле — единственное, что игрок должен замечать мгновенно,
     поэтому она крупная, с пульсирующим ореолом и появляется с отскоком. */
  drawDrops: function (ctx, k) {
    ctx.save();
    for (var i = 0; i < this.drops.length; i++) {
      var d = this.drops[i];
      var bob = Math.sin(this.time * Math.PI + d.phase) * CONFIG.sparkBob * k;
      var pulse = 0.5 + 0.5 * Math.sin(this.time * 3.4 + d.phase);
      var a = 1;
      if (d.t < CONFIG.sparkBlink) a = 0.45 + 0.55 * Math.abs(Math.sin(d.t * 9));

      // Появление с отскоком
      var born = d.born === undefined ? 1 : d.born;
      var pop = born < 1
        ? 0.4 + 0.6 * (1 + 2.2 * Math.pow(born - 1, 3) + 1.2 * Math.pow(born - 1, 2))
        : 1;

      ctx.save();
      ctx.translate(d.x, d.y + bob);
      ctx.scale(pop, pop);

      // Внешний ореол — дышит
      ctx.fillStyle = PAL.spark;
      ctx.globalAlpha = a * (0.10 + 0.08 * pulse);
      Draw.circle(ctx, 0, 0, (11 + 2 * pulse) * k); ctx.fill();
      ctx.globalAlpha = a * 0.22;
      Draw.circle(ctx, 0, 0, 8.5 * k); ctx.fill();

      // Тело монеты
      ctx.globalAlpha = a;
      Draw.circle(ctx, 0, 0, 6 * k); ctx.fill();

      // Тёмное кольцо и блик — чтобы читалась монетой, а не пятном
      ctx.strokeStyle = PAL.bgDeep;
      ctx.lineWidth = 1.4 * k;
      Draw.circle(ctx, 0, 0, 3.2 * k); ctx.stroke();
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = '#FFE0A8';
      Draw.circle(ctx, -1.8 * k, -2.2 * k, 1.2 * k); ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  },

  /* Всплывающие числа прихода: видно, за что именно капнуло */
  drawPopups: function (ctx, k) {
    if (!this.popups.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 ' + Math.round(12 * k) +
      'px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
    for (var i = 0; i < this.popups.length; i++) {
      var p = this.popups[i];
      var t = p.t / p.dur;
      ctx.globalAlpha = t < 0.15 ? t / 0.15 : (1 - (t - 0.15) / 0.85);
      var py = p.y - 26 * k * t;
      // Тёмная обводка: без неё янтарное число тонет в светлых частицах
      ctx.lineWidth = 3 * k;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = PAL.bgDeep;
      ctx.strokeText(p.text, p.x, py);
      ctx.fillStyle = PAL.spark;
      ctx.fillText(p.text, p.x, py);
    }
    ctx.restore();
  },

  /* Полёт собранной искры к счётчику по кривой Безье */
  drawFlights: function (ctx, k) {
    ctx.save();
    for (var i = 0; i < this.flights.length; i++) {
      var f = this.flights[i];
      var t = f.t / f.dur;
      var x1 = 14, y1 = -6;
      var cx = f.x0 * 0.3, cy = Math.min(f.y0, 0) - Grid.cell;
      var mt = 1 - t;
      var x = mt * mt * f.x0 + 2 * mt * t * cx + t * t * x1;
      var y = mt * mt * f.y0 + 2 * mt * t * cy + t * t * y1;
      ctx.globalAlpha = 1 - t * 0.5;
      ctx.fillStyle = PAL.spark;
      Draw.circle(ctx, x, y, 3 * k * (1 - t * 0.4));
      ctx.fill();
    }
    ctx.restore();
  },

  /* Виньетка: поле уходит в темноту сверху и снизу */
  drawVignette: function (ctx, W, H, k) {
    var top = 20 * k, bot = 20 * k;
    var g1 = ctx.createLinearGradient(0, 0, 0, top);
    g1.addColorStop(0, 'rgba(10,14,20,0.5)');
    g1.addColorStop(1, 'rgba(10,14,20,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, top);

    var g2 = ctx.createLinearGradient(0, H, 0, H - bot);
    g2.addColorStop(0, 'rgba(10,14,20,0.4)');
    g2.addColorStop(1, 'rgba(10,14,20,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, H - bot, W, bot);
  },

  /* Рубеж обороны: линия + подложка, пульсирует при угрозе прорыва */
  drawDefenseLine: function (ctx, W, H, k, cell) {
    var threat = false;
    for (var i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].y > H - CONFIG.breachPulseCells * cell) { threat = true; break; }
    }
    var alpha = 0.18;
    if (threat) alpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(this.time * 2 * Math.PI / 0.6));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PAL.danger;
    ctx.fillRect(0, H - 6 * k, W, 6 * k);
    ctx.globalAlpha = 1;
    ctx.fillRect(0, H - 2 * k, W, 2 * k);
    ctx.restore();
  }
};
