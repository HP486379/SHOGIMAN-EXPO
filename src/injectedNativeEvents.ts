const NATIVE_EVENTS_SCRIPT = String.raw`
(function () {
  if (window.__shogimanExpoNativeEventsInstalled) return true;
  window.__shogimanExpoNativeEventsInstalled = true;

  function postNativeEvent(eventName) {
    try {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'shogiman-native-event',
          event: eventName
        }));
      }
    } catch (_) {}
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var cell = target.closest('.board-cell');
    if (!cell || !cell.classList.contains('legal-target')) return;

    var selectedHand = document.querySelector('.hand-chip.selected');
    if (selectedHand) return;

    var capturedPiece = cell.querySelector('.piece-face');
    if (capturedPiece) postNativeEvent('capture');
  }, true);

  return true;
})();
true;
`;

export function getInjectedNativeEventsScript() {
  return NATIVE_EVENTS_SCRIPT;
}
