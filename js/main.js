/* main.js — точка входа: инициализация, навигация между экранами,
   реакция на поворот экрана и сворачивание приложения. */

/* Версия сборки. Дублируется в ?v= у css и js в index.html — у webview
   Telegram свой кэш, который не смотрит на Cache-Control. При каждой выкатке
   поднимать оба места, иначе игроки увидят старую версию. */
var APP_VERSION = '16';

var Main = {
  boot: function () {
    Storage.load();
    Sound.setEnabled(Storage.data.sound !== false);
    TG.init();

    UI.init();
    Game.init(document.getElementById('field'));

    var self = this;
    window.addEventListener('resize', function () { self.onResize(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { self.onResize(); }, 120);
    });

    // Игра не должна идти в фоне: сворачивание ставит на паузу
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && Game.running && !Game.over) Game.pause(true);
    });
    window.addEventListener('blur', function () {
      if (Game.running && !Game.over && !Game.paused) Game.pause(true);
    });

    // Любой первый жест разблокирует Web Audio
    document.addEventListener('pointerdown', function once() {
      Sound.resume();
      document.removeEventListener('pointerdown', once);
    });

    this.onResize();
    UI.show('menu');
  },

  /* Портретная ориентация обязательна на телефонах;
     на широком десктопном окне заглушку не показываем. */
  onResize: function () {
    var landscapePhone = window.innerWidth > window.innerHeight && window.innerHeight < 520;
    UI.el.rotate.classList.toggle('show', landscapePhone);
    if (landscapePhone && Game.running && !Game.over) Game.pause(true);
    if (Game.canvas) Game.resize();
    if (Game.menuUnit) UI.showUnitMenu(Game, Game.menuUnit);
  },

  playLevel: function (id) {
    id = Math.max(1, Math.min(LEVELS.length, id || 1));
    UI.el.overlayResult.classList.add('hidden');
    Game.start(id, false);
    // Обучающий оверлей — только на первом уровне и только один раз
    if (id === 1 && !Storage.data.tutorialDone) UI.startTutorial();
  },

  playEndless: function () {
    UI.el.overlayResult.classList.add('hidden');
    Game.start(0, true);
  },

  nextLevel: function () {
    UI.el.overlayResult.classList.add('hidden');
    var next = Game.levelId + 1;
    if (next > LEVELS.length) { this.toMenu(); return; }
    this.playLevel(next);
  },

  toMenu: function () {
    Game.stop();
    UI.showPause(false);
    UI.el.overlayResult.classList.add('hidden');
    UI.show('menu');
  },

  share: function () {
    var name = TG.userName();
    var who = name ? name + ' ' : '';
    var text;
    if (Game.endless) {
      text = who + 'продержался ' + Game.waveIndex + ' волн в «Ночной обороне»';
    } else {
      text = who + 'прошёл уровень ' + Game.levelId + ' в «Ночной обороне»: ' +
        Game.kills + ' врагов остановлено';
    }
    var ok = TG.share(text);
    if (!ok) UI.toast('Текст скопирован');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { Main.boot(); });
} else {
  Main.boot();
}
