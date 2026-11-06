// Google Analytics（config.js の GTM_ID が設定されている場合のみ読み込む）
(function () {
  var id = typeof GTM_ID !== 'undefined' ? GTM_ID : '';
  if (!id || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
})();
