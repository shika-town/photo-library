/* 文書ページ用：モバイルメニューのみ */
(function () {
  'use strict';

  /* メールアドレスのコピー（メールソフトが設定されていない環境向け） */
  function initCopy() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.copybtn');
      if (!b) return;
      var text = b.dataset.copy || '';
      var done = function () {
        var before = b.textContent;
        b.textContent = 'コピーしました'; b.classList.add('is-done');
        setTimeout(function () { b.textContent = before; b.classList.remove('is-done'); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { window.prompt('コピーしてください', text); });
      } else {
        window.prompt('コピーしてください', text);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCopy();
    var dr = document.querySelector('#drawer'), btn = document.querySelector('#btnBurger');
    if (!dr || !btn) return;
    var close = function () { dr.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', function () { dr.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); });
    document.querySelector('#drawerClose').addEventListener('click', close);
    dr.addEventListener('click', function (e) { if (e.target === dr) close(); });
    Array.prototype.forEach.call(dr.querySelectorAll('.drawer__link'), function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  });
})();
