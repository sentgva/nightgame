/* grid.js — палитра и логика сетки игрового поля.
   Поле 5x7, клетка строго квадратная, размер считается динамически. */

/* Палитра продублирована из css/style.css — канвасу нужны литералы. */
/* Палитра в духе PvZ: дневной газон, насыщенные тела, тёмная обводка.
   Главное отличие от прежней схемы — заливка теперь светлая и яркая,
   а контур тёмный. Раньше было наоборот. */
var PAL = {
  bgDeep:     '#3E6B1F',   // трава за пределами поля
  bgPanel:    '#6D4C2F',   // деревянные панели интерфейса
  bgPanelUp:  '#8D6748',   // светлая кромка дерева
  bgField:    '#8BC34A',   // газон, светлая полоса
  bgField2:   '#7CB342',   // газон, тёмная полоса
  soil:       '#5D4037',   // земля по краям
  gridLine:   '#6B9B33',   // межи между клетками
  textMain:   '#FFFFFF',
  textDark:   '#3E2723',
  textMuted:  '#EFE4C8',
  outline:    '#2F2013',   // общий тёмный контур, как в мультфильме

  spark:      '#FFD54F',   // солнце
  sparkEdge:  '#E09B00',
  ally:       '#4CAF50',
  enemy:      '#C62828',
  ice:        '#4FC3F7',
  danger:     '#D32F2F',
  heal:       '#BA68C8',
  phase:      '#B3E5FC',
  ash:        '#FF7043',
  aura:       '#FFB300',
  shield:     '#4FC3F7',

  zombieSkin: '#AFBFA8',   // кожа
  zombieSkinD:'#8A9C84',
  zombieCloth:'#5C6BC0',   // рубаха
  zombieClothD:'#3949AB',
  armorPlate: '#90A4AE',
  armorPlateD:'#546E7A',

  fillAlly:   '#8BC34A',
  fillEnemy:  '#AFBFA8',
  fillArmor:  '#90A4AE',
  fillSpark:  '#FFE082',
  fillIce:    '#B3E5FC',
  fillNeutral:'#A1887F',

  /* Тела растений: заливка яркая, обводка — её тёмный вариант */
  uShooter:   '#33691E',  uShooterF:  '#7CB342',
  uShotgun:   '#BF360C',  uShotgunF:  '#FF8A65',
  uRepeater:  '#2E7D32',  uRepeaterF: '#66BB6A',
  uFan:       '#33691E',  uFanF:      '#9CCC65',
  uTorch:     '#BF360C',  uTorchF:    '#FF7043',
  uMagnet:    '#6A1B9A',  uMagnetF:   '#CE93D8',
  uBarrier:   '#7B4B2A',  uBarrierF:  '#C69C6D',
  uMine:      '#6D4C2F',  uMineF:     '#C8A165',
  uMortar:    '#4E342E',  uMortarF:   '#A1887F',
  uLaser:     '#0288D1',  uLaserF:    '#E1F5FE',
  uRepair:    '#AD1457',  uRepairF:   '#F48FB1',
  uSpikes:    '#3E2723',  uSpikesF:   '#8D6E63',
  uChomper:   '#4A148C',  uChomperF:  '#9575CD',
  uTesla:     '#01579B',  uTeslaF:    '#4FC3F7',
  uHarpoon:   '#004D40',  uHarpoonF:  '#4DB6AC',
  uUmbrella:  '#558B2F',  uUmbrellaF: '#AED581',
  uPendulum:  '#4A148C',  uPendulumF: '#BA68C8',
  uNet:       '#827717',  uNetF:      '#DCE775'
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
