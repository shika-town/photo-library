/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  favorites.js
   あとで見るリストページ：localStorageに保存されたIDをもとに
   data/library.json から該当する写真だけを表示します。
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function loadLibrary() {
    return fetch('data/library.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () {
        if (window.SPL_LIBRARY) return window.SPL_LIBRARY;
        throw new Error('データを読み込めませんでした');
      });
  }

  function card(p) {
    var tags = (p.tags || []).slice(0, 3)
      .map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('');
    return '<a class="photo-card" href="photos/' + esc(p.id) + '.html">' +
      '<div class="photo-card__media"><img src="' + esc(p.thumb) + '" alt="' + esc(p.alt) +
        '" loading="lazy" width="640" height="480"></div>' +
      '<div class="photo-card__body">' +
        '<h3 class="photo-card__title">' + esc(p.title) + '</h3>' +
        '<p class="photo-card__area"><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(p.area) + '</p>' +
        '<div class="photo-card__tags">' + tags + '</div>' +
      '</div></a>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SPLFavorites) return;

    loadLibrary().then(function (lib) {
      var byId = {};
      lib.photos.forEach(function (p) { byId[p.id] = p; });

      function render() {
        var ids = window.SPLFavorites.getFavorites();
        var list = ids.map(function (id) { return byId[id]; }).filter(Boolean);
        $('#favCount').textContent = list.length ? list.length + '件の写真' : '';
        $('#clearFav').hidden = !list.length;
        $('#noResult').hidden = !!list.length;
        $('#photoGrid').innerHTML = list.map(card).join('');
      }

      render();

      // カードのハートを外したら、一覧からもすぐ消す
      // （ハートボタンのクリックは card への伝播を止めているため、クリックの
      //   バブリングではなく favorites-widget.js が発火するイベントを見る）
      document.addEventListener('splfavoriteschange', render);
      $('#clearFav').addEventListener('click', function () {
        if (!confirm('あとで見るリストを全部削除します。よろしいですか？')) return;
        window.SPLFavorites.getFavorites().slice().forEach(function (id) {
          window.SPLFavorites.remove(id);
        });
        render();
      });
    }).catch(function (err) {
      console.error(err);
      $('#noResult').hidden = false;
      $('#noResult').textContent = 'データを読み込めませんでした。ローカルで確認する場合は簡易サーバーを起動してください。';
    });
  });
})();
