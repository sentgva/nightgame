/* grid.js — палитра и логика сетки игрового поля.
   Поле 5x7, клетка строго квадратная, размер считается динамически. */

/* Палитра продублирована из css/style.css — канвасу нужны литералы. */
var PAL = {
  bgDeep:     '#0A0E14',
  bgPanel:    '#0E131B',
  bgField:    '#121820',
  gridLine:   '#1E2836',
  outline:    '#05070B',   // общий тёмный контур: отделяет фигуру от фона
  textMain:   '#E8EDF2',
  textMuted:  '#6B7A8F',
  spark:      '#FFB347',
  ally:       '#4ADE80',
  enemy:      '#F43F5E',
  ice:        '#60A5FA',
  danger:     '#DC2626',
  heal:       '#A78BFA',   // лечение и всё, что чинит врагов
  phase:      '#93C5FD',   // фантом в фазе
  ash:        '#F97316',   // раскалённые швы пепельника
  aura:       '#FBBF24',   // аура ревуна: враги вокруг ускоряются
  shield:     '#38BDF8',   // аура щитоносца: враги вокруг держат урон
  /* У каждого защитника свой цвет: в бою роль должна читаться по цвету
     обводки, а не по форме значка. Заливка — очень тёмная пара к нему. */
  uShooter:   '#4ADE80',  uShooterF:  '#16241C',
  uShotgun:   '#FACC15',  uShotgunF:  '#2A2410',
  uRepeater:  '#2DD4BF',  uRepeaterF: '#0E2A2A',
  uFan:       '#A3E635',  uFanF:      '#1E2A12',
  uTorch:     '#FB923C',  uTorchF:    '#2A1C10',
  uMagnet:    '#C084FC',  uMagnetF:   '#221A2E',
  uBarrier:   '#94A3B8',  uBarrierF:  '#1B2430',
  uMine:      '#DC2626',  uMineF:     '#2A1618',
  uMortar:    '#FB7185',  uMortarF:   '#2A1620',
  uLaser:     '#F1F5F9',  uLaserF:    '#202833',
  uRepair:    '#E879F9',  uRepairF:   '#281630',
  uSpikes:    '#A8A29E',  uSpikesF:   '#232122',
  uChomper:   '#15803D',  uChomperF:  '#10241A',
  uTesla:     '#38BDF8',  uTeslaF:    '#0E2430',
  uHarpoon:   '#06B6D4',  uHarpoonF:  '#0B2630',
  uUmbrella:  '#CBD5E1',  uUmbrellaF: '#1E2632',
  uPendulum:  '#9333EA',  uPendulumF: '#1E1230',
  uNet:       '#65A30D',  uNetF:      '#1A2410',

  /* Планета 2 — пепел и охра */
  uAshwell:   '#FDBA74',  uAshwellF:  '#2A1A10',
  uObelisk:   '#A16207',  uObeliskF:  '#241A08',
  /* Планета 3 — лёд */
  uCondenser: '#0EA5E9',  uCondenserF:'#0C2434',
  uIcewall:   '#BAE6FD',  uIcewallF:  '#122834',
  /* Планета 4 — джунгли */
  uVinepod:   '#22C55E',  uVinepodF:  '#0E2618',
  uStump:     '#84CC16',  uStumpF:    '#1C2410',
  /* Планета 5 — рудник */
  uMiner:     '#D97706',  uMinerF:    '#281C08',
  uProp:      '#B45309',  uPropF:     '#241808',
  /* Планета 6 — улей */
  uSporepod:  '#BEF264',  uSporepodF: '#1E2810',
  uTarwall:   '#4D7C0F',  uTarwallF:  '#161E0C',
  /* Планета 7 — разлом */
  uGlowfly:   '#F0ABFC',  uGlowflyF:  '#2A1430',
  uMonolith:  '#A78BFA',  uMonolithF: '#1C1630',
  uLantern:   '#FDE047',  uLanternF:  '#2A2410',
  uCutter:    '#F472B6',  uCutterF:   '#2A1220',
  uAnchor:    '#818CF8',  uAnchorF:   '#161A30',
  /* Планета 8 — печь */
  uHeatsink:  '#F87171',  uHeatsinkF: '#2A1414',
  uShieldwall:'#B91C1C',  uShieldwallF:'#240E0E',
  uSmelter:   '#FDA4AF',  uSmelterF:  '#2A1218',
  uRodtower:  '#FCD34D',  uRodtowerF: '#2A2208',
  uHammer:    '#EF4444',  uHammerF:   '#261010',
  /* Планета 9 — бездна */
  uResonator: '#A5B4FC',  uResonatorF:'#181C34',
  uVoidwall:  '#6366F1',  uVoidwallF: '#141634',
  uDisruptor: '#C4B5FD',  uDisruptorF:'#1E1834',
  uStabilizer:'#67E8F9',  uStabilizerF:'#0E2630',
  uSingular:  '#7C3AED',  uSingularF: '#1A0E30',

  /* Базовые стрелки планет 2 и 4-7 */
  uSlinger:   '#EA580C',  uSlingerF:  '#2A1608',
  uBarb:      '#4ADE80',  uBarbF:     '#12261A',
  uJack:      '#EAB308',  uJackF:     '#262008',
  uSting:     '#CDDC39',  uStingF:    '#22280C',
  uRay:       '#E879F9',  uRayF:      '#2A1032',

  fillAlly:   '#16241C',
  fillEnemy:  '#181F2B',
  fillArmor:  '#1C242F',
  fillSpark:  '#2A2013',
  fillIce:    '#152232',
  fillNeutral:'#1B2430'
};

