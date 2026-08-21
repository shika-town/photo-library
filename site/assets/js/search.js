/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  search.js
   検索結果ページ：URLの ?q= を読み、library.json から絞り込んで表示します。
   ===================================================================== */
(function () {
  'use strict';
  var PER_PAGE = 12;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

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

  function match(p, q) {
    var hay = [p.title, p.spot, p.area, p.season].concat(p.tags || []).join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }
  // タグ・季節での絞り込みは、タイトルやスポット名にたまたま同じ文字が含まれるだけの
  // 無関係な写真を拾わないよう、完全一致でのみ判定する（自由文検索の match() とは別）。
  function matchTag(p, tag) {
    return (p.tags || []).indexOf(tag) !== -1;
  }
  function matchSeason(p, season) {
    return String(p.season || '') === season;
  }

  function pager(page, total) {
    if (total <= 1) return '';
    var html = '<button class="pager__btn" type="button" data-page="' + (page - 1) + '"' +
               (page === 1 ? ' disabled' : '') + ' aria-label="前のページ">' +
               '<svg aria-hidden="true"><use href="#i-chev-l"/></svg></button>';
    var pages = [];
    for (var i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - page) <= 1) pages.push(i);
      else if (pages[pages.length - 1] !== '…') pages.push('…');
    }
    pages.forEach(function (n) {
      html += (n === '…')
        ? '<span class="pager__gap">…</span>'
        : '<button class="pager__btn' + (n === page ? ' is-active' : '') +
          '" type="button" data-page="' + n + '">' + n + '</button>';
    });
    html += '<button class="pager__btn" type="button" data-page="' + (page + 1) + '"' +
            (page === total ? ' disabled' : '') + ' aria-label="次のページ">' +
            '<svg aria-hidden="true"><use href="#i-chev-r"/></svg></button>';
    return html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // モバイルメニュー
    var dr = $('#drawer'), bg = $('#btnBurger');
    if (dr && bg) {
      var close = function () { dr.classList.remove('is-open'); bg.setAttribute('aria-expanded', 'false'); };
      bg.addEventListener('click', function () { dr.classList.add('is-open'); bg.setAttribute('aria-expanded', 'true'); });
      $('#drawerClose').addEventListener('click', close);
      dr.addEventListener('click', function (e) { if (e.target === dr) close(); });
      $$('.drawer__link', dr).forEach(function (a) { a.addEventListener('click', close); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    }

    var params = new URLSearchParams(location.search);
    var q = (params.get('q') || '').trim();
    var tag = (params.get('tag') || '').trim();
    var season = (params.get('season') || '').trim();
    var page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    var area = params.get('area') || 'all';
    // 表示・検索欄への反映用（タグ／季節で来た場合もそのキーワードを見せる）
    var displayQuery = tag || season || q;

    $('#searchInput').value = displayQuery;
    document.title = (displayQuery ? '「' + displayQuery + '」の検索結果' : '写真から探す') + '｜SHIKA PHOTO LIBRARY';

    $('#searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#searchInput').value.trim();
      location.search = v ? '?q=' + encodeURIComponent(v) : '';
    });

    loadLibrary().then(function (lib) {
      var all = lib.photos;
      // タグ・季節はそのタグ／季節が実際に付いている写真だけに絞る完全一致、
      // 自由文検索（q）はタイトル・スポット名なども含めたあいまい検索。
      var hits = tag ? all.filter(function (p) { return matchTag(p, tag); })
        : season ? all.filter(function (p) { return matchSeason(p, season); })
        : q ? all.filter(function (p) { return match(p, q.toLowerCase()); })
        : all.slice();
      var areas = [];
      hits.forEach(function (p) { if (areas.indexOf(p.area) === -1) areas.push(p.area); });

      // エリア絞り込み
      $('#areaFilters').innerHTML =
        '<button class="filter' + (area === 'all' ? ' is-active' : '') + '" type="button" data-area="all">すべて（' + hits.length + '）</button>' +
        areas.map(function (a) {
          var n = hits.filter(function (p) { return p.area === a; }).length;
          return '<button class="filter' + (area === a ? ' is-active' : '') +
                 '" type="button" data-area="' + esc(a) + '">' + esc(a) + '（' + n + '）</button>';
        }).join('');

      var list = (area === 'all') ? hits : hits.filter(function (p) { return p.area === area; });
      var totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      page = Math.min(page, totalPages);

      $('#searchTitle').textContent = displayQuery ? '「' + displayQuery + '」の検索結果' : '写真から探す';
      $('#searchCount').innerHTML = '<strong>' + list.length + '</strong>枚の写真' +
        (totalPages > 1 ? '（' + page + ' / ' + totalPages + ' ページ）' : '');
      $('#resetLink').hidden = !displayQuery && area === 'all';

      if (!list.length) {
        $('#photoGrid').innerHTML = '';
        $('#noResult').hidden = false;
        $('#pager').innerHTML = '';
        return;
      }
      $('#noResult').hidden = true;
      $('#photoGrid').innerHTML = list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(card).join('');
      $('#pager').innerHTML = pager(page, totalPages);

      function go(next) {
        var u = new URLSearchParams();
        if (tag) u.set('tag', tag);
        else if (season) u.set('season', season);
        else if (q) u.set('q', q);
        if (next.area !== undefined ? next.area !== 'all' : area !== 'all') u.set('area', next.area !== undefined ? next.area : area);
        if (next.page && next.page > 1) u.set('page', next.page);
        location.search = u.toString() ? '?' + u.toString() : '';
      }
      $('#pager').addEventListener('click', function (e) {
        var b = e.target.closest('.pager__btn');
        if (b && !b.disabled) go({ page: parseInt(b.dataset.page, 10) });
      });
      $('#areaFilters').addEventListener('click', function (e) {
        var b = e.target.closest('.filter');
        if (b) go({ area: b.dataset.area, page: 1 });
      });
    }).catch(function (err) {
      console.error(err);
      $('#noResult').hidden = false;
      $('#noResult').textContent = 'データを読み込めませんでした。ローカルで確認する場合は簡易サーバーを起動してください。';
    });
  });
})();
