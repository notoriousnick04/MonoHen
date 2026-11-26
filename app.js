/* Landing page: firmware detection, in-place exploit runner, autoscroll log, AppCache UI. */
(function () {
  'use strict';

  var TARGET_FW = '12.00';
  var PAYLOAD_NAME = window.LATEST_GOLDHEN || 'goldhen_v2.4b18.14.bin';
  var PAYLOAD_PATH = './payloads/' + PAYLOAD_NAME;

  var MAX_ATTEMPTS = 3;
  var RETRY_DELAY = 15;
  var WATCHDOG_MS = 90000;

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
  var attempt = 1;
  var running = false;
  var finished = false;
  var kernelStage = false;
  var watchdogTimer = null;
  var retryInterval = null;
  var cacheReady = false;

  function sessionGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function sessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  function sessionRemove(key) {
    try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function isPS4() {
    return navigator.userAgent.indexOf('PlayStation 4') !== -1;
  }

  function detectFirmware() {
    var userAgent = navigator.userAgent;
    var match = userAgent.match(/PlayStation 4\/([0-9.]+)/);
    if (match) return match[1];

    // Fallback for PS4 browsers that format the firmware differently.
    var start = userAgent.indexOf('5.0 (') + 19;
    var end = userAgent.indexOf(') Apple');
    if (start > 18 && end > start) {
      return userAgent.substring(start, end).replace('layStation 4/', '').trim();
    }
    return null;
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

  function clearRunTimers() {
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
    if (retryInterval) { clearInterval(retryInterval); retryInterval = null; }
  }

  function clearRetryState() {
    sessionRemove('jbAttempt');
    sessionRemove('jbRetryPending');
    sessionRemove('jbRetryReason');
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
      if (kind === 'bad') els.cacheLabel.style.color = '#ffffff';
    }

    cache.addEventListener('checking', function () {
      setCacheProgress(0, 'Checking offline cache…');
    }, false);

    cache.addEventListener('noupdate', function () {
      cacheReady = true;
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
      cacheReady = true;
      finished('Cached — this host now works offline.');
      log('Offline cache ready.', 'ok');
    }, false);

    cache.addEventListener('updateready', function () {
      try { cache.swapCache(); } catch (e) { /* ignore */ }
      cacheReady = true;
      finished('Cache updated.');
      log('Offline cache updated.', 'ok');
    }, false);

    cache.addEventListener('error', function () {
      // AppCache still tries to check the manifest while offline, so an error
      // here is normal once a usable cache exists. Only report a real failure
      // when nothing has been cached yet and the console is online.
      if (cacheReady || navigator.onLine === false) {
        els.cacheBtn.disabled = false;
        setCacheProgress(100, 'Offline — using cached copy.');
        return;
      }
      finished('Cache failed. Check your connection, that manifest.appcache is served as text/cache-manifest, and that every listed file exists.', 'bad');
    }, false);

    cache.addEventListener('obsolete', function () {
      cacheReady = false;
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
      ['[+] Loading ' + PAYLOAD_PATH, ''],
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

  function rebootNeeded(reason) {
    if (!running || finished) return;

    finished = true;
    running = false;
    clearRunTimers();
    clearRetryState();

    mode = 'reboot';
    els.start.disabled = true;
    els.startLabel.textContent = 'Reboot needed';
    setNotice('Kernel stage did not finish. Fully reboot the PS4, then press Start again.', 'bad');
    log('Attempt ' + attempt + ' stopped at kernel stage: ' + reason, 'bad');
    log('Fully reboot the PS4 before trying again.', 'bad');
  }

  function succeed() {
    if (!running || finished) return;

    finished = true;
    running = false;
    clearRunTimers();
    clearRetryState();

    mode = 'ps4';
    els.start.disabled = false;
    els.startLabel.textContent = 'Start again';
    setNotice('Jailbreak complete — GoldHEN loaded.');
    log('Jailbreak complete.', 'ok');
  }

  function failAttempt(reason) {
    if (!running || finished) return;

    finished = true;
    running = false;
    clearRunTimers();
    log('Attempt ' + attempt + ' failed: ' + reason, 'bad');

    if (kernelStage) {
      rebootNeeded(reason);
      return;
    }

    if (attempt >= MAX_ATTEMPTS) {
      clearRetryState();
      mode = 'ps4';
      els.start.disabled = false;
      els.startLabel.textContent = 'Retry';
      setNotice('Attempt ' + attempt + ' failed. Press Retry to try again.', 'bad');
      return;
    }

    var next = attempt + 1;
    sessionSet('jbAttempt', String(next));
    sessionSet('jbRetryPending', '1');
    sessionSet('jbRetryReason', reason);
    log('Reloading for a fresh retry…', 'warn');
    window.location.reload();
  }

  function stopRetry() {
    clearRunTimers();
    clearRetryState();

    mode = 'ps4';
    els.start.disabled = false;
    els.startLabel.textContent = 'Retry';
    setNotice('Auto retry stopped. Press Retry to try again.', 'warn');
    log('Auto retry stopped.', 'warn');
  }

  function watchChain() {
    // The vendored chain owns window.onerror / onunhandledrejection and logs
    // failures itself. We observe its progress so the early error hook above
    // never triggers a reload once kernel memory is unstable.
    try {
      if (typeof logger === 'undefined' || !logger || typeof logger.log !== 'function') return;
      var originalLog = logger.log;
      logger.log = function (prefix, msg) {
        if (String(msg).indexOf('===KERNEL===') !== -1) kernelStage = true;
        return originalLog.call(logger, prefix, msg);
      };
    } catch (e) {
      /* ignore */
    }

    // Translate only the PS4 notification text. The vendored files stay
    // unmodified; userland.js defines notify(), so wrap it right after it loads.
    try {
      if (typeof window.load_script !== 'function') return;
      var originalLoadScript = window.load_script;
      window.load_script = function (src) {
        return originalLoadScript(src).then(function () {
          if (String(src).indexOf('src/wobkot/userland.js') === -1) return;
          if (typeof window.notify !== 'function' || window.notify.__monohenWrapped) return;

          var originalNotify = window.notify;
          var wrapped = function (msg) {
            if (String(msg) === 'Jailbroken !!') msg = 'Success';
            return originalNotify(msg);
          };
          wrapped.__monohenWrapped = true;
          window.notify = wrapped;
        });
      };
    } catch (e) {
      /* ignore */
    }
  }

  function beginAttempt(number, automatic) {
    clearRunTimers();

    attempt = number;
    running = true;
    finished = false;
    kernelStage = false;

    sessionSet('payload_path', PAYLOAD_PATH);
    sessionSet('jbAttempt', String(attempt));
    sessionRemove('jbRetryPending');
    sessionRemove('jbRetryReason');

    els.start.disabled = true;
    els.startLabel.textContent = automatic ? 'Auto retry ' + attempt : 'Running…';
    setNotice(automatic
      ? 'Automatic retry ' + attempt + ' of ' + MAX_ATTEMPTS + '…'
      : 'Starting exploit chain…');
    log((automatic ? 'Auto-retry' : 'Starting') + ' attempt ' + attempt + ' of ' + MAX_ATTEMPTS + '…', 'ok');
    log('Payload: ' + PAYLOAD_PATH, 'grey');

    watchdogTimer = setTimeout(function () {
      if (kernelStage) {
        rebootNeeded('timed out after kernel stage');
      } else {
        failAttempt('timed out before kernel stage');
      }
    }, WATCHDOG_MS);

    var script = document.createElement('script');
    script.src = './src/wobkot/main.js';
    script.onerror = function () {
      failAttempt('could not load src/wobkot/main.js');
    };
    script.onload = watchChain;
    document.body.appendChild(script);
  }

  function startPendingRetry(savedAttempt) {
    mode = 'stopretry';
    var reason = sessionGet('jbRetryReason');
    var remaining = RETRY_DELAY;

    setBadge('PS4 · 12.00', 'ok');
    els.start.disabled = false;
    els.startLabel.textContent = 'Stop retry (' + remaining + 's)';
    setNotice('Retrying in ' + remaining + 's… (attempt ' + savedAttempt + ' of ' + MAX_ATTEMPTS + ')', 'warn');
    log('Previous attempt failed' + (reason ? ': ' + reason : '') + '.', 'bad');

    retryInterval = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(retryInterval);
        retryInterval = null;
        sessionRemove('jbRetryPending');
        sessionRemove('jbRetryReason');
        beginAttempt(savedAttempt, true);
        return;
      }
      els.startLabel.textContent = 'Stop retry (' + remaining + 's)';
      setNotice('Retrying in ' + remaining + 's… (attempt ' + savedAttempt + ' of ' + MAX_ATTEMPTS + ')', 'warn');
    }, 1000);
  }

  function start() {
    if (mode === 'demo') {
      runDemo();
      return;
    }
    if (mode === 'stopretry') {
      stopRetry();
      return;
    }
    if (mode === 'wrongfw' || mode === 'reboot') return;

    beginAttempt(1, false);
  }

  window.isPayloadElf = function () { return false; };
  window.jailbreakSuccess = function () { succeed(); };

  function earlyFailure(reason) {
    // Only retry errors that happen before the kernel stage. Once the kernel
    // exploit is running, a reload can turn a bad state into a panic/shutdown.
    if (!running || finished || kernelStage) return;
    failAttempt(reason);
  }

  window.addEventListener('error', function (event) {
    earlyFailure('Error: ' + (event && event.message ? event.message : 'unknown error'));
  }, false);

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    earlyFailure('Unhandled error: ' + (reason && reason.message ? reason.message : String(reason)));
  }, false);

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

    var pending = sessionGet('jbRetryPending') === '1';
    var savedAttempt = parseInt(sessionGet('jbAttempt'), 10);
    if (!savedAttempt || savedAttempt < 1 || savedAttempt > MAX_ATTEMPTS) savedAttempt = 1;

    if (ps4 && fw === TARGET_FW && pending) {
      setupCache();
      startPendingRetry(savedAttempt);
      return;
    }

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
