import { SHOGIMAN_IOS_HTML } from './generated/shogimanIosHtml';

export function getShogimanHtml() {
  // Keep the bundled SHOGIMAN-IOS HTML untouched. Native-only behavior such as
  // AI transport is layered on by SHOGIMAN-EXPO through WebView injection.
  return SHOGIMAN_IOS_HTML;
}
