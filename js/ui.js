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
    if (name === 'levels') this.buildLevels();
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
    document.getElementById('btn-levels-back').addEventListener('click', function () { self.show('menu'); });
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
    var note = 'Открыто уровней: ' + Math.min(d.maxLevel, 10) + ' из 10';
    if (d.campaignDone) note = 'Кампания пройдена';
    if (d.endlessBest) note += ' · рекорд: ' + d.endlessBest + ' волн';
    if (!Storage.available) note += ' · прогресс не сохраняется';
    if (name) note = name + ', ' + note.charAt(0).toLowerCase() + note.slice(1);
    this.el.menuNote.textContent = note;
    this.el.btnEndless.hidden = !d.campaignDone;
  },

  /* ---------------- Карта уровней ---------------- */
  buildLevels: function () {
    var list = this.el.levelList;
    list.innerHTML = '';
    var d = Storage.data;
    for (var i = 0; i < LEVELS.length; i++) {
      (function (lvl, self) {
        var stars = d.stars[lvl.id] || 0;
        var unlockedLevel = lvl.id <= d.maxLevel;
        var node = document.createElement('div');
        node.className = 'level-node' +
          (unlockedLevel ? '' : ' locked') +
          (stars > 0 ? ' done' : '') +
          (lvl.id === d.maxLevel && unlockedLevel ? ' current' : '');

        var num = document.createElement('div');
        num.className = 'level-num';
        num.textContent = lvl.id;

        var meta = document.createElement('div');
        meta.className = 'level-meta';
        var nm = document.createElement('div');
        nm.className = 'level-name';
        nm.textContent = lvl.name;
        var sub = document.createElement('div');
        sub.className = 'level-sub';
        sub.textContent = unlockedLevel ? lvl.hint || '10 волн' : 'Заблокирован';
        meta.appendChild(nm); meta.appendChild(sub);

        var st = document.createElement('div');
        st.className = 'level-stars';
        for (var s = 0; s < 3; s++) {
          var dot = document.createElement('i');
          dot.className = 'star' + (s < stars ? ' on' : '');
          st.appendChild(dot);
        }

        node.appendChild(num); node.appendChild(meta); node.appendChild(st);
        if (unlockedLevel) {
          node.addEventListener('click', function () { Sound.resume(); Main.playLevel(lvl.id); });
        }
        list.appendChild(node);
      })(LEVELS[i], this);
    }
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
  showUnitMenu: function (game, unit) {
    var m = this.el.unitMenu;
    if (!unit) { m.classList.add('hidden'); m.innerHTML = ''; return; }

    m.innerHTML = '';
    var sell = document.createElement('button');
    sell.innerHTML = '<span>Продать</span><span class="price">+' + Units.sellPrice(unit) + '</span>';
    sell.addEventListener('click', function (e) { e.stopPropagation(); Game.sellUnit(unit); });
    m.appendChild(sell);

    var up = document.createElement('button');
    if (Units.canUpgrade(unit)) {
      var cost = Units.upgradeCost(unit);
      var afford = game.sparks >= cost;
      up.className = afford ? '' : 'disabled';
      up.innerHTML = '<span>Улучшить</span><span class="price">' + cost + '</span>';
      up.addEventListener('click', function (e) { e.stopPropagation(); Game.upgradeUnit(unit); });
    } else {
      up.className = 'disabled';
      up.innerHTML = '<span>Улучшен</span><span class="price">—</span>';
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
    var last = !game.endless && game.levelId >= LEVELS.length;
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
