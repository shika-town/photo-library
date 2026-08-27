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

  // 「先月人気だった写真」ランキング：GA4連携が未設定の間は data/ranking.json が
  // 存在しない（またはfile:// で読めない）ので、その場合は静かに諦めて
  // セクションを表示しないままにする（サイトの他の機能には影響しない）。
  function renderRanking(d) {
    if (!d || !d.photos || !d.photos.length) return;
    // GA4側のイベントにphoto_idが記録されていない行（"(not set)" 等）は、
    // library.jsonに紐づく情報（thumb/title）が無く画像を出せないため描画対象から外す。
    var photos = d.photos.filter(function (p) { return p && p.thumb && p.title; });
    if (!photos.length) return;
    var section = $('#ranking');
    var grid = $('#rankingGrid');
    if (!section || !grid) return;
    grid.innerHTML = photos.map(rankingCard).join('');
    section.hidden = false;
  }
  function loadRanking() {
    fetch('data/ranking.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(renderRanking)
      .catch(function () { /* 未設定・未生成なら何もしない */ });
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

  // ランキング用カード：data/ranking.json は library.json と同じ命名（p.thumb）を使うため、
  // photoCard（p.image）とは別に用意する。
  function rankingCard(p) {
    var tags = (p.tags || []).map(function (t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('');
    return '<a class="photo-card" href="photos/' + esc(p.id) + '.html">' +
      '<div class="photo-card__media"><img src="' + esc(p.thumb) + '" alt="' + esc(p.alt || p.title) +
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

  var HERO_INTERVAL_MS = 5000;
  var heroTimer = null;

  // 写真の明るさ（0〜255）をざっくり測る。縮小して描くのでコストは小さい。
  // 読み取れない場合（file:// など）は null を返し、判定自体をあきらめる。
  var HERO_LIGHT_THRESHOLD = 150;
  function measureBrightness(img, done) {
    function run() {
      try {
        var w = 16, h = 16;
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var data = ctx.getImageData(0, 0, w, h).data;
        var sum = 0, n = 0;
        for (var i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n++;
        }
        done(sum / n);
      } catch (e) { done(null); }
    }
    if (img.complete && img.naturalWidth) run(); else img.addEventListener('load', run);
  }

  // ヒーロー画像：1枚だけならこれまで通りの静止画、2枚以上なら数秒おきに
  // クロスフェードで切り替わるスライドショーになる。
  function renderHero(hero) {
    var media = $('#heroMedia');
    var heroSection = document.querySelector('.hero');
    var images = (hero.images && hero.images.length) ? hero.images : [{ image: hero.image, alt: hero.alt }];
    media.innerHTML = images.map(function (im, i) {
      return '<img class="hero__slide' + (i === 0 ? ' is-active' : '') + '" ' +
        'src="' + esc(withFallback(im.image, FALLBACK_IMAGES.hero)) + '" alt="' + esc(im.alt || hero.alt || '') + '" ' +
        (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ' width="2400" height="1350">';
    }).join('');

    // スライドショーは写真ごとに場所が違うため、右下のキャプションも切り替わる
    // スライドに合わせて表示する（キャプション欄が固定だと、違う場所の写真なのに
    // 前の場所の名前が出続けてしまうため）。
    var captionEl = $('#heroCaption').querySelector('span');
    function setCaption(i) {
      captionEl.textContent = (images[i] && images[i].alt) || hero.caption || '';
    }
    setCaption(0);

    // 明るい写真では白文字だと読みにくいため、写真ごとに測った明るさに応じて
    // 文字色（白／濃紺）を自動で切り替える。
    var slides = $$('.hero__slide', media);
    slides.forEach(function (s) {
      measureBrightness(s, function (b) {
        s.dataset.brightness = b == null ? '' : String(b);
        if (s.classList.contains('is-active')) applyTextColor(s);
      });
    });
    function applyTextColor(s) {
      var b = s.dataset.brightness;
      if (b === '' || b === undefined) return; // 測れなかった写真は今の配色のまま
      heroSection.classList.toggle('is-light-photo', Number(b) > HERO_LIGHT_THRESHOLD);
    }
    applyTextColor(slides[0]);

    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
    if (images.length > 1) {
      var idx = 0;
      heroTimer = setInterval(function () {
        slides[idx].classList.remove('is-active');
        idx = (idx + 1) % slides.length;
        slides[idx].classList.add('is-active');
        setCaption(idx);
        applyTextColor(slides[idx]);
      }, HERO_INTERVAL_MS);
    }
  }

  /* =====================================================================
     描画
     ===================================================================== */
  function render(d) {
    // 1行目は大きく手書き風に、2行目以降は説明文として小さく添える。
    $('#heroTitle').innerHTML = d.hero.title.map(function (t, i) {
      var cls = i === 0 ? 'hero__title-main' : 'hero__title-sub';
      return '<span class="' + cls + '">' + esc(t) + '</span>';
    }).join('');
    renderHero(d.hero);
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
    loadRanking();

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
      if (t) t.innerHTML = '<span class="hero__title-main">#しかたび</span>'
        + '<span class="hero__title-sub">志賀町の、いまを写真に。\n未来へつなぐフォトライブラリー</span>';
    });
  });
})();
