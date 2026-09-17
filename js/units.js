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
  /* Замкнутый контур по списку точек [[x,y], ...] */
  poly: function (ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  },
  /* Правильный многоугольник с плоской вершиной сверху */
  ngon: function (ctx, cx, cy, r, n, rot) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + (rot || 0);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    Draw.poly(ctx, pts);
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
  },
  /* Полоска-индикатор со скруглёнными торцами */
  bar: function (ctx, x, y, w, h, pct, bgColor, fgColor) {
    var r = h / 2;
    ctx.fillStyle = bgColor;
    Draw.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    pct = Math.max(0, Math.min(1, pct));
    if (pct <= 0) return;
    var fw = Math.max(h, w * pct);   // не уже собственной высоты, иначе торцы схлопываются
    ctx.fillStyle = fgColor;
    Draw.roundRect(ctx, x, y, fw, h, r);
    ctx.fill();
  },

  glowCircle: function (ctx, cx, cy, r, color, alpha, spread) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = spread;
    Draw.circle(ctx, cx, cy, r + spread / 2);
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
    id: 'beacon', name: 'Маяк', cost: 50, hp: 100, cooldown: 5,
    color: PAL.spark, fill: PAL.fillSpark,
    produce: 25, interval: 6,
    upgradeKey: 'produce',
    role: 'Производит искры'
  },
  shooter: {
    id: 'shooter', name: 'Стрелок', cost: 100, hp: 120, cooldown: 5,
    color: PAL.uShooter, fill: PAL.uShooterF,
    damage: 20, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage',
    role: '20 урона, выстрел в секунду'
  },
  barrier: {
    id: 'barrier', name: 'Барьер', cost: 50, hp: 600, cooldown: 12,
    color: PAL.uBarrier, fill: PAL.uBarrierF,
    upgradeKey: 'hp',
    role: 'Не атакует, держит удар'
  },
  freezer: {
    id: 'freezer', name: 'Морозилка', cost: 175, hp: 100, cooldown: 8,
    color: PAL.ice, fill: PAL.fillIce,
    damage: 10, fireRate: 1.0, range: 7, slow: 0.4, slowTime: 3, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Замедляет врага на 40%'
  },
  shotgun: {
    id: 'shotgun', name: 'Дробовик', cost: 200, hp: 150, cooldown: 8,
    color: PAL.uShotgun, fill: PAL.uShotgunF,
    damage: 60, fireRate: 1 / 1.5, range: 2, spread: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: '60 урона на две клетки'
  },
  repeater: {
    id: 'repeater', name: 'Дуплет', cost: 130, hp: 120, cooldown: 7,
    color: PAL.uRepeater, fill: PAL.uRepeaterF,
    damage: 15, fireRate: 1.0, range: 7, burst: 2, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Два снаряда за выстрел'
  },
  fan: {
    id: 'fan', name: 'Веер', cost: 250, hp: 110, cooldown: 10,
    color: PAL.uFan, fill: PAL.uFanF,
    damage: 15, fireRate: 0.9, range: 7, spreadCols: true, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Бьёт в три колонки сразу'
  },
  torch: {
    id: 'torch', name: 'Горн', cost: 150, hp: 100, cooldown: 8,
    color: PAL.uTorch, fill: PAL.uTorchF,
    boost: 1.5,
    upgradeKey: 'boost',
    role: 'Усиливает пролетающие снаряды'
  },
  magnet: {
    id: 'magnet', name: 'Магнит', cost: 150, hp: 100, cooldown: 10,
    color: PAL.uMagnet, fill: PAL.uMagnetF,
    fireRate: 1 / 5, range: 4, strip: true,
    upgradeKey: 'range',
    role: 'Срывает броню с броненосцев'
  },
  mortar: {
    id: 'mortar', name: 'Мортира', cost: 225, hp: 120, cooldown: 12,
    color: PAL.uMortar, fill: PAL.uMortarF,
    damage: 45, fireRate: 0.5, range: 6, splash: 1.0, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: 'Бьёт по площади навесом'
  },
  laser: {
    id: 'laser', name: 'Лазер', cost: 275, hp: 100, cooldown: 14,
    color: PAL.uLaser, fill: PAL.uLaserF,
    damage: 14, fireRate: 1.6, range: 7, pierce: true, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Прошивает всю колонку насквозь'
  },
  repair: {
    id: 'repair', name: 'Ремонтник', cost: 125, hp: 130, cooldown: 10,
    color: PAL.uRepair, fill: PAL.uRepairF,
    fireRate: 1, repair: 14,
    upgradeKey: 'repair',
    role: 'Чинит соседних защитников'
  },
  spikes: {
    id: 'spikes', name: 'Шипы', cost: 100, hp: 200, cooldown: 8,
    color: PAL.uSpikes, fill: PAL.uSpikesF,
    ground: true, tickDamage: 16,            // лежит на земле и режет всех, кто наступил
    upgradeKey: 'tickDamage',
    role: 'Режет всех, кто наступит'
  },
  chomper: {
    id: 'chomper', name: 'Капкан', cost: 175, hp: 130, cooldown: 10,
    color: PAL.uChomper, fill: PAL.uChomperF,
    swallow: true, chewTime: 11, range: 1.2,
    upgradeKey: 'chewTime',
    role: 'Глотает врага целиком, потом жуёт'
  },
  tesla: {
    id: 'tesla', name: 'Молния', cost: 250, hp: 100, cooldown: 12,
    color: PAL.uTesla, fill: PAL.uTeslaF,
    damage: 18, fireRate: 0.7, range: 3, chain: 3, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Бьёт цепью по трём врагам'
  },
  harpoon: {
    id: 'harpoon', name: 'Гарпун', cost: 175, hp: 110, cooldown: 9,
    color: PAL.uHarpoon, fill: PAL.uHarpoonF,
    damage: 22, fireRate: 0.5, range: 5, pull: 1.4, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Оттаскивает врага назад'
  },
  umbrella: {
    id: 'umbrella', name: 'Зонт', cost: 100, hp: 150, cooldown: 8,
    color: PAL.uUmbrella, fill: PAL.uUmbrellaF,
    shieldRange: 1,                          // сбивает плевки над собой и соседями
    upgradeKey: 'shieldRange',
    role: 'Сбивает плевки над собой и соседями'
  },
  pendulum: {
    id: 'pendulum', name: 'Маятник', cost: 200, hp: 170, cooldown: 11,
    color: PAL.uPendulum, fill: PAL.uPendulumF,
    damage: 34, fireRate: 1.0, range: 1.2, sweep: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: 'Косит вплотную три колонки'
  },
  net: {
    id: 'net', name: 'Сеть', cost: 150, hp: 110, cooldown: 10,
    color: PAL.uNet, fill: PAL.uNetF,
    fireRate: 1 / 6, range: 6, root: 2.5,
    upgradeKey: 'root',
    role: 'Пригвождает врага к месту'
  },
  mine: {
    id: 'mine', name: 'Мина', cost: 25, hp: 1, cooldown: 12,
    color: PAL.uMine, fill: PAL.uMineF,
    damage: 300, radius: 1.5, oneShot: true, ground: true,
    upgradeKey: 'damage',
    role: 'Взрывается при контакте'
  }
};

/* ---------- Защитники планет 2-9 ----------
   У каждой планеты своя пятёрка: добытчик искр, стена, стрелок и два
   специалиста под её механику. Ни один юнит не встречается дважды. */
