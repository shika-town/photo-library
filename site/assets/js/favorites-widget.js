/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  favorites-widget.js
   「あとで見る」リスト（お気に入り）。サーバーには送らず、
   このブラウザの localStorage にIDだけを保存する。
   全ページの写真カードにハートボタンを重ねて表示するための共通スクリプト。
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'splFavorites';

  function getFavorites() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function setFavorites(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 保存できない環境は諦める */ }
    // ハートボタンのクリックは card への伝播を止めているため、変化を知りたいページは
    // クリックのバブリングではなく、このイベントを見てもらう（あとで見るリストページなど）。
    document.dispatchEvent(new CustomEvent('splfavoriteschange'));
  }
  function isFavorite(id) { return getFavorites().indexOf(id) !== -1; }
  function toggleFavorite(id) {
    var list = getFavorites();
    var i = list.indexOf(id);
    if (i === -1) { list.push(id); } else { list.splice(i, 1); }
    setFavorites(list);
    updateBadge();
    return i === -1; // true=追加した / false=外した
  }

  window.SPLFavorites = {
    getFavorites: getFavorites,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    remove: function (id) {
      var list = getFavorites().filter(function (x) { return x !== id; });
      setFavorites(list);
      updateBadge();
    }
  };

  function updateBadge() {
    var n = getFavorites().length;
    document.querySelectorAll('.header__fav-badge').forEach(function (b) {
      b.textContent = n > 99 ? '99+' : String(n);
      b.hidden = n === 0;
    });
    document.querySelectorAll('.header__fav').forEach(function (a) {
      a.classList.toggle('has-items', n > 0);
    });
  }

  // カードのリンク（photos/P0001.html や ../photos/P0001.html）から写真IDを取り出す
  function extractId(href) {
    var m = String(href || '').match(/([A-Za-z]\d{3,})\.html(?:[?#]|$)/);
    return m ? m[1] : '';
  }

  function decorate(root) {
    (root || document).querySelectorAll('.photo-card').forEach(function (card) {
      if (card.querySelector('.favbtn')) return;
      var id = extractId(card.getAttribute('href'));
      if (!id) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'favbtn' + (isFavorite(id) ? ' is-active' : '');
      btn.setAttribute('aria-label', 'あとで見るに追加・削除');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.7-4.35-9.3-8.1C1 10 1.5 6.5 4.4 5.1 6.7 4 9.2 4.8 12 7.4 14.8 4.8 17.3 4 19.6 5.1c2.9 1.4 3.4 4.9 1.7 7.8C18.7 16.65 12 21 12 21z"/></svg>';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var added = toggleFavorite(id);
        btn.classList.toggle('is-active', added);
      });
      card.appendChild(btn);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();
    decorate();
    // 検索結果・トップページなどは写真一覧を後からJSで描画するため、
    // 追加されたカードにも自動でハートを付けられるよう監視しておく。
    var mo = new MutationObserver(function () { decorate(); });
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();
