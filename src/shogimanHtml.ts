import { SHOGIMAN_IOS_HTML } from './generated/shogimanIosHtml';

export function getShogimanHtml() {
  const apiUrl = process.env.EXPO_PUBLIC_ADVICE_API_URL ?? '';
  if (!apiUrl) return SHOGIMAN_IOS_HTML;

  const bridge = `<script>(function(){const endpoint=${JSON.stringify(apiUrl)};const original=window.fetch.bind(window);window.fetch=function(input,init){if(input==='/api/advice'||(input&&input.url==='/api/advice')){return original(endpoint,init);}return original(input,init);};})();</script>`;
  return SHOGIMAN_IOS_HTML.replace('</head>', bridge + '</head>');
}
