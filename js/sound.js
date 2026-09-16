/* sound.js — синтезированные звуки через Web Audio API.
   Никаких внешних файлов: всё генерируется осцилляторами и шумом. */

var Sound = (function () {
  var ctx = null;
  var master = null;
  var enabled = true;
  var noiseBuffer = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;   // общая громкость держится тихой
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function resume() {
    var c = ensure();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
  }

  function noise() {
    if (noiseBuffer) return noiseBuffer;
    var len = Math.floor(ctx.sampleRate * 0.3);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // Короткий тон с экспоненциальным затуханием
  function tone(freq, freqEnd, dur, type, vol) {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    var t = c.currentTime;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd && freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // Шумовой всплеск — для взрывов и смертей
  function burst(dur, cutoff, vol) {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    var t = c.currentTime;
    var src = c.createBufferSource();
    src.buffer = noise();
    var filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(cutoff || 900, t);
    filt.frequency.exponentialRampToValueAtTime(180, t + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur);
  }

  var lib = {
    shot:    function () { tone(660, 320, 0.07, 'square', 0.10); },
    shotBig: function () { burst(0.12, 1400, 0.16); },
    freeze:  function () { tone(880, 1320, 0.12, 'sine', 0.09); },
    hit:     function () { tone(220, 140, 0.05, 'triangle', 0.10); },
    death:   function () { burst(0.18, 700, 0.20); },
    place:   function () { tone(330, 520, 0.09, 'sine', 0.16); },
    pick:    function () { tone(880, 1320, 0.09, 'sine', 0.14); },
    deny:    function () { tone(180, 120, 0.09, 'sawtooth', 0.10); },
    mine:    function () { burst(0.32, 1800, 0.30); },
    life:    function () { tone(200, 90, 0.36, 'sawtooth', 0.22); },
    wave:    function () { tone(150, 220, 0.30, 'sine', 0.16); },
    win:     function () { tone(523, 523, 0.14, 'sine', 0.20);
                           setTimeout(function () { tone(659, 659, 0.14, 'sine', 0.20); }, 130);
                           setTimeout(function () { tone(784, 784, 0.26, 'sine', 0.20); }, 260); },
    lose:    function () { tone(330, 110, 0.60, 'sine', 0.22); }
  };

  function play(name) {
    if (!enabled) return;
    var f = lib[name];
    if (f) { try { f(); } catch (e) { /* аудио недоступно — молча */ } }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (enabled) resume();
  }

  return { play: play, setEnabled: setEnabled, resume: resume, get enabled() { return enabled; } };
})();
