const ADVICE_BRIDGE_SCRIPT = String.raw`
(function () {
  if (window.__shogimanExpoAdviceBridgeInstalled) return true;
  window.__shogimanExpoAdviceBridgeInstalled = true;

  var nativePostMessage = window.ReactNativeWebView && window.ReactNativeWebView.postMessage
    ? window.ReactNativeWebView.postMessage.bind(window.ReactNativeWebView)
    : null;
  if (!nativePostMessage) return true;

  var originalFetch = window.fetch.bind(window);
  var pending = {};
  var nextId = 1;

  window.__shogimanResolveAdvice = function (message) {
    if (!message || !message.id) return;
    var entry = pending[message.id];
    if (!entry) return;
    delete pending[message.id];

    if (entry.cleanup) entry.cleanup();

    if (message.error) {
      entry.reject(new Error(message.error));
      return;
    }

    var body = typeof message.body === 'string' ? message.body : '';
    var response = {
      ok: !!message.ok,
      status: Number(message.status || 0),
      json: function () {
        try {
          return Promise.resolve(JSON.parse(body));
        } catch (error) {
          return Promise.reject(error);
        }
      },
      text: function () {
        return Promise.resolve(body);
      }
    };
    entry.resolve(response);
  };

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    var isAdviceRequest = url === '/api/advice' || url === 'https://shogiman.local/api/advice';
    if (!isAdviceRequest) return originalFetch(input, init);

    return new Promise(function (resolve, reject) {
      var id = 'advice-' + String(nextId++);
      var cleanup = null;
      var signal = init && init.signal;

      if (signal) {
        if (signal.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        var onAbort = function () {
          if (!pending[id]) return;
          delete pending[id];
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        cleanup = function () { signal.removeEventListener('abort', onAbort); };
      }

      pending[id] = { resolve: resolve, reject: reject, cleanup: cleanup };
      nativePostMessage(JSON.stringify({
        type: 'shogiman-advice-request',
        id: id,
        method: init && init.method ? init.method : 'POST',
        body: init && typeof init.body === 'string' ? init.body : null
      }));
    });
  };

  return true;
})();
true;
`;

export function getInjectedAdviceBridgeScript() {
  return ADVICE_BRIDGE_SCRIPT;
}
