/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  home-search.js
   トップページの「写真を、見つける。」（検索欄・絞り込み・結果）と、
   目的で探す／ジャンル／シーン／季節からの検索、人気の写真ランキングを担当します。

   ・検索の照合ルールは search-core.js（検索結果ページと共通）
   ・検索語と絞り込みは URL のパラメーター（q / spot / genre / use / season）に保存します。
     写真ページへ移動して「戻る」を押しても、同じ検索結果に戻ります。
   ===================================================================== */
(function () {
  'use strict';

  var PAGE = 12;                 // 検索結果は12枚ずつ
  var FIELDS = [                 // [URLパラメーター, 入力欄のid, 画面に出すラベル]
    ['q', 'tpQuery', 'キーワード'], ['spot', 'tpSpot', '場所'], ['genre', 'tpGenre', 'ジャンル'],
    ['use', 'tpUse', '用途'], ['season', 'tpSeason', '季節']
  ];

  var $ = function (s, c) { return (c || document).querySelector(s); };
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(n) { return Number(n).toLocaleString('ja-JP'); }

  var library = [];              // data/library.json の写真一覧
  var matches = [], shown = PAGE, searched = false;

  function field(key) { return $('#' + FIELDS.filter(function (f) { return f[0] === key; })[0][1]); }

  /* ---------- データ取得（file:// では library-data.js にフォールバック） ---------- */
  function loadLibrary() {
    return fetch('data/library.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () {
        if (window.SPL_LIBRARY) return window.SPL_LIBRARY;
        return new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = 'assets/js/library-data.js';
          s.onload = function () { window.SPL_LIBRARY ? resolve(window.SPL_LIBRARY) : reject(new Error('library')); };
          s.onerror = function () { reject(new Error('library')); };
          document.head.appendChild(s);
        });
      });
  }

  /* ---------- 条件 ---------- */
  function conditions() {
    return FIELDS.map(function (f) {
      return { key: f[0], label: f[2], value: field(f[0]).value.trim() };
    }).filter(function (c) { return c.value; });
  }
  function setAll(vals) {
    FIELDS.forEach(function (f) { field(f[0]).value = (vals && vals[f[0]]) || ''; });
  }
  function condObject() {
    return { q: field('q').value, spot: field('spot').value, genre: field('genre').value,
             use: field('use').value, season: field('season').value };
  }

  /* ---------- 結果の描画 ---------- */
  function card(p) {
    var flag = p.restricted
      ? '<span class="photo-card__flag" title="ダウンロードには事前のお問い合わせが必要です">要問合せ</span>' : '';
    return '<a class="photo-card tp-card" href="photos/' + esc(p.id) + '.html">' +
      '<div class="photo-card__media"><img src="' + esc(p.thumb) + '" alt="' + esc(p.alt || p.title) +
        '" loading="lazy" width="640" height="480">' + flag + '</div>' +
      '<span class="tp-card__name">' + esc(p.title) + '</span>' +
      '<span class="tp-card__meta">' + esc((p.spot || 'その他') + ' ／ ' + (p.genre || '') + ' ／ ' + p.id) + '</span></a>';
  }

  function draw() {
    var cs = conditions();
    var results = $('#tpResults');
    results.hidden = !searched;

    // 選択中の条件（1つずつ解除できる）
    $('#tpActive').innerHTML = cs.map(function (c) {
      return '<button type="button" class="tp-chip" data-remove="' + esc(c.key) + '" aria-label="' +
        esc(c.label + '「' + c.value + '」を解除') + '"><b>' + esc(c.label) + '</b>' + esc(c.value) +
        '<span aria-hidden="true"> ×</span></button>';
    }).join('');
    if (!searched) return;

    var n = matches.length;
    $('#tpCards').innerHTML = matches.slice(0, shown).map(card).join('');
    $('#tpStatus').innerHTML = '<strong>' + num(n) + '件</strong><span>' +
      (n ? num(Math.min(shown, n)) + '件を表示中' : '見つかりませんでした') + '</span>';

    var empty = $('#tpEmpty');
    empty.hidden = n > 0;
    empty.innerHTML = '';
    if (!n) {
      empty.innerHTML = '<p>言葉を短くするか、条件を減らしてお試しください。</p>' +
        cs.map(function (c) {
          return '<button type="button" class="tp-chip" data-remove="' + esc(c.key) + '">「' + esc(c.value) + '」を外す</button>';
        }).join('') +
        (cs.length > 1 ? '<button type="button" class="tp-chip" data-clear-all>すべての条件を解除</button>' : '');
    }

    // スポットで絞っているときは、そのスポットの紹介ページへのリンクを出す
    var spotLink = $('#tpSpotLink');
    var spotName = field('spot').value;
    var spotId = '';
    library.some(function (p) { if (p.spot === spotName && p.spotId) { spotId = p.spotId; return true; } return false; });
    spotLink.hidden = !(spotName && spotId);
    if (!spotLink.hidden) {
      spotLink.innerHTML = '<a href="spots/' + esc(spotId) + '.html">' + esc(spotName) + 'の紹介ページを見る <span aria-hidden="true">→</span></a>';
    }

    var note = $('#tpNote');
    note.hidden = !field('season').value;
    if (!note.hidden) {
      note.textContent = '季節の情報は、登録済みの' + num(seasonRegistered()) + '枚が対象です。未登録の写真はこの絞り込みに含まれません。';
    }
    var more = $('#tpMore');
    more.hidden = n <= shown;
    more.textContent = 'さらに' + Math.min(PAGE, n - shown) + '件を表示';
  }

  /* ---------- 検索の実行とURLの保存・復元 ---------- */
  function toQueryString() {
    var u = new URLSearchParams();
    conditions().forEach(function (c) { u.set(c.key, c.value); });
    return u.toString();
  }
  function sync(push) {
    var qs = toQueryString();
    if (qs === location.search.replace(/^\?/, '')) return;
    history[push ? 'pushState' : 'replaceState'](null, '', qs ? '?' + qs : location.pathname);
  }
  function search(opts) {
    opts = opts || {};
    searched = conditions().length > 0;
    shown = PAGE;
    matches = searched ? SPLSearch.filter(library, condObject()) : [];
    draw();
    sync(opts.push !== false);
    if (opts.scroll && searched) $('#tpResults').scrollIntoView({ block: 'start' });
  }
  function fromURL() {
    var u = new URLSearchParams(location.search);
    var vals = {};
    FIELDS.forEach(function (f) { vals[f[0]] = u.get(f[0]) || ''; });
    setAll(vals);
    searched = conditions().length > 0;
    shown = PAGE;
    matches = searched ? SPLSearch.filter(library, condObject()) : [];
    draw();
  }

  /* ---------- 季節の登録状況 ---------- */
  function seasonRegistered() {
    return library.filter(function (p) { return SPLSearch.seasonsOf(p).length; }).length;
  }
  function renderSeasonInfo() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-season-count]'), function (el) {
      var s = el.getAttribute('data-season-count');
      el.textContent = '登録 ' + library.filter(function (p) { return SPLSearch.seasonsOf(p).indexOf(s) !== -1; }).length + '件';
    });
    $('#seasonNote').textContent = '季節の情報を登録済みの写真（現在' + seasonRegistered() +
      '件）が検索の対象です。カバー写真はイメージです。';
  }

  /* ---------- 人気の写真（保存済みのGA4ランキング。上位3件＋「もっと見る」で10件） ---------- */
  function rankItem(p, r, rank) {
    return '<li><a class="photo-card tp-card tp-rank" href="photos/' + esc(p.id) + '.html">' +
      '<div class="photo-card__media"><img src="' + esc(p.thumb) + '" alt="' + esc(p.alt || p.title) +
        '" loading="lazy" width="640" height="480"></div>' +
      '<span class="tp-rank__num"><span class="sr-only">第</span>' + (rank < 10 ? '0' : '') + rank + '<span class="sr-only">位</span></span>' +
      '<span class="tp-card__name">' + esc(p.title) + '</span>' +
      '<span class="tp-card__meta">' + esc(p.spot || '') + '</span>' +
      '<span class="tp-rank__dl">ダウンロード ' + esc(r.downloads) + '回</span></a></li>';
  }
  function renderRanking(rk) {
    // ライブラリに無い写真（GA4側のIDが空の行など）は画像を出せないので外す
    var byId = {};
    library.forEach(function (p) { byId[p.id] = p; });
    var rows = ((rk && rk.photos) || []).filter(function (r) { return r && byId[r.id]; }).slice(0, 10);
    if (!rows.length) return;
    var top = rows.slice(0, 3), rest = rows.slice(3);
    $('#rankingGrid').innerHTML = top.map(function (r, i) { return rankItem(byId[r.id], r, i + 1); }).join('');
    $('#rankingRest').innerHTML = rest.map(function (r, i) { return rankItem(byId[r.id], r, i + 4); }).join('');
    var more = $('#rankingMore');
    more.hidden = !rest.length;
    more.textContent = '';
    more.innerHTML = 'もっと見る（' + rest.length + '件） <span aria-hidden="true">↓</span>';
    more.addEventListener('click', function () {
      var open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      $('#rankingRest').hidden = !open;
      more.innerHTML = open ? '閉じる <span aria-hidden="true">↑</span>'
                            : 'もっと見る（' + rest.length + '件） <span aria-hidden="true">↓</span>';
    });
    var days = rk.periodDays || 30;
    $('#rankingLead').textContent = 'よくダウンロードされている写真 TOP' + rows.length + '。';
    $('#rankingNote').textContent = '過去' + days + '日間のダウンロード数にもとづく順位です。';
    $('#ranking').hidden = false;
    $('#tpJumpRanking').hidden = false;
  }

  /* ---------- 起動 ---------- */
  function init() {
    // 撮影スポット（写真の多い順、「その他」は最後）とジャンルの選択肢
    var count = {};
    library.forEach(function (p) { if (p.spot) count[p.spot] = (count[p.spot] || 0) + 1; });
    var spots = Object.keys(count).sort(function (a, b) {
      return ((a === 'その他') - (b === 'その他')) || (count[b] - count[a]);
    });
    $('#tpSpot').insertAdjacentHTML('beforeend', spots.map(function (s) {
      return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
    }).join(''));
    var genres = [];
    library.forEach(function (p) { if (p.genre && genres.indexOf(p.genre) === -1) genres.push(p.genre); });
    $('#tpGenre').insertAdjacentHTML('beforeend', ['観光地', '特産品', '祭り', 'イベント', '自然風景']
      .filter(function (g) { return genres.indexOf(g) !== -1; })
      .map(function (g) { return '<option>' + esc(g) + '</option>'; }).join(''));

    $('#tpTotal').textContent = num(library.length) + '件の写真から';
    renderSeasonInfo();
    fromURL();

    $('#tpForm').addEventListener('submit', function (e) { e.preventDefault(); search(); });
    ['tpSpot', 'tpGenre', 'tpUse', 'tpSeason'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () { search(); });
    });
    $('#tpClear').addEventListener('click', function () { setAll(); search(); field('q').focus(); });
    $('#tpMore').addEventListener('click', function () { shown += PAGE; draw(); });
    window.addEventListener('popstate', fromURL);

    // 入力例・ジャンル・シーン・季節・条件のはずし方
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-remove],[data-clear-all],[data-q],[data-genre],[data-season],[data-spot]');
      if (!t || !t.closest('main')) return;
      if (t.hasAttribute('data-remove')) { field(t.getAttribute('data-remove')).value = ''; search(); return; }
      if (t.hasAttribute('data-clear-all')) { setAll(); search(); return; }
      var vals = {};
      if (t.hasAttribute('data-q')) vals.q = t.getAttribute('data-q');
      else if (t.hasAttribute('data-genre')) vals.genre = t.getAttribute('data-genre');
      else if (t.hasAttribute('data-spot')) vals.spot = t.getAttribute('data-spot');
      else vals.season = t.getAttribute('data-season');
      setAll(vals);
      search({ scroll: true });
    });

    // 目的で写真を探す：使いたい場面（用途タグ）× 欲しい雰囲気（キーワード）
    $('#purposeFinder').addEventListener('submit', function (e) {
      e.preventDefault();
      setAll({ use: $('#purposeUse').value, q: $('#purposeMood').value });
      search({ scroll: true });
    });

    fetch('data/ranking.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderRanking)
      .catch(function () { /* 未設定・未生成ならランキングは表示しない */ });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadLibrary().then(function (lib) {
      library = lib.photos;
      init();
    }).catch(function (err) {
      console.error(err);
      $('#tpResults').hidden = false;
      $('#tpStatus').textContent = '写真データを読み込めませんでした。時間をおいて、もう一度お試しください。';
    });
  });
})();
