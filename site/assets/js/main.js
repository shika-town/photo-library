/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  main.js  Ver1.1
   データソース: site/data/photos.json
   （将来 Google スプレッドシートの公開JSONに差し替え可能）
   ===================================================================== */
(function () {
  'use strict';

  var DATA_URL = 'data/photos.json';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function icon(id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  var FALLBACK_IMAGES = {
    hero: 'assets/img/lib/P0009-hero.jpg',
    spots: {
      bench: 'assets/img/lib/P0008-hero.jpg',
      hatago: 'assets/img/lib/P0001-hero.jpg',
      gate: 'assets/img/lib/P0020-hero.jpg',
      benten: 'assets/img/lib/P0026-hero.jpg'
    },
    scenes: {
      '夕陽': 'assets/img/lib/P0063-scene.jpg',
      '海': 'assets/img/lib/P0064-scene.jpg',
      '空撮': 'assets/img/lib/P0065-scene.jpg',
      '春': 'assets/img/lib/P0066-scene.jpg',
      '秋': 'assets/img/lib/P0067-scene.jpg',
      '星空': 'assets/img/lib/P0068-scene.jpg'
    },
    seasons: {
      '春': 'assets/img/lib/P0069-season.jpg',
      '夏': 'assets/img/lib/P0070-season.jpg',
      '秋': 'assets/img/lib/P0071-season.jpg',
      '冬': 'assets/img/lib/P0072-season.jpg'
    }
  };

  function withFallback(value, fallback) {
    return value && String(value).trim() ? value : fallback;
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
    var image = withFallback(s.image, FALLBACK_IMAGES.spots[s.id] || FALLBACK_IMAGES.hero);
    return '<a class="spot-card" href="spots/' + esc(s.id) + '.html">' +
      '<div class="spot-card__media"><img src="' + esc(image) + '" alt="' + esc(s.alt || s.name) +
        '" loading="lazy" width="1200" height="800"></div>' +
      '<div class="spot-card__body">' +
        '<h3 class="spot-card__name">' + esc(s.name) + '</h3>' +
        '<p class="spot-card__area">' + icon('i-pin') + esc(s.area) + '</p>' +
        '<p class="spot-card__count">写真 ' + esc(s.count) + '枚</p>' +
      '</div></a>';
  }

  function photoCard(p) {
    var tags = (p.tags || []).map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('');
    return '<a class="photo-card" href="photos/' + esc(p.id) + '.html">' +
      '<div class="photo-card__media"><img src="' + esc(p.image) + '" alt="' + esc(p.alt || p.title) +
        '" loading="lazy" width="1080" height="840"></div>' +
      '<div class="photo-card__body">' +
        '<h3 class="photo-card__title">' + esc(p.title) + '</h3>' +
        '<p class="photo-card__area">' + icon('i-pin') + esc(p.area) + '</p>' +
        '<div class="photo-card__tags">' + tags + '</div>' +
      '</div></a>';
  }

  function sceneCard(s) {
    var image = withFallback(s.image, FALLBACK_IMAGES.scenes[s.label] || FALLBACK_IMAGES.hero);
    return '<button class="scene-card" type="button" data-query="' + esc(s.query) + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(s.alt || s.label) + '" loading="lazy" width="600" height="600">' +
      '<span class="scene-card__label">' + esc(s.label) + '</span></button>';
  }

  function seasonCard(s) {
    var image = withFallback(s.image, FALLBACK_IMAGES.seasons[s.ja] || FALLBACK_IMAGES.hero);
    return '<a class="season-card" href="#season-' + esc(s.en) + '" data-query="' + esc(s.query) + '">' +
      '<img src="' + esc(image) + '" alt="' + esc(s.alt || s.ja) + 'の志賀町" loading="lazy" width="800" height="600">' +
      '<span class="season-card__label">' +
        '<span class="season-card__ja">' + esc(s.ja) + '</span>' +
        '<span class="season-card__en">' + esc(s.en) + '</span>' +
      '</span></a>';
  }

  /* =====================================================================
     描画
     ===================================================================== */
  function render(d) {
    $('#heroTitle').innerHTML = d.hero.title.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    $('#heroImg').src = withFallback(d.hero.image, FALLBACK_IMAGES.hero);
    $('#heroImg').alt = d.hero.alt || '';
    $('#heroCaption').querySelector('span').textContent = d.hero.caption;
    document.title = d.site.name + '｜' + d.site.nameJa;

    var chips = (d.heroTags || []).map(function (t) {
      return '<button class="herotag" type="button" data-query="' + esc(t) + '">#' + esc(t) + '</button>';
    }).join(' ');
    $('#heroTags').innerHTML = chips;

    $('#spotGrid').innerHTML   = d.spots.map(spotCard).join('');
    $('#sceneGrid').innerHTML  = (d.scenes || []).map(sceneCard).join('');
    $('#photoGrid').innerHTML  = d.photos.slice(0, 6).map(photoCard).join('');  // 新着は6件（3列×2行）
    $('#seasonGrid').innerHTML = d.seasons.map(seasonCard).join('');

    $('#tagChips').innerHTML = (d.heroTags || []).map(function (t) {
      return '<button class="tagchip" type="button" data-query="' + esc(t) + '">#' + esc(t) + '</button>';
    }).join('');

    var f = d.footer || { primary: [], secondary: [] };
    $('#footerPrimary').innerHTML = f.primary.map(function (l) {
      var ext = /^https?:/.test(l.href) ? ' target="_blank" rel="noopener"' : '';
      return '<a class="footer__btn" href="' + esc(l.href) + '"' + ext + '>' + icon(l.icon) + esc(l.label) + '</a>';
    }).join('');
    $('#footerLinks').innerHTML = f.secondary.map(function (l) {
      return '<li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>';
    }).join('');
    $('#footerCopy').textContent = d.site.copyright;
  }

  /* =====================================================================
     検索 ― 検索結果ページ（search.html）へ渡す
     ===================================================================== */
  function goSearch(q) {
    if (!q || !q.trim()) return;
    location.href = 'search.html?q=' + encodeURIComponent(q.trim());
  }
  // タグ・シーンのクリックは自由文検索（q=）ではなく、そのタグが実際に付いている
  // 写真だけに絞り込む専用パラメータ（tag=）を使う。タイトルやスポット名にたまたま
  // 同じ文字が含まれるだけの無関係な写真まで拾ってしまうのを防ぐため。
  function goTagSearch(tag) {
    if (!tag || !tag.trim()) return;
    location.href = 'search.html?tag=' + encodeURIComponent(tag.trim());
  }
  function goSeasonSearch(season) {
    if (!season || !season.trim()) return;
    location.href = 'search.html?season=' + encodeURIComponent(season.trim());
  }

  /* =====================================================================
     UI
     ===================================================================== */
  function initHeader() {
    var header = $('#header');
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 70); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initOverlay() {
    var ov = $('#overlay');
    var open  = function () { ov.classList.add('is-open'); setTimeout(function () { $('#overlayInput').focus(); }, 60); };
    var close = function () { ov.classList.remove('is-open'); };
    $('#btnSearch').addEventListener('click', open);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    return { open: open, close: close };
  }

  function initDrawer() {
    var dr = $('#drawer'), btn = $('#btnBurger');
    var open  = function () { dr.classList.add('is-open');    btn.setAttribute('aria-expanded', 'true'); };
    var close = function () { dr.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', open);
    $('#drawerClose').addEventListener('click', close);
    dr.addEventListener('click', function (e) { if (e.target === dr) close(); });
    $$('.drawer__link', dr).forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1 });
    $$('.reveal').forEach(function (el) { io.observe(el); });
  }

  /* =====================================================================
     起動
     ===================================================================== */

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
    initHeader();
    initDrawer();
    var overlay = initOverlay();

    loadData().then(function (d) {
      render(d);
      initReveal();

      $('#heroForm').addEventListener('submit', function (e) {
        e.preventDefault();
        goSearch($('#heroInput').value);
      });
      $('#overlayForm').addEventListener('submit', function (e) {
        e.preventDefault();
        goSearch($('#overlayInput').value);
      });

      // タグ・シーン・季節のクリックで検索結果ページへ
      document.addEventListener('click', function (e) {
        var t = e.target.closest('[data-query]');
        if (!t) return;
        e.preventDefault();
        if (t.classList.contains('season-card')) goSeasonSearch(t.dataset.query);
        else goTagSearch(t.dataset.query);
      });

    }).catch(function (err) {
      console.error(err);
      var t = $('#heroTitle');
      if (t) t.innerHTML = '<span>志賀町の風景を、</span><span>未来へ残す。</span>';
    });
  });
})();
