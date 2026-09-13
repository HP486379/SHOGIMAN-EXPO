const AUDIO_SCRIPT = String.raw`
(function () {
  if (window.__shogimanExpoAudioInstalled) return true;
  window.__shogimanExpoAudioInstalled = true;

  var NOTE_FREQ = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0
  };

  var LEAD = [
    [0,'E4',1],[1,'G4',1],[2,'A4',2],[4,'G4',1],[5,'E4',1],[6,'D4',2],
    [8,'E4',1],[9,'G4',1],[10,'B4',2],[12,'A4',1],[13,'G4',1],[14,'E4',2],
    [16,'A4',1],[17,'B4',1],[18,'C5',2],[20,'B4',1],[21,'A4',1],[22,'G4',2],
    [24,'E4',1],[25,'G4',1],[26,'A4',2],[28,'G4',1],[29,'E4',1],[30,'D4',2]
  ];

  var BASS = [
    [0,'A3',1],[2,'A3',1],[4,'E3',1],[6,'E3',1],[8,'F3',1],[10,'F3',1],
    [12,'G3',1],[14,'G3',1],[16,'A3',1],[18,'A3',1],[20,'E3',1],[22,'E3',1],
    [24,'F3',1],[26,'G3',1],[28,'A3',1],[30,'E3',1]
  ];

  var ctx = null;
  var master = null;
  var bgmGain = null;
  var sfxGain = null;
  var timers = [];
  var isPlaying = false;
  var enabled = true;
  var stepSeconds = 0.145;
  var loopSteps = 32;

  function ensureContext() {
    if (!ctx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      master = ctx.createGain();
      bgmGain = ctx.createGain();
      sfxGain = ctx.createGain();
      master.gain.value = 0.88;
      bgmGain.gain.value = 0.16;
      sfxGain.gain.value = 0.42;
      bgmGain.connect(master);
      sfxGain.connect(master);
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function playToneTo(destination, note, time, duration, volume, type) {
    if (!ctx || !destination) return;
    var freq = NOTE_FREQ[note];
    if (!freq) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  function playNoiseTo(destination, time, duration, volume, cutoff, filterType) {
    if (!ctx || !destination) return;
    var bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;
    var source = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    filter.type = filterType;
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(filterType === 'bandpass' ? 1.2 : 0.7, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(time);
  }

  function playClick(time) {
    if (!sfxGain) return;
    playNoiseTo(sfxGain, time, 0.018, 0.13, 5200, 'highpass');
    playToneTo(sfxGain, 'C5', time, 0.025, 0.08, 'square');
  }

  function playBoomTone(time) {
    if (!ctx || !sfxGain) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(96, time);
    osc.frequency.exponentialRampToValueAtTime(28, time + 0.32);
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.34);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(time);
    osc.stop(time + 0.38);
  }

  function playExplosion(time) {
    if (!sfxGain) return;
    playNoiseTo(sfxGain, time, 0.28, 0.34, 220, 'lowpass');
    playNoiseTo(sfxGain, time + 0.035, 0.18, 0.2, 900, 'bandpass');
    playBoomTone(time);
  }

  function playKick(time) {
    if (!ctx || !bgmGain) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(92, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.08);
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    osc.connect(gain);
    gain.connect(bgmGain);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  function playSnare(time) {
    if (bgmGain) playNoiseTo(bgmGain, time, 0.07, 0.07, 1200, 'highpass');
  }

  function playHiHat(time) {
    if (bgmGain) playNoiseTo(bgmGain, time, 0.018, 0.025, 4200, 'highpass');
  }

  function findEvent(events, step) {
    for (var i = 0; i < events.length; i += 1) {
      if (events[i][0] === step) return events[i];
    }
    return null;
  }

  function scheduleStep(loopStart, step) {
    if (!ctx || !bgmGain) return;
    var lead = findEvent(LEAD, step);
    var bass = findEvent(BASS, step);
    var time = loopStart + step * stepSeconds;
    if (lead) playToneTo(bgmGain, lead[1], time, lead[2] * stepSeconds * 0.86, 0.09, 'square');
    if (bass) playToneTo(bgmGain, bass[1], time, bass[2] * stepSeconds * 0.78, 0.07, 'triangle');
    if (step % 4 === 0) playKick(time);
    if (step % 8 === 4) playSnare(time);
    if (step % 2 === 1) playHiHat(time);
  }

  function scheduleLoop() {
    if (!isPlaying || !enabled) return;
    var audio = ensureContext();
    if (!audio) return;
    var startTime = audio.currentTime + 0.05;
    for (var step = 0; step < loopSteps; step += 1) scheduleStep(startTime, step);
    var timer = window.setTimeout(scheduleLoop, loopSteps * stepSeconds * 1000);
    timers.push(timer);
  }

  function clearTimers() {
    for (var i = 0; i < timers.length; i += 1) window.clearTimeout(timers[i]);
    timers = [];
  }

  function stop() {
    isPlaying = false;
    clearTimers();
  }

  function start() {
    if (!enabled) return;
    var audio = ensureContext();
    if (!audio || isPlaying) return;
    var begin = function () {
      if (!enabled || isPlaying) return;
      isPlaying = true;
      scheduleLoop();
    };
    if (audio.state === 'suspended') {
      var resumed = audio.resume();
      if (resumed && typeof resumed.then === 'function') resumed.then(begin).catch(function () {});
    } else {
      begin();
    }
  }

  function playSfx(kind) {
    if (!enabled) return;
    var audio = ensureContext();
    if (!audio || !sfxGain) return;
    if (audio.state === 'suspended') audio.resume().catch(function () {});
    var now = audio.currentTime;
    if (kind === 'select') {
      playToneTo(sfxGain, 'C5', now, 0.035, 0.13, 'square');
      playToneTo(sfxGain, 'G5', now + 0.035, 0.045, 0.10, 'square');
    } else if (kind === 'move') {
      playClick(now);
      playToneTo(sfxGain, 'A4', now + 0.015, 0.045, 0.12, 'square');
    } else if (kind === 'drop') {
      playClick(now);
      playToneTo(sfxGain, 'E4', now + 0.025, 0.06, 0.13, 'square');
      playNoiseTo(sfxGain, now, 0.035, 0.08, 3000, 'highpass');
    } else if (kind === 'capture') {
      playExplosion(now);
    } else if (kind === 'promote') {
      playToneTo(sfxGain, 'E4', now, 0.055, 0.13, 'square');
      playToneTo(sfxGain, 'A4', now + 0.055, 0.055, 0.13, 'square');
      playToneTo(sfxGain, 'C5', now + 0.11, 0.11, 0.12, 'square');
    } else if (kind === 'checkmate') {
      playExplosion(now);
      playToneTo(sfxGain, 'C4', now + 0.18, 0.18, 0.16, 'square');
      playToneTo(sfxGain, 'G3', now + 0.36, 0.24, 0.15, 'triangle');
      playToneTo(sfxGain, 'C3', now + 0.6, 0.36, 0.14, 'triangle');
    }
  }

  function syncSoundButton(button) {
    window.setTimeout(function () {
      var text = (button.textContent || '').toUpperCase();
      enabled = text.indexOf('OFF') === -1;
      if (enabled) start(); else stop();
    }, 0);
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var button = target.closest('button');
    if (button) {
      var text = (button.textContent || '').trim();
      var upper = text.toUpperCase();

      if (upper.indexOf('SE:') === 0) {
        syncSoundButton(button);
        return;
      }

      if (text === '成る' || upper === 'PROMOTE') {
        playSfx('promote');
        return;
      }

      if (upper.indexOf('RESET BATTLE') !== -1) {
        playSfx('select');
        return;
      }
    }

    var cell = target.closest('.board-cell');
    if (!cell) return;

    if (cell.classList.contains('legal-target')) {
      var isCapture = !!cell.querySelector('.piece-face');
      var selectedHand = document.querySelector('.hand-chip.selected');
      playSfx(isCapture ? 'capture' : selectedHand ? 'drop' : 'move');
    } else if (cell.querySelector('.piece-face')) {
      playSfx('select');
    }
  }, true);

  var gameOverWasVisible = false;
  var observer = new MutationObserver(function () {
    var gameOver = !!document.querySelector('.game-over-overlay, .game-over-panel');
    if (gameOver && !gameOverWasVisible) {
      playSfx('checkmate');
      stop();
    }
    gameOverWasVisible = gameOver;
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  var unlock = function () {
    start();
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('click', unlock, true);
  };
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('click', unlock, true);
  window.setTimeout(start, 250);

  window.__shogimanExpoAudio = { start: start, stop: stop, playSfx: playSfx };
  return true;
})();
true;
`;

export function getInjectedAudioScript() {
  return AUDIO_SCRIPT;
}