var PLANET_UNITS = {
  /* --- Планета 2: Пепельные пустоши (кратеры) --- */
  ashwell: {
    id: 'ashwell', name: 'Колодец', cost: 75, hp: 110, cooldown: 6,
    color: PAL.uAshwell, fill: PAL.uAshwellF,
    produce: 45, interval: 7, onCrater: true,
    upgradeKey: 'produce',
    role: 'Ставится в кратер и качает искры из пепла'
  },
  obelisk: {
    id: 'obelisk', name: 'Обелиск', cost: 75, hp: 700, cooldown: 12,
    color: PAL.uObelisk, fill: PAL.uObeliskF,
    upgradeKey: 'hp',
    role: 'Каменный столб, держит удар'
  },

  /* --- Планета 3: Ледяная станция (обледенение) --- */
  condenser: {
    id: 'condenser', name: 'Конденсатор', cost: 75, hp: 100, cooldown: 6,
    color: PAL.uCondenser, fill: PAL.uCondenserF,
    produce: 25, interval: 6, ecoOn: 'thaw', ecoBonus: 60,
    upgradeKey: 'produce',
    role: 'Даёт искры, а после разморозки выдаёт разом вдвое больше'
  },
  icewall: {
    id: 'icewall', name: 'Ледяная стена', cost: 75, hp: 520, cooldown: 12,
    color: PAL.uIcewall, fill: PAL.uIcewallF,
    chill: 2, upgradeKey: 'hp',
    role: 'Держит удар и морозит того, кто её грызёт'
  },

  /* --- Планета 4: Джунгли (заросли) --- */
  vinepod: {
    id: 'vinepod', name: 'Лоза', cost: 75, hp: 110, cooldown: 6,
    color: PAL.uVinepod, fill: PAL.uVinepodF,
    produce: 25, interval: 6, ecoVines: 0.7,
    upgradeKey: 'produce',
    role: 'Чем больше зарослей рядом, тем быстрее плодоносит'
  },
  stump: {
    id: 'stump', name: 'Пень', cost: 75, hp: 780, cooldown: 12,
    color: PAL.uStump, fill: PAL.uStumpF,
    upgradeKey: 'hp',
    role: 'Вросший в землю пень, сдвинуть почти нельзя'
  },

  /* --- Планета 5: Рудник (обвалы) --- */
  miner: {
    id: 'miner', name: 'Рудокоп', cost: 75, hp: 120, cooldown: 6,
    color: PAL.uMiner, fill: PAL.uMinerF,
    produce: 25, interval: 7, ecoOn: 'collapse', ecoBonus: 50,
    upgradeKey: 'produce',
    role: 'Каждый обвал приносит ему полную жилу'
  },
  prop: {
    id: 'prop', name: 'Крепь', cost: 75, hp: 600, cooldown: 12,
    color: PAL.uProp, fill: PAL.uPropF,
    noCollapse: true, upgradeKey: 'hp',
    role: 'Держит свод: в её колонке обвалов не бывает'
  },

  /* --- Планета 6: Улей (споры) --- */
  sporepod: {
    id: 'sporepod', name: 'Споровик', cost: 75, hp: 110, cooldown: 6,
    color: PAL.uSporepod, fill: PAL.uSporepodF,
    produce: 25, interval: 7, ecoOn: 'spore', ecoBonus: 45,
    upgradeKey: 'produce',
    role: 'Перерабатывает осевшие споры в искры'
  },
  tarwall: {
    id: 'tarwall', name: 'Смоляная стена', cost: 75, hp: 640, cooldown: 12,
    color: PAL.uTarwall, fill: PAL.uTarwallF,
    chill: 3, upgradeKey: 'hp',
    role: 'Вязкая стена: кто грызёт, тот вязнет'
  },

  /* --- Планета 7: Разлом (тьма) --- */
  glowfly: {
    id: 'glowfly', name: 'Светляк', cost: 75, hp: 100, cooldown: 6,
    color: PAL.uGlowfly, fill: PAL.uGlowflyF,
    produce: 25, interval: 7, ecoDark: 2,
    upgradeKey: 'produce',
    role: 'В темноте светит ярче и даёт вдвое больше'
  },
  monolith: {
    id: 'monolith', name: 'Монолит', cost: 100, hp: 900, cooldown: 14,
    color: PAL.uMonolith, fill: PAL.uMonolithF,
    upgradeKey: 'hp',
    role: 'Самая прочная стена в игре'
  },
  lantern: {
    id: 'lantern', name: 'Фонарь', cost: 150, hp: 110, cooldown: 10,
    color: PAL.uLantern, fill: PAL.uLanternF,
    litColumn: 1.35, upgradeKey: 'litColumn',
    role: 'Освещает колонку: враги в ней получают больше урона'
  },
  cutter: {
    id: 'cutter', name: 'Резак', cost: 175, hp: 140, cooldown: 8,
    color: PAL.uCutter, fill: PAL.uCutterF,
    damage: 48, fireRate: 1.2, range: 2, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: 'Кромсает всё, что подошло на две клетки'
  },
  anchor: {
    id: 'anchor', name: 'Якорь', cost: 150, hp: 130, cooldown: 10,
    color: PAL.uAnchor, fill: PAL.uAnchorF,
    auraSlow: 0.45, range: 7, upgradeKey: 'auraSlow',
    role: 'Вся колонка перед ним идёт вдвое медленнее'
  },

  /* --- Планета 8: Печь (метеоры) --- */
  heatsink: {
    id: 'heatsink', name: 'Теплосборник', cost: 75, hp: 120, cooldown: 6,
    color: PAL.uHeatsink, fill: PAL.uHeatsinkF,
    produce: 25, interval: 7, ecoOn: 'meteor', ecoBonus: 55,
    upgradeKey: 'produce',
    role: 'Каждый метеор — целый заряд искр'
  },
  shieldwall: {
    id: 'shieldwall', name: 'Жаростойкая стена', cost: 100, hp: 700, cooldown: 13,
    color: PAL.uShieldwall, fill: PAL.uShieldwallF,
    meteorProof: true, upgradeKey: 'hp',
    role: 'Метеор ей нипочём'
  },
  smelter: {
    id: 'smelter', name: 'Плавильщик', cost: 125, hp: 120, cooldown: 8,
    color: PAL.uSmelter, fill: PAL.uSmelterF,
    damage: 17, fireRate: 1.5, range: 7, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Частый поток раскалённых капель'
  },
  rodtower: {
    id: 'rodtower', name: 'Громоотвод', cost: 150, hp: 260, cooldown: 12,
    color: PAL.uRodtower, fill: PAL.uRodtowerF,
    meteorMagnet: true, meteorProof: true, upgradeKey: 'hp',
    role: 'Метеоры бьют в него, а не по строю'
  },
  hammer: {
    id: 'hammer', name: 'Молот', cost: 200, hp: 170, cooldown: 11,
    color: PAL.uHammer, fill: PAL.uHammerF,
    damage: 58, fireRate: 0.6, range: 1.6, slam: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: 'Удар оземь бьёт всех вокруг'
  },

  /* Базовые стрелки: по одному на планету, дёшевы и бьют через всю колонку */
  slinger: {
    id: 'slinger', name: 'Пращник', cost: 110, hp: 120, cooldown: 5,
    color: PAL.uSlinger, fill: PAL.uSlingerF,
    damage: 21, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage', role: 'Мечет раскалённые камни через всю колонку'
  },
  barb: {
    id: 'barb', name: 'Стрекало', cost: 110, hp: 120, cooldown: 5,
    color: PAL.uBarb, fill: PAL.uBarbF,
    damage: 21, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage', role: 'Стреляет шипами через всю колонку'
  },
  jack: {
    id: 'jack', name: 'Отбойник', cost: 110, hp: 130, cooldown: 5,
    color: PAL.uJack, fill: PAL.uJackF,
    damage: 21, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage', role: 'Бьёт осколками породы через всю колонку'
  },
  sting: {
    id: 'sting', name: 'Жало', cost: 110, hp: 115, cooldown: 5,
    color: PAL.uSting, fill: PAL.uStingF,
    damage: 21, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage', role: 'Плюётся спорами через всю колонку'
  },
  ray: {
    id: 'ray', name: 'Луч', cost: 110, hp: 115, cooldown: 5,
    color: PAL.uRay, fill: PAL.uRayF,
    damage: 21, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage', role: 'Бьёт светом через всю колонку'
  },

  /* --- Акт 4: Цитадель (осада) --- */
  altar: {
    id: 'altar', name: 'Алтарь', cost: 75, hp: 130, cooldown: 6,
    color: PAL.uAltar, fill: PAL.uAltarF,
    produce: 25, interval: 7, ecoOn: 'kill', ecoBonus: 8,
    upgradeKey: 'produce',
    role: 'Берёт свою долю с каждого павшего врага'
  },
  bastion: {
    id: 'bastion', name: 'Бастион', cost: 125, hp: 1400, cooldown: 15,
    color: PAL.uBastion, fill: PAL.uBastionF,
    upgradeKey: 'hp',
    role: 'Самая тяжёлая стена. Осада начинается с неё'
  },
  lancer: {
    id: 'lancer', name: 'Копейщик', cost: 110, hp: 130, cooldown: 5,
    color: PAL.uLancer, fill: PAL.uLancerF,
    damage: 22, fireRate: 1.0, range: 7, shotSound: 'shot',
    upgradeKey: 'damage',
    role: 'Мечет копья через всю колонку'
  },
  inquisitor: {
    id: 'inquisitor', name: 'Инквизитор', cost: 250, hp: 140, cooldown: 12,
    color: PAL.uInquis, fill: PAL.uInquisF,
    damage: 72, fireRate: 0.7, range: 7, pierceGuard: true, shotSound: 'shotBig',
    upgradeKey: 'damage',
    role: 'Тяжёлый выстрел, которому щиты не помеха'
  },
  ward: {
    id: 'ward', name: 'Оберег', cost: 150, hp: 140, cooldown: 11,
    color: PAL.uWard, fill: PAL.uWardF,
    antiGlitch: true, upgradeKey: 'hp',
    role: 'Осквернитель не может заглушить его колонку'
  },

  /* --- Планета 9: Бездна (аномалия) --- */
  resonator: {
    id: 'resonator', name: 'Резонатор', cost: 75, hp: 110, cooldown: 6,
    color: PAL.uResonator, fill: PAL.uResonatorF,
    produce: 25, interval: 7, ecoOn: 'glitch', ecoBonus: 60,
    upgradeKey: 'produce',
    role: 'Кормится самой аномалией'
  },
  voidwall: {
    id: 'voidwall', name: 'Пустотная стена', cost: 100, hp: 1000, cooldown: 14,
    color: PAL.uVoidwall, fill: PAL.uVoidwallF,
    upgradeKey: 'hp',
    role: 'Стена, которую почти не прогрызть'
  },
  disruptor: {
    id: 'disruptor', name: 'Разрядник', cost: 130, hp: 110, cooldown: 9,
    color: PAL.uDisruptor, fill: PAL.uDisruptorF,
    damage: 23, fireRate: 1.0, range: 7, pierceGuard: true, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Его разряду щиты не помеха'
  },
  stabilizer: {
    id: 'stabilizer', name: 'Стабилизатор', cost: 150, hp: 130, cooldown: 11,
    color: PAL.uStabilizer, fill: PAL.uStabilizerF,
    antiGlitch: true, upgradeKey: 'hp',
    role: 'Его колонку аномалия не глушит'
  },
  singular: {
    id: 'singular', name: 'Воронка', cost: 225, hp: 120, cooldown: 12,
    color: PAL.uSingular, fill: PAL.uSingularF,
    damage: 26, fireRate: 0.8, range: 6, pull: 1.1, shotSound: 'freeze',
    upgradeKey: 'damage',
    role: 'Тянет врага назад и рвёт по дороге'
  }
};

