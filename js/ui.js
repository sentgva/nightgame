/* ui.js — экраны, панели, карточки, модалки.
   Канвас отвечает только за поле; всё остальное — обычный DOM. */

var UI = {
  el: {},
  cards: {},          // typeId -> { root, cd, locked }
  unlocked: [],
  toastTimer: 0,
  tutStep: 0,
  pendingTutorial: false,

  init: function () {
    var $ = function (id) { return document.getElementById(id); };
    this.el = {
      app: $('app'),
      screens: {
        menu: $('screen-menu'),
        levels: $('screen-levels'),
        codex: $('screen-codex'),
        game: $('screen-game')
      },
      sparkCount: $('spark-count'),
      hudSparks: $('hud-sparks'),
      waveCount: $('wave-count'),
      lives: $('lives'),
      dock: $('dock'),
      banner: $('wave-banner'),
      bannerText: $('wave-banner-text'),
      btnEarly: $('btn-early'),
      unitMenu: $('unit-menu'),
      toast: $('toast'),
      fieldWrap: $('field-wrap'),
      canvas: $('field'),
      overlayPause: $('overlay-pause'),
      overlayResult: $('overlay-result'),
      overlayTutorial: $('overlay-tutorial'),
      resultTitle: $('result-title'),
      resultStars: $('result-stars'),
      resultStats: $('result-stats'),
      levelList: $('level-list'),
      levelsTitle: $('levels-title'),
      planetView: $('planet-view'),
      planetCanvas: $('planet-canvas'),
      planetTitle: $('planet-title'),
      planetSub: $('planet-sub'),
      planetDesc: $('planet-desc'),
      planetProgress: $('planet-progress'),
      planetDots: $('planet-dots'),
      planetOpen: $('planet-open'),
      codexList: $('codex-list'),
      menuNote: $('menu-note'),
      btnEndless: $('btn-endless'),
      btnSound: $('btn-sound'),
      btnPause: $('btn-pause'),
      rotate: $('rotate-blocker'),
      tutStep: $('tut-step'),
      tutTitle: $('tut-title'),
      tutText: $('tut-text')
    };

    this.drawMenuMark();
    this.bindMenu();
    this.bindPlanets();
    this.bindGameChrome();
    this.bindOverlays();
    this.syncSoundButton();
  },

  /* ---------------- Экраны ---------------- */
  show: function (name) {
    for (var key in this.el.screens) {
      this.el.screens[key].classList.toggle('active', key === name);
    }
    if (name === 'menu') this.refreshMenu();
    if (name === 'levels') this.showPlanets();
    if (name === 'codex') this.buildCodex();
  },

  /* Знак на главном экране: рубеж, за которым свет */
  drawMenuMark: function () {
    var cv = document.getElementById('menu-mark-canvas');
    if (!cv) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = 120 * dpr; cv.height = 120 * dpr;
    cv.style.width = '120px'; cv.style.height = '120px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Два врага сверху, защитник снизу, рубеж между ними
    ctx.fillStyle = PAL.fillEnemy;
    Draw.roundRect(ctx, 28, 14, 22, 22, 5); ctx.fill();
    ctx.strokeStyle = PAL.gridLine; ctx.lineWidth = 1; ctx.stroke();
    Draw.roundRect(ctx, 70, 24, 22, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.enemy;
    Draw.circle(ctx, 35, 23, 1.6); ctx.fill();
    Draw.circle(ctx, 43, 23, 1.6); ctx.fill();
    Draw.circle(ctx, 77, 33, 1.6); ctx.fill();
    Draw.circle(ctx, 85, 33, 1.6); ctx.fill();

    Units.draw(ctx, 60, 74, 46, 'shooter', { level: 1, flash: 0 });

    ctx.globalAlpha = 0.18; ctx.fillStyle = PAL.danger;
    ctx.fillRect(10, 100, 100, 6);
    ctx.globalAlpha = 1;
    ctx.fillRect(10, 102, 100, 2);
  },

  bindMenu: function () {
    var self = this;
    document.getElementById('btn-play').addEventListener('click', function () {
      Sound.resume();
      Main.playLevel(Storage.data.maxLevel);
    });
    document.getElementById('btn-levels').addEventListener('click', function () { self.show('levels'); });
    document.getElementById('btn-codex').addEventListener('click', function () { self.show('codex'); });
    document.getElementById('btn-codex-back').addEventListener('click', function () { self.show('menu'); });
    // Назад с экрана уровней возвращает к планетам, и только потом в меню
    document.getElementById('btn-levels-back').addEventListener('click', function () {
      if (self.el.planetView.classList.contains('hidden')) self.showPlanets();
      else self.show('menu');
    });
    this.el.btnEndless.addEventListener('click', function () {
      Sound.resume();
      Main.playEndless();
    });
    document.getElementById('btn-reset').addEventListener('click', function () {
      if (window.confirm('Сбросить весь прогресс?')) {
        Storage.reset();
        self.refreshMenu();
      }
    });
  },

  refreshMenu: function () {
    var d = Storage.data;
    var name = TG.userName();
    var note = 'Открыто уровней: ' + Math.min(d.maxLevel, Waves.total) + ' из ' + Waves.total;
    if (d.campaignDone) note = 'Кампания пройдена';
    if (d.endlessBest) note += ' · рекорд: ' + d.endlessBest + ' волн';
    if (!Storage.available) note += ' · прогресс не сохраняется';
    if (name) note = name + ', ' + note.charAt(0).toLowerCase() + note.slice(1);
    this.el.menuNote.textContent = note + ' · v' + APP_VERSION;
    this.el.btnEndless.hidden = !d.campaignDone;
  },

  /* ======================================================================
     ПЛАНЕТЫ
     Карусель из трёх шаров: стрелки и свайп листают, перетаскивание крутит,
     тап открывает список уровней планеты.
     ====================================================================== */
  planetIndex: 0,
  planetAngle: 0,
  planetSpin: 0,
  planetRaf: 0,
  planetLast: 0,
  planetSize: 220,
  planetCtx: null,

  showPlanets: function () {
    this.el.planetView.classList.remove('hidden');
    this.el.levelList.classList.add('hidden');
    this.el.levelsTitle.textContent = 'Планеты';
    this.syncPlanet();
    this.startPlanetLoop();
  },

  planetLocked: function (planet) {
    return Waves.firstOfPlanet(planet.id) > Storage.data.maxLevel;
  },

  syncPlanet: function () {
    var p = PLANETS[this.planetIndex];
    var d = Storage.data;
    var levels = Waves.ofPlanet(p.id);
    var locked = this.planetLocked(p);
    var got = 0;
    for (var i = 0; i < levels.length; i++) got += (d.stars[levels[i].id] || 0);

    this.el.planetTitle.textContent = p.name;
    this.el.planetSub.textContent = 'Акт ' + p.act + ' · ' + p.sub;
    this.el.planetDesc.textContent = locked
      ? 'Откроется, когда пройдёшь предыдущую планету'
      : p.desc;
    this.el.planetProgress.textContent = locked
      ? 'Заблокирована'
      : got + ' из ' + (levels.length * 3) + ' звёзд · ' + levels.length + ' уровней';
    this.el.planetProgress.classList.toggle('locked', locked);
    this.el.planetOpen.style.opacity = locked ? '.4' : '1';

    var dots = this.el.planetDots;
    dots.innerHTML = '';
    for (var j = 0; j < PLANETS.length; j++) {
      var dot = document.createElement('i');
      if (j === this.planetIndex) dot.className = 'on';
      dots.appendChild(dot);
    }
  },

  planetGo: function (dir) {
    this.planetIndex = (this.planetIndex + dir + PLANETS.length) % PLANETS.length;
    this.planetSpin = dir * 4;        // подкрутка в сторону листания
    this.syncPlanet();
  },

  bindPlanets: function () {
    var self = this;
    document.getElementById('planet-prev').addEventListener('click', function () { self.planetGo(-1); });
    document.getElementById('planet-next').addEventListener('click', function () { self.planetGo(1); });
    this.el.planetOpen.addEventListener('click', function () { self.openPlanetLevels(); });

    var cv = this.el.planetCanvas;
    var dragging = false, lastX = 0, total = 0;
    var down = function (x) { dragging = true; lastX = x; total = 0; };
    var move = function (x) {
      if (!dragging) return;
      var dx = x - lastX; lastX = x; total += dx;
      self.planetAngle -= dx * 0.012;
      self.planetSpin = -dx * 0.5;
    };
    var up = function () {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(total) < 8) self.openPlanetLevels();      // тап
      else if (total < -60) self.planetGo(1);                // свайп влево
      else if (total > 60) self.planetGo(-1);
    };

    if (window.PointerEvent) {
      cv.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) {} }
        down(e.clientX);
      });
      cv.addEventListener('pointermove', function (e) { move(e.clientX); });
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
    } else {
      cv.addEventListener('touchstart', function (e) { down(e.changedTouches[0].clientX); }, { passive: true });
      cv.addEventListener('touchmove', function (e) { move(e.changedTouches[0].clientX); }, { passive: true });
      cv.addEventListener('touchend', up);
      cv.addEventListener('mousedown', function (e) { down(e.clientX); });
      cv.addEventListener('mousemove', function (e) { move(e.clientX); });
      cv.addEventListener('mouseup', up);
    }
  },

  startPlanetLoop: function () {
    var cv = this.el.planetCanvas;
    var size = Math.max(170, Math.min(250, window.innerWidth - 130));
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    this.planetSize = size;
    this.planetCtx = cv.getContext('2d');
    this.planetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.planetRaf) return;
    var self = this;
    this.planetLast = 0;
    var loop = function (ts) {
      // Цикл живёт только пока карусель на экране
      if (!self.el.screens.levels.classList.contains('active') ||
          self.el.planetView.classList.contains('hidden')) {
        self.planetRaf = 0;
        return;
      }
      self.planetRaf = requestAnimationFrame(loop);
      var dt = self.planetLast ? Math.min(0.05, (ts - self.planetLast) / 1000) : 0.016;
      self.planetLast = ts;
      self.planetAngle += (0.25 + self.planetSpin) * dt;
      self.planetSpin *= Math.pow(0.03, dt);     // инерция гаснет
      self.drawPlanet();
    };
    this.planetRaf = requestAnimationFrame(loop);
  },

  /* Точки на поверхности: детерминированные, чтобы планета была узнаваемой */
  planetFeatures: function (p) {
    if (!this._feat) this._feat = {};
    if (this._feat[p.id]) return this._feat[p.id];
    var rand = rng(p.id * 977 + 5);
    var arr = [];
    var n = p.feature === 'craters' ? 16 : 11;
    for (var i = 0; i < n; i++) {
      arr.push({
        lon: rand() * Math.PI * 2,
        lat: (rand() - 0.5) * 1.8,
        s: 0.07 + rand() * 0.15
      });
    }
    this._feat[p.id] = arr;
    return arr;
  },

  drawPlanet: function () {
    var ctx = this.planetCtx;
    if (!ctx) return;
    var size = this.planetSize;
    var p = PLANETS[this.planetIndex];
    var locked = this.planetLocked(p);
    var col = locked ? PAL.textMuted : p.color;
    var fill = locked ? '#141A22' : p.fill;
    var cx = size / 2, cy = size / 2, r = size * 0.36;
    var ang = this.planetAngle;

    ctx.clearRect(0, 0, size, size);

    // Кольцо станции: задняя половина уходит за шар
    if (p.ring) {
      ctx.save();
      ctx.globalAlpha = locked ? 0.15 : 0.35;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.45, r * 0.34, -0.35, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Диск
    ctx.fillStyle = fill;
    Draw.circle(ctx, cx, cy, r);
    ctx.fill();

    // Поверхность
    ctx.save();
    Draw.circle(ctx, cx, cy, r);
    ctx.clip();

    var feats = this.planetFeatures(p);
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i];
      var a = f.lon + ang;
      var cosA = Math.cos(a);
      if (cosA <= 0.06) continue;                     // деталь на обратной стороне
      var x = cx + Math.sin(a) * r * Math.cos(f.lat);
      var y = cy + Math.sin(f.lat) * r;
      var rr = r * f.s * cosA;

      if (p.feature === 'craters') {
        ctx.globalAlpha = locked ? 0.12 : 0.30;
        ctx.fillStyle = PAL.bgDeep;
        Draw.circle(ctx, x, y, rr); ctx.fill();
        ctx.globalAlpha = locked ? 0.12 : 0.35;
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        Draw.circle(ctx, x, y, rr); ctx.stroke();
      } else if (p.feature === 'ice') {
        ctx.globalAlpha = locked ? 0.08 : 0.22;
        ctx.fillStyle = '#DCEBFF';
        ctx.beginPath();
        ctx.ellipse(x, y, rr * 1.5, rr * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = locked ? 0.10 : 0.28;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(x, y, rr * 1.2, rr * 0.8, f.lat, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Терминатор: тень на убегающей стороне даёт объём без градиентов в телах
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    Draw.circle(ctx, cx + r * 0.62, cy - r * 0.18, r * 1.08);
    ctx.fill();
    ctx.restore();

    // Обводка и атмосфера
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    Draw.circle(ctx, cx, cy, r);
    ctx.stroke();
    ctx.globalAlpha = locked ? 0.08 : 0.18;
    ctx.lineWidth = 6;
    Draw.circle(ctx, cx, cy, r + 4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Передняя половина кольца
    if (p.ring) {
      ctx.globalAlpha = locked ? 0.2 : 0.55;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.45, r * 0.34, -0.35, 0, Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (locked) this.drawLock(ctx, cx, cy, size * 0.075);
  },

  drawLock: function (ctx, cx, cy, s) {
    ctx.save();
    ctx.strokeStyle = PAL.textMuted;
    ctx.fillStyle = PAL.bgDeep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.35, s * 0.55, Math.PI, 0);
    ctx.stroke();
    Draw.roundRect(ctx, cx - s * 0.85, cy - s * 0.35, s * 1.7, s * 1.3, s * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  /* ---------------- Уровни выбранной планеты ---------------- */
  openPlanetLevels: function () {
    var p = PLANETS[this.planetIndex];
    if (this.planetLocked(p)) {
      this.toast('Планета ещё закрыта');
      return;
    }
    Sound.resume();
    this.buildLevels(p);
    this.el.planetView.classList.add('hidden');
    this.el.levelList.classList.remove('hidden');
    this.el.levelsTitle.textContent = p.name;
  },

  buildLevels: function (planet) {
    var list = this.el.levelList;
    list.innerHTML = '';
    var d = Storage.data;
    var levels = Waves.ofPlanet(planet.id);
    for (var j = 0; j < levels.length; j++) {
      // Внутри планеты уровни нумеруются с единицы
      list.appendChild(this.makeLevelNode(levels[j], j + 1, d));
    }
  },

  makeLevelNode: function (lvl, shownNum, d) {
    var stars = d.stars[lvl.id] || 0;
    var open = lvl.id <= d.maxLevel;
    var node = document.createElement('div');
    node.className = 'level-node' +
      (open ? '' : ' locked') +
      (stars > 0 ? ' done' : '') +
      (lvl.id === d.maxLevel && open ? ' current' : '');

    var num = document.createElement('div');
    num.className = 'level-num';
    num.textContent = shownNum;

    var meta = document.createElement('div');
    meta.className = 'level-meta';
    var nm = document.createElement('div');
    nm.className = 'level-name';
    nm.textContent = lvl.name;
    var sub = document.createElement('div');
    sub.className = 'level-sub';
    sub.textContent = open ? (lvl.hint || '10 волн') : 'Заблокирован';
    meta.appendChild(nm); meta.appendChild(sub);

    var st = document.createElement('div');
    st.className = 'level-stars';
    for (var s = 0; s < 3; s++) {
      var dot = document.createElement('i');
      dot.className = 'star' + (s < stars ? ' on' : '');
      st.appendChild(dot);
    }

    node.appendChild(num); node.appendChild(meta); node.appendChild(st);
    if (open) {
      node.addEventListener('click', function () { Sound.resume(); Main.playLevel(lvl.id); });
    }
    return node;
  },

  /* ======================================================================
     СПРАВОЧНИК: что умеет защитник и что даёт каждая ступень улучшения
     ====================================================================== */
  buildCodex: function () {
    var list = this.el.codexList;
    list.innerHTML = '';
    for (var i = 0; i < UNIT_ORDER.length; i++) {
      list.appendChild(this.makeCodexItem(UNIT_ORDER[i]));
    }
  },

  unitCanvas: function (typeId, level, box, cell) {
    var cv = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = Math.round(box * dpr);
    cv.height = Math.round(box * dpr);
    cv.style.width = box + 'px';
    cv.style.height = box + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Units.draw(ctx, box / 2, box / 2, cell, typeId, { level: level, flash: 0, time: 0 });
    return cv;
  },

  makeCodexItem: function (typeId) {
    var def = UNIT_TYPES[typeId];
    var item = document.createElement('div');
    item.className = 'codex-item';

    var head = document.createElement('div');
    head.className = 'codex-head';
    head.appendChild(this.unitCanvas(typeId, 1, 40, typeId === 'mine' ? 80 : 46));

    var meta = document.createElement('div');
    meta.className = 'codex-meta';
    meta.innerHTML = '<div class="codex-name">' + def.name + '</div>' +
      '<div class="codex-role">' + def.role + '</div>';
    var cost = document.createElement('div');
    cost.className = 'codex-cost';
    cost.textContent = def.cost;
    head.appendChild(meta);
    head.appendChild(cost);

    var body = document.createElement('div');
    body.className = 'codex-body';
    for (var lv = 1; lv <= 3; lv++) body.appendChild(this.makeCodexTier(typeId, lv));

    head.addEventListener('click', function () { item.classList.toggle('open'); });
    item.appendChild(head);
    item.appendChild(body);
    return item;
  },

  makeCodexTier: function (typeId, level) {
    var def = UNIT_TYPES[typeId];
    var row = document.createElement('div');
    row.className = 'codex-tier';
    row.appendChild(this.unitCanvas(typeId, level, 52, typeId === 'mine' ? 90 : 52));

    var meta = document.createElement('div');
    meta.className = 'codex-tier-meta';

    var title = 'Ступень ' + level;
    if (level === 1) title += ' · базовая';
    else {
      title += ' · <span class="price">' + Units.tierCost(def, level) + ' искр</span>';
      if (level === 3) title += ' · <span class="where">Ледяная станция</span>';
    }
    var head = document.createElement('div');
    head.className = 'codex-tier-name';
    head.innerHTML = title;
    meta.appendChild(head);

    var lines = Units.describe(def, level);
    for (var i = 0; i < lines.length; i++) {
      var row2 = document.createElement('div');
      row2.className = 'codex-stat' + (lines[i][2] ? ' grow' : '');
      row2.innerHTML = '<span>' + lines[i][0] + '</span><b>' + lines[i][1] + '</b>';
      meta.appendChild(row2);
    }

    row.appendChild(meta);
    return row;
  },

  /* ---------------- Игровой хром ---------------- */
  bindGameChrome: function () {
    var self = this;
    this.el.btnPause.textContent = '❚❚';
    this.el.btnPause.addEventListener('click', function () { Game.pause(true); });
    this.el.btnSound.addEventListener('click', function () {
      var on = !Sound.enabled;
      Sound.setEnabled(on);
      Storage.setSound(on);
      self.syncSoundButton();
    });
    this.el.btnEarly.addEventListener('click', function () { Game.startEarly(); });
  },

  syncSoundButton: function () {
    this.el.btnSound.textContent = '♪';
    this.el.btnSound.style.color = Sound.enabled ? PAL.textMain : PAL.textMuted;
    this.el.btnSound.style.opacity = Sound.enabled ? '1' : '0.45';
  },

  enterGame: function (game) {
    this.show('game');
    this.unlocked = game.endless ? UNIT_ORDER.slice() : Waves.unlockedAt(game.levelId);
    this.buildDock(game);
    this.showUnitMenu(game, null);
    this.showPause(false);
    this.el.overlayResult.classList.add('hidden');
    this.updateBanner(game);
  },

  /* ---------------- Нижняя панель ---------------- */
  buildDock: function (game) {
    var dock = this.el.dock;
    dock.innerHTML = '';
    this.cards = {};
    for (var i = 0; i < UNIT_ORDER.length; i++) {
      var id = UNIT_ORDER[i];
      if (this.unlocked.indexOf(id) === -1) continue;
      dock.appendChild(this.makeCard(id, game));
    }
  },

  makeCard: function (typeId, game) {
    var def = UNIT_TYPES[typeId];
    var card = document.createElement('div');
    card.className = 'card';
    card.dataset.unit = typeId;

    var cv = document.createElement('canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = 30 * dpr; cv.height = 30 * dpr;
    cv.style.width = '30px'; cv.style.height = '30px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Units.draw(ctx, 15, 15, typeId === 'mine' ? 60 : 34, typeId, { level: 1, flash: 0 });

    var name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = def.name.length > 9 ? def.name.slice(0, 8) + '.' : def.name;

    var cost = document.createElement('div');
    cost.className = 'card-cost';
    cost.textContent = def.cost;

    var cd = document.createElement('div');
    cd.className = 'card-cd';
    cd.style.height = '0%';

    card.appendChild(cv); card.appendChild(name); card.appendChild(cost); card.appendChild(cd);
    card.addEventListener('click', function () { Sound.resume(); Game.selectCard(typeId); });

    this.cards[typeId] = { root: card, cd: cd, locked: null, cdPct: -1 };
    return card;
  },

  /* Полная сверка доступности карточек (после трат и постановок) */
  refreshCards: function (game) {
    for (var id in this.cards) {
      var c = this.cards[id];
      var locked = game.sparks < UNIT_TYPES[id].cost || game.cardCd[id] > 0;
      if (c.locked !== locked) {
        c.root.classList.toggle('locked', locked);
        c.locked = locked;
      }
    }
  },

  /* Дешёвое обновление каждый кадр: только кулдауны */
  tickCards: function (game) {
    for (var id in this.cards) {
      var c = this.cards[id];
      var total = UNIT_TYPES[id].cooldown;
      var pct = Math.round((game.cardCd[id] / total) * 100);
      if (pct !== c.cdPct) {
        c.cd.style.height = pct + '%';
        c.cdPct = pct;
      }
      var locked = game.sparks < UNIT_TYPES[id].cost || game.cardCd[id] > 0;
      if (c.locked !== locked) {
        c.root.classList.toggle('locked', locked);
        c.locked = locked;
      }
    }
  },

  setSelected: function (typeId) {
    for (var id in this.cards) {
      this.cards[id].root.classList.toggle('selected', id === typeId);
    }
  },

  shakeCard: function (typeId) {
    var c = this.cards[typeId];
    if (!c) return;
    c.root.classList.remove('shake');
    void c.root.offsetWidth;          // перезапуск анимации
    c.root.classList.add('shake');
  },

  /* ---------------- Верхняя панель ---------------- */
  setSparks: function (n) { this.el.sparkCount.textContent = n; },

  popSparks: function () {
    var e = this.el.hudSparks;
    e.classList.remove('pop');
    void e.offsetWidth;
    e.classList.add('pop');
  },

  setLives: function (n, max) {
    var box = this.el.lives;
    if (box.children.length !== max) {
      box.innerHTML = '';
      for (var i = 0; i < max; i++) {
        var d = document.createElement('i');
        d.className = 'life';
        box.appendChild(d);
      }
    }
    for (var j = 0; j < max; j++) {
      box.children[j].classList.toggle('lost', j >= n);
    }
  },

  setWave: function (cur, total) {
    this.el.waveCount.textContent = cur + ' / ' + total;
  },

  /* ---------------- Баннер межволновой паузы ---------------- */
  updateBanner: function (game) {
    var b = this.el.banner;
    if (game.over || game.phase !== 'prep') { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    var secs = Math.max(0, Math.ceil(game.prepT));
    var text = 'Волна ' + (game.waveIndex + 1) + ' через ' + secs + ' с';
    if (text === this._lastBanner) return;    // не дёргаем DOM каждый кадр
    this._lastBanner = text;
    this.el.bannerText.textContent = text;
  },

  toast: function (text) {
    var t = this.el.toast;
    t.textContent = text;
    t.classList.remove('hidden');
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1400);
  },

  /* ---------------- Меню установленного юнита ---------------- */
  menuRefs: null,

  showUnitMenu: function (game, unit) {
    var m = this.el.unitMenu;
    this.menuRefs = null;
    if (!unit) { m.classList.add('hidden'); m.innerHTML = ''; return; }

    var maxTier = game.maxTier();
    m.innerHTML = '';

    var head = document.createElement('div');
    head.className = 'unit-menu-head';
    head.innerHTML = '<span>' + unit.def.name + '</span>' +
      '<span class="tier">' + unit.level + ' / ' + maxTier + '</span>';
    m.appendChild(head);

    var sell = document.createElement('button');
    sell.innerHTML = '<span>Продать</span><span class="price">+' + Units.sellPrice(unit) + '</span>';
    sell.addEventListener('click', function (e) { e.stopPropagation(); Game.sellUnit(unit); });
    m.appendChild(sell);

    var up = document.createElement('button');
    if (Units.canUpgrade(unit, maxTier)) {
      var cost = Units.upgradeCost(unit);
      up.className = game.sparks >= cost ? '' : 'disabled';
      up.innerHTML = '<span>Улучшить</span><span class="price">' + cost + '</span>';
      up.addEventListener('click', function (e) { e.stopPropagation(); Game.upgradeUnit(unit); });
      // Меню живёт, пока открыто: как только искр хватит, кнопка оживёт сама
      this.menuRefs = { unit: unit, btn: up, cost: cost, afford: game.sparks >= cost };
    } else {
      up.className = 'disabled';
      up.innerHTML = unit.level >= 3
        ? '<span>Максимум</span><span class="price">—</span>'
        : '<span>Дальше — на Станции</span><span class="price">—</span>';
    }
    m.appendChild(up);

    m.classList.remove('hidden');

    // Позиционируем под юнитом, не выходя за пределы области поля
    var cv = this.el.canvas;
    var wrap = this.el.fieldWrap;
    var left = cv.offsetLeft + Grid.centerX(unit.col) - m.offsetWidth / 2;
    var top = cv.offsetTop + (unit.row + 1) * Grid.cell + 6;
    if (top + m.offsetHeight > wrap.clientHeight - 6) {
      top = cv.offsetTop + unit.row * Grid.cell - m.offsetHeight - 6;
    }
    left = Math.max(6, Math.min(wrap.clientWidth - m.offsetWidth - 6, left));
    top = Math.max(6, top);
    m.style.left = left + 'px';
    m.style.top = top + 'px';
  },

  /* Каждый кадр сверяем доступность улучшения с текущим запасом искр */
  tickUnitMenu: function (game) {
    var r = this.menuRefs;
    if (!r || game.menuUnit !== r.unit) return;
    var afford = game.sparks >= r.cost;
    if (afford === r.afford) return;
    r.afford = afford;
    r.btn.classList.toggle('disabled', !afford);
  },

  /* ---------------- Оверлеи ---------------- */
  bindOverlays: function () {
    var self = this;

    this.el.overlayPause.addEventListener('click', function (e) {
      var act = e.target.dataset ? e.target.dataset.act : null;
      if (act === 'resume') Game.pause(false);
      else if (act === 'restart') { self.showPause(false); Game.restart(); }
      else if (act === 'menu') { self.showPause(false); Main.toMenu(); }
    });

    this.el.overlayResult.addEventListener('click', function (e) {
      var act = e.target.dataset ? e.target.dataset.act : null;
      if (!act) return;
      if (act === 'next') Main.nextLevel();
      else if (act === 'retry') { self.el.overlayResult.classList.add('hidden'); Game.restart(); }
      else if (act === 'menu') { self.el.overlayResult.classList.add('hidden'); Main.toMenu(); }
      else if (act === 'share') Main.share();
      else if (act === 'endless') { self.el.overlayResult.classList.add('hidden'); Main.playEndless(); }
    });

    document.getElementById('tut-next').addEventListener('click', function () { self.tutorialNext(); });
    document.getElementById('tut-skip').addEventListener('click', function () { self.tutorialFinish(); });
  },

  showPause: function (on) {
    this.el.overlayPause.classList.toggle('hidden', !on);
  },

  showResult: function (game, won, stars) {
    var last = !game.endless && game.levelId >= Waves.total;
    this.el.resultTitle.textContent = won
      ? (last ? 'Кампания пройдена' : 'Уровень пройден')
      : 'Рубеж прорван';

    this.el.resultStars.innerHTML = '';
    if (won && !game.endless) {
      for (var i = 0; i < 3; i++) {
        var d = document.createElement('i');
        d.className = 'star' + (i < stars ? ' on' : '');
        this.el.resultStars.appendChild(d);
      }
    }

    var lines = [
      ['Убито врагов', game.kills],
      ['Собрано искр', game.collected],
      ['Волн пройдено', game.endless ? game.waveIndex : Math.min(game.waveIndex, game.level.waves.length)],
      ['Жизней осталось', Math.max(0, game.lives)]
    ];
    if (last && won) lines.push(['Всего уровней пройдено', Storage.data.stats.levels]);
    var html = '';
    for (var j = 0; j < lines.length; j++) {
      html += '<div class="line"><span>' + lines[j][0] + '</span><b>' + lines[j][1] + '</b></div>';
    }
    this.el.resultStats.innerHTML = html;

    var next = document.getElementById('btn-result-next');
    if (game.endless) {
      next.textContent = 'В меню';
      next.dataset.act = 'menu';
    } else if (!won) {
      next.textContent = 'Ещё раз';
      next.dataset.act = 'retry';
    } else if (last) {
      next.textContent = 'Бесконечные волны';
      next.dataset.act = 'endless';
    } else {
      next.textContent = 'Дальше';
      next.dataset.act = 'next';
    }

    this.el.overlayResult.classList.remove('hidden');
  },

  /* ---------------- Обучение: три шага при первом запуске ---------------- */
  TUT: [
    { title: 'Поставь защитника', text: 'Выбери карточку внизу и коснись свободной клетки. Маяк приносит искры, стрелок бьёт вверх по своей колонке.' },
    { title: 'Собери искру', text: 'Маяки роняют искры — коснись монеты, чтобы забрать её быстрее. За убитых врагов и зачищенные волны искры начисляются сами.' },
    { title: 'Останови врага', text: 'Враги идут сверху вниз. Если враг пересечёт красный рубеж внизу — потеряешь жизнь. Их всего три.' }
  ],

  startTutorial: function () {
    this.tutStep = 0;
    this.el.overlayTutorial.classList.remove('hidden');
    Game.paused = true;
    this.renderTutorial();
  },

  renderTutorial: function () {
    var s = this.TUT[this.tutStep];
    this.el.tutStep.textContent = 'Шаг ' + (this.tutStep + 1) + ' из 3';
    this.el.tutTitle.textContent = s.title;
    this.el.tutText.textContent = s.text;
    document.getElementById('tut-next').textContent =
      this.tutStep === this.TUT.length - 1 ? 'В бой' : 'Дальше';
  },

  tutorialNext: function () {
    if (this.tutStep < this.TUT.length - 1) { this.tutStep++; this.renderTutorial(); }
    else this.tutorialFinish();
  },

  tutorialFinish: function () {
    this.el.overlayTutorial.classList.add('hidden');
    Storage.setTutorialDone();
    Game.paused = false;
    Game.lastTs = 0;
  }
};
