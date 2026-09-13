const NATIVE_EVENTS_SCRIPT = String.raw`
(function () {
  if (window.__shogimanExpoNativeEventsInstalled) return true;
  window.__shogimanExpoNativeEventsInstalled = true;

  var suppressObservedMoveUntil = 0;
  var lastMoveSignature = '';
  var victorySeen = false;
  var boardSnapshot = [];

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

  function readBoardSnapshot() {
    return Array.prototype.map.call(document.querySelectorAll('.board-cell'), function (cell) {
      return Boolean(cell.querySelector('.piece-face'));
    });
  }

  function classifyObservedMove(nextSnapshot) {
    if (!boardSnapshot.length || boardSnapshot.length !== nextSnapshot.length) return 'move';
    var filled = 0;
    var emptied = 0;
    for (var i = 0; i < nextSnapshot.length; i += 1) {
      if (!boardSnapshot[i] && nextSnapshot[i]) filled += 1;
      if (boardSnapshot[i] && !nextSnapshot[i]) emptied += 1;
    }
    if (filled === 1 && emptied === 0) return 'drop';
    return 'move';
  }

  function observeGameState() {
    var cells = Array.prototype.slice.call(document.querySelectorAll('.board-cell'));
    var lastMove = document.querySelector('.board-cell.last-move');
    var signature = lastMove ? String(cells.indexOf(lastMove)) : '';
    var nextSnapshot = readBoardSnapshot();

    if (signature && signature !== lastMoveSignature) {
      if (Date.now() >= suppressObservedMoveUntil) {
        if (document.querySelector('.bomb-explosion')) {
          postNativeEvent('capture');
        } else {
          postNativeEvent(classifyObservedMove(nextSnapshot));
        }
      }
      lastMoveSignature = signature;
    }

    if (nextSnapshot.length) boardSnapshot = nextSnapshot;

    var victory = document.querySelector('.radio-alert.victory');
    if (victory && !victorySeen) {
      victorySeen = true;
      postNativeEvent('checkmate');
    } else if (!victory) {
      victorySeen = false;
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var soundButton = target.closest('.outline-action');
    if (soundButton) {
      var soundText = String(soundButton.textContent || '').toUpperCase();
      if (soundText.indexOf('SE: ON') >= 0) postNativeEvent('sound-off');
      if (soundText.indexOf('SE: OFF') >= 0) postNativeEvent('sound-on');
    }

    var promotionButton = target.closest('.promotion-dialog button');
    if (promotionButton) {
      var promotionText = String(promotionButton.textContent || '').trim().toUpperCase();
      suppressObservedMoveUntil = Date.now() + 300;
      if (promotionText === 'UPGRADE') postNativeEvent('promote');
      return;
    }

    var cell = target.closest('.board-cell');
    if (!cell || !cell.classList.contains('legal-target')) return;

    suppressObservedMoveUntil = Date.now() + 250;

    var selectedHand = document.querySelector('.hand-chip.selected');
    if (selectedHand) {
      postNativeEvent('drop');
      return;
    }

    var capturedPiece = cell.querySelector('.piece-face');
    if (capturedPiece) {
      postNativeEvent('capture');
      return;
    }

    postNativeEvent('move');
  }, true);

  boardSnapshot = readBoardSnapshot();
  observeGameState();

  var observer = new MutationObserver(function () {
    window.setTimeout(observeGameState, 0);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  return true;
})();
true;
`;

export function getInjectedNativeEventsScript() {
  return NATIVE_EVENTS_SCRIPT;
}
