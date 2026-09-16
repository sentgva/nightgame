/* grid.js — палитра и логика сетки игрового поля.
   Поле 5x7, клетка строго квадратная, размер считается динамически. */

/* Палитра продублирована из css/style.css — канвасу нужны литералы. */
var PAL = {
  bgDeep:     '#0A0E14',
  bgPanel:    '#0E131B',
  bgField:    '#121820',
  gridLine:   '#1E2836',
  textMain:   '#E8EDF2',
  textMuted:  '#6B7A8F',
  spark:      '#FFB347',
  ally:       '#4ADE80',
  enemy:      '#F43F5E',
  ice:        '#60A5FA',
  danger:     '#DC2626',
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
    for (var i = 0; i < this.cells.length; i++) this.cells[i] = null;
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
    return this.inside(col, row) && !this.cells[this.idx(col, row)];
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