for (var _pu in PLANET_UNITS) UNIT_TYPES[_pu] = PLANET_UNITS[_pu];

/* Порядок карточек в нижней панели */
var UNIT_ORDER = [
  /* планета 1 */ 'beacon', 'barrier', 'shooter', 'spikes', 'mine',
  /* планета 2 */ 'ashwell', 'obelisk', 'slinger', 'shotgun', 'torch', 'umbrella',
  /* планета 3 */ 'condenser', 'icewall', 'repeater', 'freezer', 'magnet',
  /* планета 4 */ 'vinepod', 'stump', 'barb', 'chomper', 'fan', 'harpoon',
  /* планета 5 */ 'miner', 'prop', 'jack', 'mortar', 'pendulum', 'repair',
  /* планета 6 */ 'sporepod', 'tarwall', 'sting', 'laser', 'tesla', 'net',
  /* планета 7 */ 'glowfly', 'monolith', 'ray', 'lantern', 'cutter', 'anchor',
  /* планета 8 */ 'heatsink', 'shieldwall', 'smelter', 'rodtower', 'hammer',
  /* планета 9 */ 'resonator', 'voidwall', 'disruptor', 'stabilizer', 'singular',
  /* цитадель  */ 'altar', 'bastion', 'lancer', 'inquisitor', 'ward'
];

/* Множитель основного параметра по ступеням: 1 — обычный, 2 — улучшенный,
   3 — доступен только на Ледяной станции. */
