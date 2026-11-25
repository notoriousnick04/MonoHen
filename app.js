/* Landing page: firmware detection, start orchestration, autoscroll log, AppCache UI. */
(function () {
  'use strict';

  var TARGET_FW = '12.00';
  var PAYLOAD_PATH = './payloads/goldhen.bin';

  var els = {
    start: document.getElementById('start-btn'),
    startLabel: document.getElementById('start-label'),
    fw: document.getElementById('fw-value'),
    notice: document.getElementById('notice'),
    badge: document.getElementById('mode-badge'),
    console: document.getElementById('console'),
    logPanel: document.getElementById('DebugConsole'),
    clear: document.getElementById('clear-btn'),
    cacheBtn: document.getElementById('cache-btn'),
    cacheFill: document.getElementById('cache-fill'),
    cacheLabel: document.getElementById('cache-label')
  };

  var mode = 'demo';
  var demoTimers = [];

  function isPS4() {
    return navigator.userAgent.indexOf('PlayStation 4') !== -1;
  }

  function detectFirmware() {
    var match = navigator.userAgent.match(/PlayStation 4\/([0-9.]+)/);
    return match ? match[1] : null;
  }

  function scrollLog() {
    els.logPanel.scrollTop = els.logPanel.scrollHeight;
  }

  function log(message, kind) {
    if (els.console.textContent === 'Ready.' || els.console.textContent === '--') {
      els.console.textContent = '';
    }
    var span = document.createElement('span');
    span.textContent = message + '\n';
    if (kind) span.className = kind;
    els.console.appendChild(span);
    scrollLog();
  }

  function setNotice(text, kind) {
    els.notice.textContent = text;
    els.notice.className = 'notice' + (kind ? ' ' + kind : '');
  }

  function setBadge(text, kind) {
    els.badge.textContent = text;
    els.badge.className = 'badge' + (kind ? ' ' + kind : '');
  }

  function setCacheProgress(percent, text) {
    els.cacheFill.style.width = Math.max(0, Math.min(100, percent)) + '%';
    els.cacheLabel.textContent = text;
  }

  function setupCache() {
    var cache = window.applicationCache;

    if (!cache) {
      els.cacheBtn.disabled = true;
      setCacheProgress(0, 'Offline cache is not supported in this browser. The PS4 browser will cache automatically.');
      return;
    }

    function downloading() {
      els.cacheBtn.disabled = true;
      setCacheProgress(0, 'Downloading files for offline use…');
    }

    function finished(text, kind) {
      els.cacheBtn.disabled = false;
      setCacheProgress(100, text);
      if (kind === 'bad') els.cacheLabel.style.color = '#f87171';
    }

    cache.addEventListener('checking', function () {
      setCacheProgress(0, 'Checking offline cache…');
    }, false);

    cache.addEventListener('noupdate', function () {
      finished('Already cached — ready offline.');
    }, false);

    cache.addEventListener('downloading', downloading, false);

    cache.addEventListener('progress', function (event) {
      if (event.lengthComputable && event.total > 0) {
        var percent = Math.round((event.loaded / event.total) * 100);
        setCacheProgress(percent, 'Caching files… ' + percent + '%');
      } else {
        setCacheProgress(50, 'Caching files…');
      }
    }, false);

    cache.addEventListener('cached', function () {
      finished('Cached — this host now works offline.');
      log('Offline cache ready.', 'ok');
    }, false);

    cache.addEventListener('updateready', function () {
      try { cache.swapCache(); } catch (e) { /* ignore */ }
      finished('Cache updated.');
      log('Offline cache updated.', 'ok');
    }, false);

    cache.addEventListener('error', function () {
      finished('Cache unavailable. Check that manifest.appcache is served as text/cache-manifest.', 'bad');
    }, false);

    cache.addEventListener('obsolete', function () {
      finished('Cache was removed by the browser.', 'bad');
    }, false);

    els.cacheBtn.addEventListener('click', function () {
      setCacheProgress(0, 'Checking for updates…');
      try {
        cache.update();
      } catch (e) {
        setCacheProgress(0, 'Cache check already in progress.');
      }
    }, false);
  }

  function runDemo() {
    var lines = [
      ['Demo mode — no exploit is executed on a desktop browser.', 'grey'],
      ['Detected console: PS4 / 12.00 (simulated)', ''],
      ['Loading ufm42\'s wobkot exploit chain implementation…', ''],
      ['[+] Agent: Mozilla/5.0 (PlayStation 4 12.00)', ''],
      ['[+] ===USERLAND===', ''],
      ['[+] WebKit primitive established', 'ok'],
      ['[+] ===KERNEL===', ''],
      ['[+] Lapse kernel exploit: base found', 'ok'],
      ['[+] Achieved jailbreak !!', 'ok'],
      ['[+] Loading ./payloads/goldhen.bin', ''],
      ['[+] ===END===', 'ok']
    ];

    els.start.disabled = true;
    els.console.textContent = '';
    log('Starting…', 'grey');

    lines.forEach(function (item, index) {
      demoTimers.push(setTimeout(function () {
        log(item[0], item[1]);
        if (index === lines.length - 1) {
          els.start.disabled = false;
          log('Demo complete.', 'ok');
        }
      }, (index + 1) * 350));
    });
  }

  function start() {
    if (mode === 'demo') {
      runDemo();
      return;
    }

    try {
      sessionStorage.setItem('payload_path', PAYLOAD_PATH);
    } catch (e) {
      setNotice('Could not store payload path: ' + e.message, 'bad');
      return;
    }

    log('Starting exploit chain…', 'ok');
    window.location.href = './run.html';
  }

  function init() {
    var ps4 = isPS4();
    var fw = detectFirmware();

    els.fw.textContent = ps4 ? (fw || 'unknown') : 'not a PS4';
    els.clear.addEventListener('click', function () {
      for (var i = 0; i < demoTimers.length; i++) clearTimeout(demoTimers[i]);
      demoTimers = [];
      els.console.textContent = '';
      scrollLog();
    }, false);
    els.start.addEventListener('click', start, false);

    if (ps4 && fw === TARGET_FW) {
      mode = 'ps4';
      setBadge('PS4 · 12.00', 'ok');
      setNotice('Ready. Press Start to load GoldHEN.');
      els.start.disabled = false;
      log('PS4 12.00 detected. Ready.', 'ok');
    } else if (ps4) {
      mode = 'wrongfw';
      setBadge('PS4 · ' + (fw || 'unknown'), 'warn');
      setNotice('This host targets firmware 12.00 only. Detected ' + (fw || 'unknown') + '.', 'bad');
      els.startLabel.textContent = 'Unsupported firmware';
      log('Unsupported firmware: ' + (fw || 'unknown'), 'bad');
    } else {
      mode = 'demo';
      setBadge('DESKTOP DEMO', 'warn');
      setNotice('Desktop preview: Start streams a simulated log. Real exploitation runs on a PS4 with 12.00.');
      els.startLabel.textContent = 'Start demo';
      els.start.disabled = false;
      log('Desktop preview mode.', 'grey');
    }

    setupCache();
  }

  init();
})();
