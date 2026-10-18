/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  main.js  Ver2.0（トップページ）
   データソース: site/data/photos.json
   ここでは「人気のスポット／ジャンル／シーン／新着／季節／フッター」を描きます。
   検索欄・検索結果・人気の写真ランキングは home-search.js が担当します。
   ===================================================================== */
(function () {
  'use strict';

  var DATA_URL = 'data/photos.json';
  var SEASONS = ['春', '夏', '秋', '冬'];

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // シートで写真が指定されていないときの代わりの画像
  var FALLBACK_IMAGES = {
    base: 'assets/img/lib/P0009-thumb.jpg',
    spots: {
      bench: 'assets/img/lib/P0008-thumb.jpg',
      hatago: 'assets/img/lib/P0001-thumb.jpg',
      gate: 'assets/img/lib/P0020-thumb.jpg',
      benten: 'assets/img/lib/P0026-thumb.jpg'
    },
    // 季節のカバー写真はイメージ。写真に季節が登録されているかどうかとは関係しない。
    seasons: {
      '春': { src: 'assets/img/lib/P0700-thumb.jpg', alt: '火打谷の菊桜' },
      '夏': { src: 'assets/img/lib/P0024-thumb.jpg', alt: 'エメラルドグリーンの海' },
      '秋': { src: 'assets/img/lib/P0001-thumb.jpg', alt: '機具岩に沈む夕陽' },
      '冬': { src: 'assets/img/lib/P0003-thumb.jpg', alt: '浜辺のさくら貝' }
    }
  };

  function withFallback(value, fallback) {
    return value && String(value).trim() ? value : fallback;
  }
  // 一覧では表示サイズに合う thumb（640×480）を使う。-hero / -scene / -new の画像は大きいので差し替える。
  function lightImage(path) {
    return String(path || '').replace(/-(hero|new)\.jpg$/, '-thumb.jpg');
  }

  /* ---------- データ取得（file:// では data.js にフォールバック） ---------- */
  function loadData() {
    return fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () {
        if (window.SPL_DATA) return window.SPL_DATA;
        throw new Error('データを読み込めませんでした');
      });
  }

  /* =====================================================================
     カード
     ===================================================================== */
  function spotCard(s) {
    var image = lightImage(withFallback(s.image, FALLBACK_IMAGES.spots[s.id] || FALLBACK_IMAGES.base));
    // 押すとページを移動せず、その場でそのスポットの写真を表示する（home-search.js）。
    // スポットの紹介ページへは、結果の上に出るリンクから行ける。
    return '<button class="tp-spot" type="button" data-spot="' + esc(s.name) + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(s.alt || s.name) + '" loading="lazy" width="640" height="480">' +
      '<span class="tp-card__name">' + esc(s.name) + '</span>' +
      '<span class="tp-card__meta">' + esc(s.description || s.area) + '</span>' +
      '<span class="tp-card__meta">写真 ' + esc(s.count) + '枚</span></button>';
  }

  function photoCard(p) {
    var flag = p.restricted ? '<span class="tp-card__lock">要問合せ</span>' : '';
    return '<a class="photo-card tp-card" href="photos/' + esc(p.id) + '.html">' +
      '<div class="photo-card__media"><img src="' + esc(lightImage(p.image)) + '" alt="' + esc(p.alt || p.title) +
        '" loading="lazy" width="640" height="480"></div>' +
      '<span class="tp-card__name">' + esc(p.title) + flag + '</span>' +
      '<span class="tp-card__meta">' + esc(p.spot || '') + '</span></a>';
  }

  function genreCard(g) {
    var image = withFallback(g.image, FALLBACK_IMAGES.base);
    return '<button class="tp-photo-button" type="button" data-genre="' + esc(g.query || g.label) + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(g.label + 'の写真（' + (g.alt || g.label) + '）') + '" loading="lazy" width="600" height="600">' +
      '<span class="tp-card__name">' + esc(g.label) + '</span></button>';
  }

  // 「春」「秋」は季節の絞り込み、それ以外（夕陽・海・花…）はキーワード検索として開く
  function sceneButton(s) {
    var attr = SEASONS.indexOf(s.query || s.label) !== -1
      ? 'data-season="' + esc(s.query || s.label) + '"'
      : 'data-q="' + esc(s.query || s.label) + '"';
    return '<button type="button" ' + attr + '>' + esc(s.label) + ' <span aria-hidden="true">↗</span></button>';
  }

  function seasonCard(s) {
    var fb = FALLBACK_IMAGES.seasons[s.ja] || { src: FALLBACK_IMAGES.base, alt: s.ja };
    var custom = s.image && String(s.image).trim();
    var image = custom ? lightImage(s.image) : fb.src;
    var alt = (custom ? (s.alt || s.ja) : fb.alt);
    return '<button class="tp-season" type="button" data-season="' + esc(s.query || s.ja) + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(s.ja + 'のイメージ：' + alt) + '" loading="lazy" width="640" height="480">' +
      '<span class="tp-season__title">' + esc(s.ja) + '<small>' + esc(s.en) + '</small>' +
        '<span class="tp-season__count" data-season-count="' + esc(s.query || s.ja) + '"></span></span></button>';
  }

  /* =====================================================================
     描画
     ===================================================================== */
  function render(d) {
    document.title = d.site.name + '｜' + d.site.nameJa;

    $('#spotGrid').innerHTML   = d.spots.map(spotCard).join('');
    // 先頭の4つ以外のスポットは「すべてのスポット」で展開する（スポット一覧ページの代わり）
    var shown = d.spots.map(function (s) { return s.id; });
    var rest = (d.allSpots || []).filter(function (s) { return shown.indexOf(s.id) === -1; });
    $('#spotRest').innerHTML = rest.map(spotCard).join('');
    var more = $('#spotsMore');
    if (rest.length && more) {
      more.hidden = false;
      var label = function (open) { more.innerHTML = (open ? '閉じる' : 'すべてのスポット（' + (shown.length + rest.length) + '件）') + ' <span aria-hidden="true">' + (open ? '↑' : '↓') + '</span>'; };
      label(false);
      more.addEventListener('click', function () {
        var open = more.getAttribute('aria-expanded') !== 'true';
        more.setAttribute('aria-expanded', String(open));
        $('#spotRest').hidden = !open;
        label(open);
      });
    }
    $('#genreGrid').innerHTML  = (d.genres || []).map(genreCard).join('');
    // 春・秋などの季節は、下の「四季折々の志賀町」で紹介しているため、おすすめシーンには出さない
    $('#sceneGrid').innerHTML  = (d.scenes || []).filter(function (s) {
      return SEASONS.indexOf(s.query || s.label) === -1;
    }).map(sceneButton).join('');
    $('#photoGrid').innerHTML  = d.photos.slice(0, 8).map(photoCard).join('');   // 新着は8件（PC4列×2行）
    $('#seasonGrid').innerHTML = d.seasons.map(seasonCard).join('');

    var f = d.footer || { primary: [], secondary: [] };
    $('#footerPrimary').innerHTML = f.primary.filter(function (l) { return l.label !== 'お問い合わせ'; }).map(function (l) {
      var ext = /^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(l.href) + '"' + ext + '>' + esc(l.label) + (ext ? ' ↗' : '') + '</a>';
    }).join('') + '<a href="#find">写真を探す ↑</a>';
    $('#footerLinks').innerHTML = f.secondary.map(function (l) {
      return '<li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>';
    }).join('');
    $('#footerCopy').textContent = d.site.copyright;
  }

  /* =====================================================================
     UI
     ===================================================================== */
  function initDrawer() {
    var dr = $('#drawer'), btn = $('#btnBurger');
    var open  = function () { dr.classList.add('is-open');    btn.setAttribute('aria-expanded', 'true'); };
    var close = function () { dr.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', open);
    $('#drawerClose').addEventListener('click', function () { close(); btn.focus(); });
    dr.addEventListener('click', function (e) { if (e.target === dr) close(); });
    $$('.drawer__link', dr).forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dr.classList.contains('is-open')) { close(); btn.focus(); }
    });
  }

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
    initDrawer();
    loadData().then(render).catch(function (err) {
      console.error(err);
    });
  });
})();