var TIER_MUL = [1, 1, 1.5, 2.1];
var TIER_COST = [0, 2, 3.5];      // во столько раз от базовой цены стоит переход

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
      frozen: 0,         // остаток обледенения: пока тикает, юнит молчит
      spored: 0,         // споры: пока тикают, темп вдвое ниже
      stunned: 0,        // аномалия: колонка отключена
      busy: 0,           // капкан жуёт добычу
      dead: false
    };
  },

  /* Параметр с учётом ступени улучшения */
  stat: function (unit, key) {
    var base = unit.def[key];
    if (base === undefined) return undefined;
    if (unit.def.upgradeKey === key) return base * TIER_MUL[unit.level];
    return base;
  },

  canUpgrade: function (unit, maxTier) { return unit.level < (maxTier || 2); },

  upgradeCost: function (unit) {
    return Math.round(unit.def.cost * TIER_COST[unit.level]);
  },

  /* Возврат считаем от всего вложенного, включая улучшения, и урезаем
     по остатку здоровья: продавать полумёртвого за полную цену — способ
     бесконечно отыгрывать вложения обратно. */
  sellPrice: function (unit) {
    var paid = unit.def.cost;
    for (var t = 1; t < unit.level; t++) paid += Math.round(unit.def.cost * TIER_COST[t]);
    var health = unit.maxHp ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 1;
    return Math.max(1, Math.floor(paid * CONFIG.sellRefund * health));
  },

  /* Целость юнита в процентах — показываем её рядом с ценой продажи */
  healthPct: function (unit) {
    if (!unit.maxHp) return 100;
    return Math.max(0, Math.round(unit.hp / unit.maxHp * 100));
  },

  upgrade: function (unit) {
    unit.level = Math.min(3, unit.level + 1);
    if (unit.def.upgradeKey === 'hp') {
      unit.maxHp = unit.def.hp * TIER_MUL[unit.level];
      unit.hp = unit.maxHp;
    }
    unit.spawnT = 0;
  },

  /* Характеристики юнита на заданной ступени — для справочника.
     Возвращает [[подпись, значение, растёт ли с улучшением], ...] */
  describe: function (def, level) {
    var fake = { def: def, level: level };
    var grows = function (key) { return def.upgradeKey === key; };
    var lines = [];

    if (def.damage) lines.push(['Урон', Math.round(Units.stat(fake, 'damage')), grows('damage')]);
    if (def.fireRate) {
      lines.push(['Темп', def.fireRate >= 1
        ? def.fireRate.toFixed(1) + ' выстрела/с'
        : 'раз в ' + (1 / def.fireRate).toFixed(1) + ' с', false]);
    }
    if (def.burst) lines.push(['Снарядов за раз', def.burst, false]);
    if (def.spreadCols) lines.push(['Колонок', '3', false]);
    if (def.range && !def.strip) lines.push(['Дальность', def.range + ' кл.', grows('range')]);
    if (def.strip) lines.push(['Радиус', Math.round(Units.stat(fake, 'range')) + ' кл.', grows('range')]);
    if (def.slow) lines.push(['Замедление', Math.round(def.slow * 100) + '% на ' + def.slowTime + ' с', false]);
    if (def.boost) lines.push(['Усиление снарядов', '×' + Units.stat(fake, 'boost').toFixed(2), grows('boost')]);
    if (def.produce) {
      lines.push(['Доход', Math.round(Units.stat(fake, 'produce')) + ' искр раз в ' + def.interval + ' с', grows('produce')]);
    }
    if (def.onCrater) lines.push(['Ставится', 'только в кратер', false]);
    if (def.ecoBonus) lines.push(['Бонус за событие', '+' + def.ecoBonus + ' искр', false]);
    if (def.ecoVines) lines.push(['Ускорение', 'за каждую заросль рядом', false]);
    if (def.ecoDark) lines.push(['В темноте', 'вдвое больше искр', false]);
    if (def.chill) lines.push(['Морозит грызущего', def.chill + ' с', false]);
    if (def.noCollapse) lines.push(['Держит свод', 'обвалов в колонке нет', false]);
    if (def.litColumn) lines.push(['Подсветка колонки', '+' + Math.round((Units.stat(fake, 'litColumn') - 1) * 100) + '% урона', grows('litColumn')]);
    if (def.auraSlow) lines.push(['Замедление колонки', Math.round(Units.stat(fake, 'auraSlow') * 100) + '%', grows('auraSlow')]);
    if (def.meteorProof) lines.push(['Метеор', 'не берёт', false]);
    if (def.meteorMagnet) lines.push(['Метеоры', 'летят в него', false]);
    if (def.antiGlitch) lines.push(['Аномалия', 'колонку не глушит', false]);
    if (def.slam) lines.push(['Удар оземь', 'по всем вокруг', false]);
    if (def.pierceGuard) lines.push(['Щиты', 'не спасают', false]);
    if (def.tickDamage) lines.push(['Урон под ногами', Math.round(Units.stat(fake, 'tickDamage')) + '/с', grows('tickDamage')]);
    if (def.swallow) lines.push(['Глотает', 'одного врага целиком', false]);
    if (def.chewTime) lines.push(['Жуёт', Math.round(Units.stat(fake, 'chewTime')) + ' с', grows('chewTime')]);
    if (def.chain) lines.push(['Цепь', 'до ' + def.chain + ' врагов', false]);
    if (def.pull) lines.push(['Оттаскивает', def.pull + ' кл. назад', false]);
    if (def.shieldRange) lines.push(['Прикрывает', '±' + Math.round(Units.stat(fake, 'shieldRange')) + ' колонки', grows('shieldRange')]);
    if (def.sweep) lines.push(['Задевает', 'три колонки вплотную', false]);
    if (def.root) lines.push(['Пригвождает', Math.round(Units.stat(fake, 'root') * 10) / 10 + ' с', grows('root')]);
    if (def.splash) lines.push(['Разлёт', def.splash + ' кл. вокруг цели', false]);
    if (def.pierce) lines.push(['Прошивает', 'всех в колонке', false]);
    if (def.repair) lines.push(['Ремонт', Math.round(Units.stat(fake, 'repair')) + ' HP/с соседям', grows('repair')]);
    if (def.radius) lines.push(['Взрыв', def.radius + ' кл. вокруг', false]);
    lines.push(['Прочность', Math.round(def.hp * (grows('hp') ? TIER_MUL[level] : 1)), grows('hp')]);
    lines.push(['Перезарядка карточки', def.cooldown + ' с', false]);
    return lines;
  },

  tierCost: function (def, toLevel) {
    return Math.round(def.cost * TIER_COST[toLevel - 1]);
  },

  /* ======================================================================
     ОТРИСОВКА
     Каждый защитник рисуется вокруг точки (0,0) в координатах, кратных
     размеру клетки: так форма одинаково читается на любом экране.
     ====================================================================== */
  draw: function (ctx, x, y, cell, typeId, opts) {
    opts = opts || {};
    var t = UNIT_TYPES[typeId];
    var k = cell / 64;
    var s = opts.scale === undefined ? 1 : opts.scale;
    var time = opts.time || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Ступень 3 сидит на постаменте — он рисуется под корпусом
    if (opts.level > 2) Units.tierBase(ctx, cell, k, t, time);

    var shape = Units.shapes[typeId];
    shape(ctx, cell, k, t, opts, time);

    // Капкан с добычей во рту показывает, сколько ещё жевать
    if (opts.busy > 0 && opts.busyMax) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      Draw.bar(ctx, -cell * 0.22, cell * 0.30, cell * 0.44, Math.max(3, 3 * k),
        1 - opts.busy / opts.busyMax, PAL.gridLine, t.color);
      ctx.restore();
    }

    if (opts.level > 1) Units.tierMark(ctx, cell, k, t, opts.level, time);

    ctx.restore();

    // Вспышка выстрела — короткий блик над юнитом
    if (opts.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, opts.flash) * 0.9;
      ctx.fillStyle = t.color;
      Draw.circle(ctx, x, y - cell * 0.30 * s, 3.4 * k * s);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, opts.flash) * 0.3;
      Draw.circle(ctx, x, y - cell * 0.30 * s, 6.5 * k * s);
      ctx.fill();
      ctx.restore();
    }

    // Аномалия: колонка отключена, юнит мигает фиолетовым
    if (opts.stunned) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(time * 14);
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.setLineDash([4 * k, 3 * k]);
      Draw.roundRect(ctx, x - cell * 0.34, y - cell * 0.34, cell * 0.68, cell * 0.68, cell * 0.12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Споры: зелёная дымка над юнитом, темп стрельбы вдвое ниже
    if (opts.spored) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#65A30D';
      Draw.circle(ctx, x, y, cell * 0.34);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#84CC16';
      ctx.lineWidth = Math.max(1, k);
      ctx.setLineDash([3 * k, 3 * k]);
      Draw.circle(ctx, x, y, cell * 0.34);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Ледяная корка: юнит скован и не действует, пока по нему не тапнут
    if (opts.frozen) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = PAL.fillIce;
      Draw.roundRect(ctx, x - cell * 0.33, y - cell * 0.33, cell * 0.66, cell * 0.66, cell * 0.12);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = PAL.ice;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.stroke();
      // Осколки
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x - cell * 0.22, y - cell * 0.06); ctx.lineTo(x - cell * 0.06, y - cell * 0.22);
      ctx.moveTo(x + cell * 0.04, y + cell * 0.20); ctx.lineTo(x + cell * 0.22, y + cell * 0.02);
      ctx.moveTo(x - cell * 0.14, y + cell * 0.18); ctx.lineTo(x - cell * 0.02, y + cell * 0.06);
      ctx.stroke();
      ctx.restore();
    }

    // Полоска здоровья появляется только после урона
    if (opts.hp !== undefined && opts.maxHp && opts.hp < opts.maxHp) {
      var barW = cell * 0.5, barH = Math.max(3, 3.5 * k);
      var by = y + cell * 0.33;
      Draw.bar(ctx, x - barW / 2, by, barW, barH, opts.hp / opts.maxHp, PAL.gridLine, t.color);
    }
  },

  /* Постамент третьей ступени: кольцо под юнитом с четырьмя опорами */
  tierBase: function (ctx, u, k, t, time) {
    var spin = time * 0.6;
    ctx.save();
    ctx.strokeStyle = t.color;
    ctx.lineWidth = Math.max(1, 1.2 * k);

    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, u * 0.30, u * 0.36, u * 0.11, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Опоры медленно вращаются — юнит выглядит работающим, а не наклейкой
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = t.color;
    for (var i = 0; i < 4; i++) {
      var a = spin + i * Math.PI / 2;
      Draw.circle(ctx, Math.cos(a) * u * 0.36, u * 0.30 + Math.sin(a) * u * 0.11, 1.5 * k);
      ctx.fill();
    }
    ctx.restore();
  },

  /* Знак ступени: у второй — шеврон и боковые скобы,
     у третьей — двойной шеврон, рамка по углам и плотное свечение */
  tierMark: function (ctx, u, k, t, level, time) {
    ctx.save();
    ctx.strokeStyle = t.color;
    ctx.lineJoin = 'round';

    // Свечение по контуру корпуса
    ctx.globalAlpha = level > 2 ? 0.3 : 0.18;
    ctx.lineWidth = (level > 2 ? 5 : 3.5) * k;
    Draw.roundRect(ctx, -u * 0.33, -u * 0.33, u * 0.66, u * 0.66, u * 0.16);
    ctx.stroke();

    // Шевроны
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.5 * k;
    var chevrons = level > 2 ? 2 : 1;
    for (var i = 0; i < chevrons; i++) {
      var y = -u * 0.335 - i * u * 0.055;
      ctx.beginPath();
      ctx.moveTo(-u * 0.075, y);
      ctx.lineTo(0, y - u * 0.05);
      ctx.lineTo(u * 0.075, y);
      ctx.stroke();
    }

    // Угловые скобы: у второй ступени две, у третьей четыре
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4 * k;
    var c = u * 0.30, arm = u * 0.09;
    var corners = level > 2
      ? [[-1, -1], [1, -1], [-1, 1], [1, 1]]
      : [[-1, 1], [1, 1]];
    for (var j = 0; j < corners.length; j++) {
      var sx = corners[j][0], sy = corners[j][1];
      ctx.beginPath();
      ctx.moveTo(sx * c, sy * c - sy * arm);
      ctx.lineTo(sx * c, sy * c);
      ctx.lineTo(sx * c - sx * arm, sy * c);
      ctx.stroke();
    }

    // Третья ступень дышит
    if (level > 2) {
      ctx.globalAlpha = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(time * 2.4));
      ctx.lineWidth = 2 * k;
      Draw.circle(ctx, 0, 0, u * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* Корпус базового стрелка: тумба, ствол и своя начинка в дуле */
  basicGun: function (ctx, u, k, t, opts, time, kind) {
    ctx.lineWidth = Math.max(1, k);
    ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
    ctx.strokeStyle = t.color;

    Draw.roundRect(ctx, -u * 0.06, -u * 0.34, u * 0.12, u * 0.22, u * 0.03);
    ctx.fill(); ctx.stroke();
    Units.body(ctx, t, opts, u * 0.44, u * 0.38, u * 0.10, u * 0.06);

    ctx.fillStyle = t.color;
    ctx.strokeStyle = t.color;
    var cy = -u * 0.30, pulse = 0.5 + 0.5 * Math.sin(time * 3);

    if (kind === 'rock') {
      Draw.ngon(ctx, 0, cy, u * 0.05, 5, time * 0.6); ctx.fill();
    } else if (kind === 'spike') {
      Draw.poly(ctx, [[0, cy - u * 0.07], [u * 0.04, cy + u * 0.04], [-u * 0.04, cy + u * 0.04]]);
      ctx.fill();
    } else if (kind === 'drill') {
      ctx.lineWidth = Math.max(1, 1.3 * k);
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        ctx.moveTo(-u * 0.05, cy - u * 0.05 + i * u * 0.05);
        ctx.lineTo(u * 0.05, cy - u * 0.02 + i * u * 0.05);
      }
      ctx.stroke();
    } else if (kind === 'spore') {
      ctx.globalAlpha = 0.4 + 0.4 * pulse;
      Draw.circle(ctx, 0, cy, u * 0.055); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, cy, u * 0.025); ctx.fill();
    } else {
      ctx.globalAlpha = 0.3 + 0.4 * pulse;
      ctx.fillRect(-u * 0.025, cy - u * 0.08, u * 0.05, u * 0.14);
      ctx.globalAlpha = 1;
    }

    // Опора
    ctx.fillStyle = t.color;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(-u * 0.20, u * 0.20, u * 0.40, u * 0.05);
    ctx.globalAlpha = 1;
  },

  /* Общая подложка: корпус с обводкой цвета роли */
  body: function (ctx, t, opts, w, h, r, oy) {
    ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
    Draw.roundRect(ctx, -w / 2, -h / 2 + (oy || 0), w, h, r);
    ctx.fill();
    ctx.strokeStyle = t.color;
    ctx.stroke();
  },

  shapes: {
    /* Маяк: приземистая башня с пульсирующей линзой и двумя лучами */
    beacon: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var pulse = 0.5 + 0.5 * Math.sin(time * 2.2);

      // Основание
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.21, u * 0.28], [u * 0.21, u * 0.28],
        [u * 0.14, -u * 0.12], [-u * 0.14, -u * 0.12]
      ]);
      ctx.fill(); ctx.stroke();

      // Поясок на башне
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(-u * 0.175, u * 0.09); ctx.lineTo(u * 0.175, u * 0.09);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Фонарь
      Draw.roundRect(ctx, -u * 0.15, -u * 0.30, u * 0.30, u * 0.19, u * 0.04);
      ctx.fill(); ctx.stroke();

      // Линза: ореол пульсирует, ядро горит ровно
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.18 + 0.22 * pulse;
      Draw.circle(ctx, 0, -u * 0.205, u * 0.115 + u * 0.02 * pulse);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.205, u * 0.055);
      ctx.fill();

      // Лучи в стороны
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.25 * pulse;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.21, -u * 0.245); ctx.lineTo(-u * 0.32, -u * 0.275);
      ctx.moveTo(u * 0.21, -u * 0.245); ctx.lineTo(u * 0.32, -u * 0.275);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Стрелок: корпус с плечами, ствол вверх и светящийся прицел */
    shooter: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Ствол
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.055, -u * 0.34, u * 0.11, u * 0.20, u * 0.025);
      ctx.fill(); ctx.stroke();

      // Корпус
      Units.body(ctx, t, opts, u * 0.46, u * 0.42, u * 0.11, u * 0.04);

      // Плечи-опоры
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-u * 0.29, -u * 0.06, u * 0.06, u * 0.16);
      ctx.fillRect(u * 0.23, -u * 0.06, u * 0.06, u * 0.16);
      ctx.globalAlpha = 1;

      // Прицел
      ctx.globalAlpha = 0.22;
      Draw.circle(ctx, 0, u * 0.05, u * 0.105);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, u * 0.05, u * 0.05);
      ctx.fill();
    },

    /* Барьер: широкий блок из плит с заклёпками */
    barrier: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.74, u * 0.44, u * 0.07, u * 0.03);

      // Вертикальные швы между плитами
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.125, -u * 0.17); ctx.lineTo(-u * 0.125, u * 0.23);
      ctx.moveTo(u * 0.125, -u * 0.17); ctx.lineTo(u * 0.125, u * 0.23);
      ctx.stroke();

      // Заклёпки по углам
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = t.color;
      var rx = u * 0.30, ry1 = -u * 0.12, ry2 = u * 0.18;
      Draw.circle(ctx, -rx, ry1, u * 0.022); ctx.fill();
      Draw.circle(ctx, rx, ry1, u * 0.022); ctx.fill();
      Draw.circle(ctx, -rx, ry2, u * 0.022); ctx.fill();
      Draw.circle(ctx, rx, ry2, u * 0.022); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Морозилка: шестигранник со снежинкой и инеем */
    freezer: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.ngon(ctx, 0, 0, u * 0.29, 6, Math.PI / 6);
      ctx.fill(); ctx.stroke();

      // Снежинка: три луча через центр
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      var r = u * 0.155;
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var a = i * Math.PI / 3 + Math.PI / 6;
        ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();

      // Иней: точка в центре и лёгкое мерцание по кромке
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, 0, u * 0.035); ctx.fill();
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 1.7);
      Draw.glowCircle(ctx, 0, 0, u * 0.29, t.color, 1, 2 * k);
      ctx.globalAlpha = 1;
    },

    /* Дробовик: приземистый корпус с двумя стволами */
    shotgun: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Два ствола
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.13, -u * 0.32, u * 0.10, u * 0.18, u * 0.02);
      ctx.fill(); ctx.stroke();
      Draw.roundRect(ctx, u * 0.03, -u * 0.32, u * 0.10, u * 0.18, u * 0.02);
      ctx.fill(); ctx.stroke();

      // Корпус трапецией — шире книзу
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.poly(ctx, [
        [-u * 0.22, -u * 0.16], [u * 0.22, -u * 0.16],
        [u * 0.29, u * 0.27], [-u * 0.29, u * 0.27]
      ]);
      ctx.fill(); ctx.stroke();

      // Затвор
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-u * 0.15, u * 0.02, u * 0.30, u * 0.045);
      ctx.globalAlpha = 1;
    },

    /* Дуплет: широкий корпус с двумя параллельными стволами */
    repeater: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = t.fill;
      ctx.strokeStyle = t.color;

      Draw.roundRect(ctx, -u * 0.155, -u * 0.36, u * 0.11, u * 0.24, u * 0.025);
      ctx.fill(); ctx.stroke();
      Draw.roundRect(ctx, u * 0.045, -u * 0.36, u * 0.11, u * 0.24, u * 0.025);
      ctx.fill(); ctx.stroke();

      Units.body(ctx, t, opts, u * 0.52, u * 0.40, u * 0.11, u * 0.05);

      // Два прицела
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25;
      Draw.circle(ctx, -u * 0.10, u * 0.06, u * 0.085); ctx.fill();
      Draw.circle(ctx, u * 0.10, u * 0.06, u * 0.085); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, -u * 0.10, u * 0.06, u * 0.04); ctx.fill();
      Draw.circle(ctx, u * 0.10, u * 0.06, u * 0.04); ctx.fill();
    },

    /* Веер: три ствола, расходящиеся в стороны */
    fan: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.strokeStyle = t.color;
      ctx.fillStyle = t.fill;

      // Стволы веером
      var angles = [-0.42, 0, 0.42];
      for (var i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(angles[i]);
        Draw.roundRect(ctx, -u * 0.045, -u * 0.36, u * 0.09, u * 0.20, u * 0.02);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      Units.body(ctx, t, opts, u * 0.50, u * 0.36, u * 0.10, u * 0.07);

      // Веерная риска на корпусе
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.arc(0, u * 0.10, u * 0.12, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Горн: жаровня с живым языком пламени */
    torch: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var flick = 0.5 + 0.5 * Math.sin(time * 7.3);

      // Чаша
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.26, u * 0.02], [u * 0.26, u * 0.02],
        [u * 0.17, u * 0.27], [-u * 0.17, u * 0.27]
      ]);
      ctx.fill(); ctx.stroke();

      // Ножка
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-u * 0.10, u * 0.27, u * 0.20, u * 0.04);
      ctx.globalAlpha = 1;

      // Пламя: внешний язык дышит, ядро ровное
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.2 * flick;
      Draw.poly(ctx, [
        [0, -u * 0.34 - u * 0.04 * flick],
        [u * 0.13, u * 0.01], [-u * 0.13, u * 0.01]
      ]);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.poly(ctx, [
        [0, -u * 0.20 - u * 0.03 * flick],
        [u * 0.06, u * 0.01], [-u * 0.06, u * 0.01]
      ]);
      ctx.fill();
    },

    /* Магнит: подкова с двумя полюсами */
    magnet: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.50, u * 0.46, u * 0.12, 0);

      // Дуга подковы
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(2, 4 * k);
      ctx.beginPath();
      ctx.arc(0, u * 0.03, u * 0.14, Math.PI, Math.PI * 2);
      ctx.stroke();

      // Полюса
      ctx.fillStyle = t.color;
      ctx.fillRect(-u * 0.175, u * 0.03, u * 0.07, u * 0.11);
      ctx.fillRect(u * 0.105, u * 0.03, u * 0.07, u * 0.11);

      // Поле вокруг — дышит
      ctx.globalAlpha = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(time * 2.6));
      Draw.glowCircle(ctx, 0, 0, u * 0.26, t.color, 1, 3 * k);
      ctx.globalAlpha = 1;
    },

    /* Мортира: короткий толстый ствол под углом на станине */
    mortar: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Станина
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.28, u * 0.10], [u * 0.28, u * 0.10],
        [u * 0.22, u * 0.28], [-u * 0.22, u * 0.28]
      ]);
      ctx.fill(); ctx.stroke();

      // Ствол навесом
      ctx.save();
      ctx.rotate(-0.28);
      Draw.roundRect(ctx, -u * 0.105, -u * 0.32, u * 0.21, u * 0.38, u * 0.05);
      ctx.fill(); ctx.stroke();
      // Дульный срез
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = t.color;
      ctx.fillRect(-u * 0.08, -u * 0.30, u * 0.16, u * 0.035);
      ctx.globalAlpha = 1;
      ctx.restore();

      // Опорные колёса
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.55;
      Draw.circle(ctx, -u * 0.21, u * 0.20, u * 0.045); ctx.fill();
      Draw.circle(ctx, u * 0.21, u * 0.20, u * 0.045); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Лазер: узкая стойка с линзой и разрядником сверху */
    laser: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var charge = 0.5 + 0.5 * Math.sin(time * 6);

      // Стойка
      Units.body(ctx, t, opts, u * 0.34, u * 0.44, u * 0.09, u * 0.06);

      // Излучатель
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.13, -u * 0.16], [u * 0.13, -u * 0.16],
        [u * 0.06, -u * 0.34], [-u * 0.06, -u * 0.34]
      ]);
      ctx.fill(); ctx.stroke();

      // Линза копит заряд
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.35 * charge;
      Draw.circle(ctx, 0, -u * 0.31, u * 0.055 + u * 0.015 * charge);
      ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.31, u * 0.025);
      ctx.fill();

      // Рёбра охлаждения
      ctx.globalAlpha = 0.45;
      for (var i = -1; i <= 1; i++) {
        ctx.fillRect(-u * 0.17 + (i + 1) * u * 0.115, u * 0.02, u * 0.045, u * 0.14);
      }
      ctx.globalAlpha = 1;
    },

    /* Ремонтник: корпус с манипулятором и вращающимся ключом */
    repair: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.46, u * 0.42, u * 0.13, u * 0.04);

      // Манипулятор описывает круг — видно, что юнит работает
      var a = time * 1.4;
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.02);
      ctx.lineTo(Math.cos(a) * u * 0.22, u * 0.02 + Math.sin(a) * u * 0.22);
      ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, Math.cos(a) * u * 0.22, u * 0.02 + Math.sin(a) * u * 0.22, u * 0.035);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Крест ремонта в центре
      ctx.lineWidth = Math.max(1, 1.5 * k);
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.07); ctx.lineTo(0, u * 0.11);
      ctx.moveTo(-u * 0.09, u * 0.02); ctx.lineTo(u * 0.09, u * 0.02);
      ctx.stroke();
    },

    /* Шипы: плоская гребёнка на земле */
    spikes: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.32, u * 0.06, u * 0.64, u * 0.18, u * 0.05);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = t.color;
      for (var i = 0; i < 5; i++) {
        var x = -u * 0.26 + i * u * 0.13;
        Draw.poly(ctx, [[x - u * 0.045, u * 0.06], [x + u * 0.045, u * 0.06], [x, u * 0.06 - u * 0.16]]);
        ctx.fill();
      }
    },

    /* Капкан: раскрытая пасть, в жевании закрывается */
    chomper: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var open = opts.busy ? 0.08 : 0.30 + 0.05 * Math.sin(time * 2);

      // Стебель
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.30); ctx.lineTo(0, u * 0.02);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, k);

      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      // Нижняя челюсть
      Draw.poly(ctx, [[-u * 0.24, u * 0.04], [u * 0.24, u * 0.04],
                      [u * 0.16, u * 0.20], [-u * 0.16, u * 0.20]]);
      ctx.fill(); ctx.stroke();
      // Верхняя челюсть раскрывается
      ctx.save();
      ctx.translate(0, u * 0.02);
      ctx.rotate(-open);
      Draw.poly(ctx, [[-u * 0.24, 0], [u * 0.24, 0], [u * 0.16, -u * 0.20], [-u * 0.16, -u * 0.20]]);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, u * 0.11, u * 0.03); ctx.fill();
    },

    /* Молния: катушка с дугой разряда */
    tesla: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.34, u * 0.34, u * 0.08, u * 0.12);

      // Катушка
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.7;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, u * 0.02 + i * u * 0.075, u * 0.14, u * 0.035, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Шар и разряд
      ctx.fillStyle = t.color;
      var pulse = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      Draw.circle(ctx, 0, -u * 0.20, u * 0.12); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.20, u * 0.055); ctx.fill();

      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.10, -u * 0.30);
      ctx.lineTo(-u * 0.03, -u * 0.24);
      ctx.lineTo(-u * 0.08, -u * 0.18);
      ctx.stroke();
    },

    /* Гарпун: станок с наконечником и тросом */
    harpoon: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.42, u * 0.32, u * 0.09, u * 0.14);

      // Направляющая
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.05, -u * 0.26, u * 0.10, u * 0.34, u * 0.03);
      ctx.fill(); ctx.stroke();

      // Наконечник
      ctx.fillStyle = t.color;
      Draw.poly(ctx, [[0, -u * 0.36], [u * 0.09, -u * 0.22], [-u * 0.09, -u * 0.22]]);
      ctx.fill();

      // Трос
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, u * 0.12);
      ctx.quadraticCurveTo(0, u * 0.04, u * 0.14, u * 0.12);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Зонт: купол на короткой ножке */
    umbrella: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);

      // Ножка
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.28); ctx.lineTo(0, -u * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, k);

      // Купол
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.beginPath();
      ctx.moveTo(-u * 0.32, -u * 0.04);
      ctx.quadraticCurveTo(0, -u * 0.40, u * 0.32, -u * 0.04);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Рёбра
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-u * 0.16, -u * 0.04); ctx.quadraticCurveTo(-u * 0.14, -u * 0.24, 0, -u * 0.30);
      ctx.moveTo(u * 0.16, -u * 0.04); ctx.quadraticCurveTo(u * 0.14, -u * 0.24, 0, -u * 0.30);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Маятник: груз на подвесе, ходит из стороны в сторону */
    pendulum: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var sway = Math.sin(time * 2.2) * 0.5;

      // Рама
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.26, u * 0.28); ctx.lineTo(0, -u * 0.26);
      ctx.lineTo(u * 0.26, u * 0.28);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Подвес с грузом
      ctx.save();
      ctx.translate(0, -u * 0.26);
      ctx.rotate(sway);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, u * 0.34);
      ctx.stroke();
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.circle(ctx, 0, u * 0.40, u * 0.11);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, u * 0.40, u * 0.04);
      ctx.fill();
      ctx.restore();
    },

    /* Сеть: катушка с растянутым полотном */
    net: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.40, u * 0.30, u * 0.08, u * 0.15);

      // Полотно
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = Math.max(1, k);
      ctx.beginPath();
      for (var i = -2; i <= 2; i++) {
        ctx.moveTo(i * u * 0.09, -u * 0.30);
        ctx.lineTo(i * u * 0.09 * 0.55, -u * 0.04);
      }
      for (var j = 0; j < 3; j++) {
        var y = -u * 0.28 + j * u * 0.10;
        var half = u * 0.19 * (1 - j * 0.22);
        ctx.moveTo(-half, y); ctx.lineTo(half, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Базовые стрелки: общий корпус со стволом, отличаются деталью в дуле.
       Так планета сразу читается: форма знакомая, цвет и начинка свои. */
    slinger: function (ctx, u, k, t, opts, time) { Units.basicGun(ctx, u, k, t, opts, time, 'rock'); },
    barb:    function (ctx, u, k, t, opts, time) { Units.basicGun(ctx, u, k, t, opts, time, 'spike'); },
    jack:    function (ctx, u, k, t, opts, time) { Units.basicGun(ctx, u, k, t, opts, time, 'drill'); },
    sting:   function (ctx, u, k, t, opts, time) { Units.basicGun(ctx, u, k, t, opts, time, 'spore'); },
    ray:     function (ctx, u, k, t, opts, time) { Units.basicGun(ctx, u, k, t, opts, time, 'beam'); },

    /* --- Акт 4: Цитадель --- */
    /* Алтарь: чаша на ступенях, над ней парит огонёк */
    altar: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var glow = 0.5 + 0.5 * Math.sin(time * 2.2);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.30, u * 0.14], [u * 0.30, u * 0.14],
                      [u * 0.24, u * 0.30], [-u * 0.24, u * 0.30]]);
      ctx.fill(); ctx.stroke();
      Draw.poly(ctx, [[-u * 0.20, -u * 0.06], [u * 0.20, -u * 0.06],
                      [u * 0.15, u * 0.14], [-u * 0.15, u * 0.14]]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.2 + 0.35 * glow;
      Draw.circle(ctx, 0, -u * 0.22, u * 0.12 + u * 0.02 * glow); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.22, u * 0.055); ctx.fill();
    },

    /* Бастион: зубчатая башня */
    bastion: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [
        [-u * 0.32, -u * 0.22], [-u * 0.32, -u * 0.34], [-u * 0.18, -u * 0.34],
        [-u * 0.18, -u * 0.24], [-u * 0.06, -u * 0.24], [-u * 0.06, -u * 0.34],
        [u * 0.06, -u * 0.34], [u * 0.06, -u * 0.24], [u * 0.18, -u * 0.24],
        [u * 0.18, -u * 0.34], [u * 0.32, -u * 0.34], [u * 0.32, -u * 0.22],
        [u * 0.30, u * 0.30], [-u * 0.30, u * 0.30]
      ]);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var y = -u * 0.10 + i * u * 0.13;
        ctx.moveTo(-u * 0.26, y); ctx.lineTo(u * 0.26, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      // Бойница
      ctx.fillStyle = PAL.bgDeep;
      Draw.roundRect(ctx, -u * 0.05, -u * 0.16, u * 0.10, u * 0.16, u * 0.04);
      ctx.fill();
    },

    /* Копейщик: станок с копьём наготове */
    lancer: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.42, u * 0.30, u * 0.09, u * 0.14);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2.2 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.10); ctx.lineTo(0, -u * 0.30);
      ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.poly(ctx, [[0, -u * 0.44], [u * 0.08, -u * 0.26], [-u * 0.08, -u * 0.26]]);
      ctx.fill();
      ctx.lineWidth = Math.max(1, k);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-u * 0.12, -u * 0.18); ctx.lineTo(u * 0.12, -u * 0.18);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Инквизитор: тяжёлый ствол на треноге */
    inquisitor: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.24, u * 0.30); ctx.lineTo(0, u * 0.02);
      ctx.moveTo(u * 0.24, u * 0.30); ctx.lineTo(0, u * 0.02);
      ctx.moveTo(0, u * 0.30); ctx.lineTo(0, u * 0.02);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.roundRect(ctx, -u * 0.13, -u * 0.38, u * 0.26, u * 0.42, u * 0.05);
      ctx.fill(); ctx.stroke();
      // Дульный срез
      ctx.fillStyle = PAL.bgDeep;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.37, u * 0.10, u * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.stroke();
      // Клеймо
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-u * 0.09, -u * 0.16, u * 0.18, u * 0.05);
      ctx.globalAlpha = 1;
    },

    /* Оберег: печать в раме, которая медленно вращается */
    ward: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.26, u * 0.20, u * 0.06, u * 0.22);
      ctx.save();
      ctx.translate(0, -u * 0.14);
      ctx.rotate(time * 0.5);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      Draw.ngon(ctx, 0, 0, u * 0.22, 6, 0);
      ctx.stroke();
      Draw.ngon(ctx, 0, 0, u * 0.13, 3, Math.PI / 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2.6);
      Draw.circle(ctx, 0, -u * 0.14, u * 0.055); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* --- Планета 2 --- */
    /* Колодец: сруб над кратером, из которого поднимается пепел */
    ashwell: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var puff = (time * 0.5) % 1;
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.26, u * 0.06], [u * 0.26, u * 0.06],
                      [u * 0.20, u * 0.28], [-u * 0.20, u * 0.28]]);
      ctx.fill(); ctx.stroke();
      // Навес
      Draw.poly(ctx, [[0, -u * 0.34], [u * 0.28, -u * 0.12], [-u * 0.28, -u * 0.12]]);
      ctx.fill(); ctx.stroke();
      // Стойки
      ctx.strokeStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(-u * 0.18, -u * 0.12); ctx.lineTo(-u * 0.18, u * 0.06);
      ctx.moveTo(u * 0.18, -u * 0.12); ctx.lineTo(u * 0.18, u * 0.06);
      ctx.stroke();
      // Дымок пепла
      ctx.globalAlpha = 0.5 * (1 - puff);
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, u * 0.02 - puff * u * 0.16, u * 0.05 + puff * u * 0.03);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Обелиск: узкий каменный столб с рунной насечкой */
    obelisk: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[0, -u * 0.38], [u * 0.17, -u * 0.22],
                      [u * 0.20, u * 0.28], [-u * 0.20, u * 0.28], [-u * 0.17, -u * 0.22]]);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var y = -u * 0.12 + i * u * 0.13;
        ctx.moveTo(-u * 0.11, y); ctx.lineTo(u * 0.11, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* --- Планета 3 --- */
    /* Конденсатор: колба с инеем и датчиком заряда */
    condenser: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var fill = 0.5 + 0.5 * Math.sin(time * 1.6);
      Units.body(ctx, t, opts, u * 0.34, u * 0.46, u * 0.14, u * 0.02);
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.2 + 0.25 * fill;
      Draw.roundRect(ctx, -u * 0.11, u * 0.02 - u * 0.18 * fill, u * 0.22, u * 0.18 * fill + u * 0.02, u * 0.04);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Кристаллы инея
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.3 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.20, -u * 0.30); ctx.lineTo(-u * 0.28, -u * 0.38);
      ctx.moveTo(u * 0.20, -u * 0.30); ctx.lineTo(u * 0.28, -u * 0.38);
      ctx.stroke();
      Draw.circle(ctx, 0, -u * 0.30, u * 0.05); ctx.fill();
    },

    /* Ледяная стена: глыба со сколами */
    icewall: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.34, -u * 0.14], [-u * 0.10, -u * 0.26], [u * 0.20, -u * 0.20],
                      [u * 0.36, u * 0.04], [u * 0.24, u * 0.28], [-u * 0.26, u * 0.26]]);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, -u * 0.22); ctx.lineTo(-u * 0.02, u * 0.02); ctx.lineTo(-u * 0.16, u * 0.24);
      ctx.moveTo(u * 0.06, -u * 0.20); ctx.lineTo(u * 0.16, u * 0.06);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* --- Планета 4 --- */
    /* Лоза: стручок на побеге, усики тянутся в стороны */
    vinepod: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var sway = Math.sin(time * 1.3) * u * 0.02;
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.26, u * 0.28); ctx.quadraticCurveTo(-u * 0.08, u * 0.10, sway, -u * 0.06);
      ctx.moveTo(u * 0.26, u * 0.28); ctx.quadraticCurveTo(u * 0.10, u * 0.12, sway, -u * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.poly(ctx, [[sway, -u * 0.34], [sway + u * 0.16, -u * 0.16], [sway + u * 0.12, u * 0.08],
                      [sway - u * 0.12, u * 0.08], [sway - u * 0.16, -u * 0.16]]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6;
      for (var i = 0; i < 3; i++) { Draw.circle(ctx, sway, -u * 0.20 + i * u * 0.10, u * 0.035); ctx.fill(); }
      ctx.globalAlpha = 1;
    },

    /* Пень: широкий срез с кольцами и корнями */
    stump: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.32, -u * 0.10], [u * 0.32, -u * 0.10],
                      [u * 0.26, u * 0.26], [-u * 0.26, u * 0.26]]);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.10, u * 0.32, u * 0.09, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.10, u * 0.19, u * 0.055, 0, 0, Math.PI * 2);
      ctx.ellipse(0, -u * 0.10, u * 0.09, u * 0.025, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Корни
      ctx.beginPath();
      ctx.moveTo(-u * 0.26, u * 0.26); ctx.lineTo(-u * 0.34, u * 0.32);
      ctx.moveTo(u * 0.26, u * 0.26); ctx.lineTo(u * 0.34, u * 0.32);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* --- Планета 5 --- */
    /* Рудокоп: вагонетка с киркой */
    miner: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var swing = Math.sin(time * 2.4) * 0.35;
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.28, -u * 0.04], [u * 0.28, -u * 0.04],
                      [u * 0.22, u * 0.22], [-u * 0.22, u * 0.22]]);
      ctx.fill(); ctx.stroke();
      // Колёса
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6;
      Draw.circle(ctx, -u * 0.16, u * 0.25, u * 0.05); ctx.fill();
      Draw.circle(ctx, u * 0.16, u * 0.25, u * 0.05); ctx.fill();
      ctx.globalAlpha = 1;
      // Кирка
      ctx.save();
      ctx.translate(u * 0.04, -u * 0.08);
      ctx.rotate(swing - 0.5);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -u * 0.26);
      ctx.moveTo(-u * 0.11, -u * 0.24); ctx.quadraticCurveTo(0, -u * 0.32, u * 0.11, -u * 0.24);
      ctx.stroke();
      ctx.restore();
    },

    /* Крепь: две стойки под перекладиной */
    prop: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.32, -u * 0.28, u * 0.64, u * 0.13, u * 0.04);
      ctx.fill(); ctx.stroke();
      Draw.roundRect(ctx, -u * 0.26, -u * 0.15, u * 0.13, u * 0.42, u * 0.03);
      ctx.fill(); ctx.stroke();
      Draw.roundRect(ctx, u * 0.13, -u * 0.15, u * 0.13, u * 0.42, u * 0.03);
      ctx.fill(); ctx.stroke();
      // Распорка наискось
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-u * 0.12, -u * 0.12); ctx.lineTo(u * 0.12, u * 0.20);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* --- Планета 6 --- */
    /* Споровик: шляпка, роняющая споры */
    sporepod: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var drop = (time * 0.7) % 1;
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.09, -u * 0.06, u * 0.18, u * 0.32, u * 0.04);
      ctx.fill(); ctx.stroke();
      Draw.poly(ctx, [[0, -u * 0.34], [u * 0.30, -u * 0.12], [-u * 0.30, -u * 0.12]]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.6 * (1 - drop);
      Draw.circle(ctx, -u * 0.16, -u * 0.08 + drop * u * 0.24, u * 0.032); ctx.fill();
      Draw.circle(ctx, u * 0.14, -u * 0.08 + drop * u * 0.20, u * 0.028); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Смоляная стена: оплывшая глыба с каплей */
    tarwall: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var drip = (time * 0.4) % 1;
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.32, -u * 0.18], [u * 0.32, -u * 0.18],
                      [u * 0.28, u * 0.14], [u * 0.10, u * 0.26],
                      [-u * 0.12, u * 0.24], [-u * 0.28, u * 0.12]]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.55 * (1 - drip);
      Draw.circle(ctx, u * 0.06, u * 0.24 + drip * u * 0.10, u * 0.035);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(-u * 0.16, -u * 0.12); ctx.lineTo(-u * 0.16, u * 0.14);
      ctx.moveTo(u * 0.14, -u * 0.12); ctx.lineTo(u * 0.14, u * 0.10);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* --- Планета 7 --- */
    /* Светляк: фонарик на тонкой ножке, вокруг мотыльки света */
    glowfly: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var pulse = 0.5 + 0.5 * Math.sin(time * 2.8);
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, 1.8 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.30); ctx.lineTo(0, u * 0.00);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.circle(ctx, 0, -u * 0.14, u * 0.16);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.2 + 0.35 * pulse;
      Draw.circle(ctx, 0, -u * 0.14, u * 0.11 + u * 0.02 * pulse); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, -u * 0.14, u * 0.05); ctx.fill();
      // Мотыльки
      ctx.globalAlpha = 0.45;
      for (var i = 0; i < 3; i++) {
        var a = time * 1.1 + i * 2.1;
        Draw.circle(ctx, Math.cos(a) * u * 0.28, -u * 0.14 + Math.sin(a) * u * 0.22, u * 0.022);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    /* Монолит: цельная плита с трещиной */
    monolith: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.26, -u * 0.34, u * 0.52, u * 0.62, u * 0.05);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(u * 0.04, -u * 0.34); ctx.lineTo(-u * 0.04, -u * 0.06);
      ctx.lineTo(u * 0.06, u * 0.08); ctx.lineTo(-u * 0.02, u * 0.28);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, -u * 0.20, u * 0.035); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Фонарь: раструб света, направленный вверх по колонке */
    lantern: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var glow = 0.5 + 0.5 * Math.sin(time * 2);
      // Конус света
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.10 + 0.07 * glow;
      Draw.poly(ctx, [[-u * 0.09, -u * 0.20], [u * 0.09, -u * 0.20],
                      [u * 0.34, -u * 0.62], [-u * 0.34, -u * 0.62]]);
      ctx.fill();
      ctx.globalAlpha = 1;
      Units.body(ctx, t, opts, u * 0.36, u * 0.34, u * 0.10, u * 0.10);
      // Плафон
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.16, -u * 0.06], [u * 0.16, -u * 0.06],
                      [u * 0.09, -u * 0.26], [-u * 0.09, -u * 0.26]]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.35 + 0.4 * glow;
      Draw.circle(ctx, 0, -u * 0.14, u * 0.07); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Резак: диск с зубьями на станине */
    cutter: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var spin = time * 3;
      Units.body(ctx, t, opts, u * 0.40, u * 0.26, u * 0.08, u * 0.16);
      ctx.save();
      ctx.translate(0, -u * 0.10);
      ctx.rotate(spin);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.circle(ctx, 0, 0, u * 0.19);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3;
        Draw.poly(ctx, [
          [Math.cos(a) * u * 0.19, Math.sin(a) * u * 0.19],
          [Math.cos(a + 0.25) * u * 0.19, Math.sin(a + 0.25) * u * 0.19],
          [Math.cos(a + 0.12) * u * 0.27, Math.sin(a + 0.12) * u * 0.27]
        ]);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, -u * 0.10, u * 0.045); ctx.fill();
    },

    /* Якорь: массивная лапа на цепи */
    anchor: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.34); ctx.lineTo(0, u * 0.10);
      ctx.moveTo(-u * 0.14, -u * 0.26); ctx.lineTo(u * 0.14, -u * 0.26);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.circle(ctx, 0, -u * 0.34, u * 0.07);
      ctx.fill(); ctx.stroke();
      // Лапы
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2.4 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.24, u * 0.04);
      ctx.quadraticCurveTo(-u * 0.20, u * 0.26, 0, u * 0.26);
      ctx.quadraticCurveTo(u * 0.20, u * 0.26, u * 0.24, u * 0.04);
      ctx.stroke();
      // Волны замедления
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2.2);
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      ctx.arc(0, -u * 0.06, u * 0.32, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* --- Планета 8 --- */
    /* Теплосборник: ребристый радиатор с жаром внутри */
    heatsink: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var heat = 0.5 + 0.5 * Math.sin(time * 2.6);
      Units.body(ctx, t, opts, u * 0.46, u * 0.42, u * 0.08, u * 0.02);
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.55;
      for (var i = 0; i < 4; i++) {
        ctx.fillRect(-u * 0.20 + i * u * 0.115, -u * 0.30, u * 0.05, u * 0.14);
      }
      ctx.globalAlpha = 0.2 + 0.35 * heat;
      Draw.circle(ctx, 0, u * 0.04, u * 0.11 + u * 0.02 * heat); ctx.fill();
      ctx.globalAlpha = 1;
      Draw.circle(ctx, 0, u * 0.04, u * 0.05); ctx.fill();
    },

    /* Жаростойкая стена: плита под козырьком */
    shieldwall: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.36, -u * 0.20], [u * 0.36, -u * 0.20],
                      [u * 0.28, -u * 0.08], [-u * 0.28, -u * 0.08]]);
      ctx.fill(); ctx.stroke();
      Draw.roundRect(ctx, -u * 0.28, -u * 0.08, u * 0.56, u * 0.36, u * 0.05);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, -u * 0.04); ctx.lineTo(-u * 0.14, u * 0.24);
      ctx.moveTo(u * 0.14, -u * 0.04); ctx.lineTo(u * 0.14, u * 0.24);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Плавильщик: тигель с каплями расплава */
    smelter: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var bub = (time * 1.4) % 1;
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.poly(ctx, [[-u * 0.24, -u * 0.18], [u * 0.24, -u * 0.18],
                      [u * 0.18, u * 0.26], [-u * 0.18, u * 0.26]]);
      ctx.fill(); ctx.stroke();
      // Носик
      Draw.poly(ctx, [[u * 0.14, -u * 0.18], [u * 0.30, -u * 0.32], [u * 0.22, -u * 0.12]]);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(0, -u * 0.16, u * 0.21, u * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7 * (1 - bub);
      Draw.circle(ctx, -u * 0.06, -u * 0.18 - bub * u * 0.12, u * 0.028); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Громоотвод: высокий шпиль с шаром-приёмником */
    rodtower: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var spark = 0.5 + 0.5 * Math.sin(time * 6);
      Units.body(ctx, t, opts, u * 0.30, u * 0.24, u * 0.06, u * 0.18);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2.4 * k);
      ctx.beginPath();
      ctx.moveTo(0, u * 0.08); ctx.lineTo(0, -u * 0.36);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.circle(ctx, 0, -u * 0.40, u * 0.09);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.25 + 0.45 * spark;
      Draw.circle(ctx, 0, -u * 0.40, u * 0.06); ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = t.color;
      ctx.beginPath();
      ctx.arc(0, -u * 0.40, u * 0.18, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Молот: боёк на коленчатом рычаге */
    hammer: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var lift = Math.max(0, Math.sin(time * 2.4)) * u * 0.10;
      Units.body(ctx, t, opts, u * 0.42, u * 0.22, u * 0.06, u * 0.20);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2.2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.04, u * 0.20); ctx.lineTo(-u * 0.04, -u * 0.12 - lift);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      Draw.roundRect(ctx, -u * 0.22, -u * 0.34 - lift, u * 0.44, u * 0.19, u * 0.04);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-u * 0.16, -u * 0.28 - lift, u * 0.32, u * 0.05);
      ctx.globalAlpha = 1;
    },

    /* --- Планета 9 --- */
    /* Резонатор: кольца, вложенные друг в друга */
    resonator: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.30, u * 0.26, u * 0.07, u * 0.18);
      ctx.strokeStyle = t.color;
      for (var i = 0; i < 3; i++) {
        var ph = 0.5 + 0.5 * Math.sin(time * 2 - i * 0.7);
        ctx.globalAlpha = 0.25 + 0.4 * ph;
        ctx.lineWidth = Math.max(1, 1.5 * k);
        Draw.circle(ctx, 0, -u * 0.12, u * (0.09 + i * 0.075));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, -u * 0.12, u * 0.045); ctx.fill();
    },

    /* Пустотная стена: рамка, внутри которой ничего нет */
    voidwall: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.strokeStyle = t.color;
      Draw.roundRect(ctx, -u * 0.32, -u * 0.30, u * 0.64, u * 0.58, u * 0.06);
      ctx.fill(); ctx.stroke();
      // Провал внутри
      ctx.fillStyle = PAL.bgDeep;
      Draw.roundRect(ctx, -u * 0.18, -u * 0.17, u * 0.36, u * 0.32, u * 0.05);
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 1.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Разрядник: рогатка с дугой между электродами */
    disruptor: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var arc = 0.5 + 0.5 * Math.sin(time * 9);
      Units.body(ctx, t, opts, u * 0.34, u * 0.28, u * 0.08, u * 0.16);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.14, u * 0.06); ctx.lineTo(-u * 0.18, -u * 0.30);
      ctx.moveTo(u * 0.14, u * 0.06); ctx.lineTo(u * 0.18, -u * 0.30);
      ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, -u * 0.18, -u * 0.32, u * 0.045); ctx.fill();
      Draw.circle(ctx, u * 0.18, -u * 0.32, u * 0.045); ctx.fill();
      ctx.globalAlpha = 0.3 + 0.6 * arc;
      ctx.lineWidth = Math.max(1, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(-u * 0.16, -u * 0.32);
      ctx.lineTo(-u * 0.04, -u * 0.24);
      ctx.lineTo(u * 0.05, -u * 0.36);
      ctx.lineTo(u * 0.16, -u * 0.32);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },

    /* Стабилизатор: гироскоп в раме */
    stabilizer: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.28, u * 0.22, u * 0.06, u * 0.20);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.save();
      ctx.translate(0, -u * 0.14);
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.22, u * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.22, u * 0.08, time * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.08, u * 0.22, time * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = t.color;
      Draw.circle(ctx, 0, 0, u * 0.05); ctx.fill();
      ctx.restore();
    },

    /* Воронка: спираль, затягивающая внутрь */
    singular: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      Units.body(ctx, t, opts, u * 0.26, u * 0.20, u * 0.06, u * 0.22);
      ctx.save();
      ctx.translate(0, -u * 0.14);
      ctx.rotate(-time * 1.6);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = Math.max(1, 1.6 * k);
      ctx.beginPath();
      for (var i = 0; i <= 26; i++) {
        var a = i * 0.32;
        var r = u * 0.03 + i * u * 0.0085;
        var x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = PAL.bgDeep;
      Draw.circle(ctx, 0, -u * 0.14, u * 0.05); ctx.fill();
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 3);
      Draw.circle(ctx, 0, -u * 0.14, u * 0.03); ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Мина: диск с шипами и мигающим взрывателем */
    mine: function (ctx, u, k, t, opts, time) {
      ctx.lineWidth = Math.max(1, k);
      var blink = 0.5 + 0.5 * Math.sin(time * 5);

      // Шипы
      ctx.strokeStyle = t.color;
      ctx.globalAlpha = 0.65;
      ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * u * 0.13, Math.sin(a) * u * 0.13);
        ctx.lineTo(Math.cos(a) * u * 0.185, Math.sin(a) * u * 0.185);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Корпус
      ctx.fillStyle = opts.hurt ? '#2A323C' : t.fill;
      ctx.lineWidth = Math.max(1, k);
      Draw.circle(ctx, 0, 0, u * 0.135);
      ctx.fill(); ctx.stroke();

      // Взрыватель
      ctx.fillStyle = t.color;
      ctx.globalAlpha = 0.3 + 0.7 * blink;
      Draw.circle(ctx, 0, 0, u * 0.05);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
};