var Grid = {
  cols: 5,
  rows: 7,
  cell: 64,       // сторона клетки в CSS-пикселях
  w: 320,         // ширина поля
  h: 448,         // высота поля
  cells: [],      // занятость: юнит или null, длина cols*rows
  blocked: [],    // выжженные клетки и обвалы: строить нельзя
  vines: [],      // заросшие клетки: чистятся тапом (механика Джунглей)

  /* Пересчёт размеров под доступную область.
     cellSize = min(доступная ширина / 5, доступная высота / 7) */
  layout: function (availW, availH) {
    var c = Math.floor(Math.min(availW / this.cols, availH / this.rows));
    this.cell = Math.max(44, c);          // область тапа не меньше 44px
    this.w = this.cell * this.cols;
    this.h = this.cell * this.rows;
  },

  clear: function () {
    this.cells = new Array(this.cols * this.rows);
    this.blocked = new Array(this.cols * this.rows);
    this.vines = new Array(this.cols * this.rows);
    for (var i = 0; i < this.cells.length; i++) {
      this.cells[i] = null;
      this.blocked[i] = false;
      this.vines[i] = false;
    }
  },

  isBlocked: function (col, row) {
    return this.inside(col, row) && !!this.blocked[this.idx(col, row)];
  },

  idx: function (col, row) { return row * this.cols + col; },

  inside: function (col, row) {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  },

  get: function (col, row) {
    if (!this.inside(col, row)) return null;
    return this.cells[this.idx(col, row)];
  },

  set: function (col, row, unit) {
    if (!this.inside(col, row)) return;
    this.cells[this.idx(col, row)] = unit;
  },

  isFree: function (col, row) {
    return this.inside(col, row) &&
      !this.cells[this.idx(col, row)] &&
      !this.blocked[this.idx(col, row)] &&
      !this.vines[this.idx(col, row)];
  },

  isVine: function (col, row) {
    return this.inside(col, row) && !!this.vines[this.idx(col, row)];
  },

  centerX: function (col) { return (col + 0.5) * this.cell; },
  centerY: function (row) { return (row + 0.5) * this.cell; },

  /* Координаты поля -> клетка. Возвращает null за пределами. */
  cellAt: function (x, y) {
    var col = Math.floor(x / this.cell);
    var row = Math.floor(y / this.cell);
    if (!this.inside(col, row)) return null;
    return { col: col, row: row };
  },

  /* Перебор всех установленных юнитов */
  each: function (fn) {
    for (var r = 0; r < this.rows; r++) {
      for (var c = 0; c < this.cols; c++) {
        var u = this.cells[this.idx(c, r)];
        if (u) fn(u, c, r);
      }
    }
  },

  /* Список юнитов в колонке, сверху вниз */
  column: function (col) {
    var out = [];
    for (var r = 0; r < this.rows; r++) {
      var u = this.cells[this.idx(col, r)];
      if (u) out.push(u);
    }
    return out;
  }
};
