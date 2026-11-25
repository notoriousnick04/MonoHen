/* Runner page: wires the log panel to the vendored Wobkot chain. */
(function () {
  'use strict';

  var els = {
    state: document.getElementById('state'),
    console: document.getElementById('console'),
    logPanel: document.getElementById('DebugConsole'),
    retry: document.getElementById('retry-btn')
  };

  function scrollLog() {
    els.logPanel.scrollTop = els.logPanel.scrollHeight;
  }

  function log(message, kind) {
    if (els.console.textContent === '--') els.console.textContent = '';
    var span = document.createElement('span');
    span.textContent = message + '\n';
    if (kind) span.className = kind;
    els.console.appendChild(span);
    scrollLog();
  }

  function setState(text, kind) {
    els.state.textContent = text;
    els.state.className = 'run-state' + (kind ? ' ' + kind : '');
  }

  // GoldHEN is a raw .bin, so the ELF-only helpers in impl.js are never used.
  window.isPayloadElf = function () { return false; };

  window.jailbreakSuccess = function () {
    setState('Jailbreak complete — GoldHEN should be loaded.', 'ok');
    log('Jailbreak complete.', 'ok');
  };

  window.onerror = function (message, source, line) {
    log('Error: ' + message + ' (' + source + ':' + line + ')', 'bad');
    setState('Exploit failed — press Retry.', 'bad');
    return true;
  };

  els.retry.addEventListener('click', function () {
    window.location.reload();
  }, false);

  var payloadPath;
  try {
    payloadPath = sessionStorage.getItem('payload_path');
  } catch (e) {
    payloadPath = null;
  }

  if (!payloadPath) {
    setState('No payload selected. Returning to the main page.', 'bad');
    log('No payload selected.', 'bad');
    setTimeout(function () { window.location.href = './'; }, 1500);
    return;
  }

  setState('Running…');
  log('Payload: ' + payloadPath, 'grey');
  log('Loading ufm42\'s wobkot exploit chain implementation…');

  var script = document.createElement('script');
  script.src = './src/wobkot/main.js';
  script.onerror = function () {
    setState('Could not load exploit files.', 'bad');
    log('Failed to load src/wobkot/main.js', 'bad');
  };
  document.body.appendChild(script);
})();
