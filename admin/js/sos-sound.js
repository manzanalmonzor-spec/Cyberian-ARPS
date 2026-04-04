// SOS Alert Sound System
// Generates an emergency alarm using Web Audio API (no audio file needed)
// Toggle saved in localStorage: arps_sos_sound_enabled

(function() {
  var STORAGE_KEY = 'arps_sos_sound_enabled';
  var audioCtx = null;
  var isPlaying = false;
  var stopTimer = null;

  window.isSosSoundEnabled = function() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  };

  window.setSosSoundEnabled = function(enabled) {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  };

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Play emergency siren sound (alternating tones)
  window.playSosAlarm = function(duration) {
    if (!isSosSoundEnabled() || isPlaying) return;
    isPlaying = true;
    duration = duration || 5000;

    try {
      var ctx = getAudioContext();
      var gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);

      var toneCount = Math.floor(duration / 500);
      for (var i = 0; i < toneCount; i++) {
        var osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, ctx.currentTime + (i * 0.5));
        osc.connect(gain);
        osc.start(ctx.currentTime + (i * 0.5));
        osc.stop(ctx.currentTime + (i * 0.5) + 0.45);
      }

      // Fade out at end
      gain.gain.setValueAtTime(0.3, ctx.currentTime + duration / 1000 - 0.3);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);

      clearTimeout(stopTimer);
      stopTimer = setTimeout(function() {
        isPlaying = false;
      }, duration + 200);
    } catch (e) {
      console.error('SOS sound error:', e);
      isPlaying = false;
    }
  };

  window.stopSosAlarm = function() {
    isPlaying = false;
    clearTimeout(stopTimer);
    if (audioCtx) {
      try { audioCtx.close(); } catch(e) {}
      audioCtx = null;
    }
  };
})();
