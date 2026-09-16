/* storage.js — сохранение прогресса в localStorage.
   Если хранилище недоступно (приватный режим, запрет куки) — игра работает,
   просто ничего не сохраняет и не падает. */

var Storage = (function () {
  var KEY = 'night-defense-v1';
  var available = true;

  // Значения по умолчанию для нового игрока
  function defaults() {
    return {
      maxLevel: 1,          // максимальный открытый уровень (1..10)
      stars: {},            // { "1": 3, "2": 2, ... }
      sound: true,
      dev: false,           // режим разработчика: всё открыто, жизни не тратятся
      tutorialDone: false,
      campaignDone: false,
      endlessBest: 0,       // лучшая волна в бесконечном режиме
      stats: { kills: 0, sparks: 0, levels: 0 }
    };
  }

  var data = defaults();

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        for (var k in parsed) if (Object.prototype.hasOwnProperty.call(parsed, k)) data[k] = parsed[k];
      }
    } catch (e) {
      available = false;
    }
    return data;
  }

  function save() {
    if (!available) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      available = false;
    }
  }

  // Записать результат уровня: открыть следующий и запомнить лучшие звёзды
  function completeLevel(levelId, stars) {
    var prev = data.stars[levelId] || 0;
    if (stars > prev) data.stars[levelId] = stars;
    var total = Waves.total;
    if (levelId + 1 > data.maxLevel) data.maxLevel = Math.min(levelId + 1, total);
    if (levelId >= total) data.campaignDone = true;
    data.stats.levels++;
    save();
  }

  function addStats(kills, sparks) {
    data.stats.kills += kills;
    data.stats.sparks += sparks;
    save();
  }

  function setEndlessBest(wave) {
    if (wave > data.endlessBest) { data.endlessBest = wave; save(); }
  }

  function setSound(on) { data.sound = !!on; save(); }
  function setDev(on) { data.dev = !!on; save(); }
  function setTutorialDone() { data.tutorialDone = true; save(); }

  function reset() {
    data = defaults();
    save();
  }

  return {
    load: load,
    save: save,
    get data() { return data; },
    get available() { return available; },
    completeLevel: completeLevel,
    addStats: addStats,
    setEndlessBest: setEndlessBest,
    setSound: setSound,
    setDev: setDev,
    setTutorialDone: setTutorialDone,
    reset: reset
  };
})();
