/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  hero.js
   トップページ表紙のスライドショー。
   ・1枚目は index.html に直接書いてあり、2枚目以降を data/hero-slides.json から読み込む
   ・写真をクリックすると、その写真の詳細・ダウンロードのページへ
   ・右下の ‹ › ● で手動切り替え、Ⅱ で自動切り替えを止める
   ・「視覚効果を減らす」設定の端末では自動切り替えをしない
   ===================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var slides = [];        // [{id, label, alt, place[], el}]
  var cur = 0, timer = null, paused = reduceMotion, interval = 6000;

  function show(i, manual) {
    if (!slides.length) return;
    cur = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.el.classList.toggle('is-active', k === cur); });
    var s = slides[cur];
    var place = $('#tpPlace');
    place.innerHTML = s.place.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    // 自分で切り替えたときだけ、読み上げ機器に新しい写真の場所を知らせる
    place.setAttribute('aria-live', manual ? 'polite' : 'off');
    var href = 'photos/' + s.id + '.html';
    $('#tpHeroLink').setAttribute('href', href);
    $('#tpHeroMore').setAttribute('href', href);
    Array.prototype.forEach.call(document.querySelectorAll('#tpDots button'), function (b, k) {
      b.setAttribute('aria-current', k === cur ? 'true' : 'false');
    });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() {
    stop();
    if (paused || slides.length < 2) return;
    timer = setInterval(function () { show(cur + 1); }, interval);
  }
  function setPaused(p) {
    paused = p;
    var b = $('#tpPause');
    b.setAttribute('aria-pressed', String(p));
    b.setAttribute('aria-label', p ? '自動で切り替える' : '自動で切り替えを止める');
    b.firstElementChild.textContent = p ? '▶' : 'Ⅱ';
    start();
  }

  function build(data) {
    var first = $('#tpSlides .tp-hero__img');
    var list = (data && data.slides) || [];
    if (list.length < 2) return;                 // 1枚だけなら今までどおり静止画
    interval = data.intervalMs || interval;

    slides = list.map(function (s, k) {
      var el = k === 0 ? first : null;
      return { id: s.id, label: s.label || '', alt: s.alt || '', place: s.place || [], image: s.image, pos: s.pos, posD: s.posD, el: el };
    });
    // 1枚目はHTMLのまま。2枚目以降は、ページの読み込みが終わってから作る（表紙の表示を遅らせないため）
    slides.forEach(function (s, k) {
      if (k === 0) return;
      var img = document.createElement('img');
      img.className = 'tp-hero__img';
      img.alt = s.alt; img.width = 1600; img.height = 900;
      img.decoding = 'async';
      if (s.pos) img.style.setProperty('--pos', s.pos);
      if (s.posD) img.style.setProperty('--posd', s.posD);
      img.src = s.image;
      $('#tpSlides').appendChild(img);
      s.el = img;
    });

    $('#tpDots').innerHTML = slides.map(function (s, k) {
      return '<button type="button" data-i="' + k + '" aria-label="' + (k + 1) + '枚目：' + esc(s.label) + '"' +
        ' aria-current="' + (k === 0 ? 'true' : 'false') + '"></button>';
    }).join('');
    $('#tpCtrl').hidden = false;

    $('#tpPrev').addEventListener('click', function () { show(cur - 1, true); start(); });
    $('#tpNext').addEventListener('click', function () { show(cur + 1, true); start(); });
    $('#tpDots').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (b) { show(parseInt(b.getAttribute('data-i'), 10), true); start(); }
    });
    $('#tpPause').addEventListener('click', function () { setPaused(!paused); });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    // キーボードで操作しているあいだは自動で切り替えない
    $('#tpCtrl').addEventListener('focusin', stop);
    $('#tpCtrl').addEventListener('focusout', start);

    setPaused(paused);
    show(0);
  }

  function init() {
    fetch('data/hero-slides.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(build)
      .catch(function () { /* 読めない場合は、HTMLに書いた1枚目の静止画のまま */ });
  }

  // 表紙の1枚目の表示を優先し、2枚目以降は読み込み完了後に用意する
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
