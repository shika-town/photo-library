/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  spots.js
   スポット一覧のエリア絞り込み／スポット詳細のライトボックス／モバイルメニュー
   ===================================================================== */
(function () {
  'use strict';
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- モバイルメニュー ---------- */
  function initDrawer() {
    var dr = $('#drawer'), btn = $('#btnBurger');
    if (!dr || !btn) return;
    var open  = function () { dr.classList.add('is-open');    btn.setAttribute('aria-expanded', 'true'); };
    var close = function () { dr.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', open);
    $('#drawerClose').addEventListener('click', close);
    dr.addEventListener('click', function (e) { if (e.target === dr) close(); });
    $$('.drawer__link', dr).forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* ---------- エリア絞り込み ---------- */
  function initFilters() {
    var wrap = $('#areaFilters');
    if (!wrap) return;
    var cards = $$('#spotGrid .spot-card');
    var empty = $('#noResult');

    wrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn) return;
      var area = btn.dataset.area;
      $$('.filter', wrap).forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      var shown = 0;
      cards.forEach(function (c) {
        var hit = (area === 'all' || c.dataset.area === area);
        c.classList.toggle('is-hidden', !hit);
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ---------- ライトボックス ---------- */
  function initLightbox() {
    var box = $('#lightbox');
    var grid = $('#gallery');
    if (!box || !grid) return;

    var items = $$('.gallery__item', grid);
    var img = $('#lbImg'), cap = $('#lbCap'), count = $('#lbCount');
    var cur = 0, lastFocus = null;

    function show(i) {
      cur = (i + items.length) % items.length;
      var el = items[cur];
      img.src = el.dataset.large;
      img.alt = el.dataset.caption || '';
      cap.textContent = el.dataset.caption || '';
      count.textContent = (cur + 1) + ' / ' + items.length;
      var link = $('#lbLink');
      if (link) {
        if (el.dataset.photo) { link.href = '../photos/' + el.dataset.photo + '.html'; link.hidden = false; }
        else { link.hidden = true; }
      }
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      box.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      $('#lbClose').focus();
    }
    function close() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }

    items.forEach(function (el, i) {
      el.addEventListener('click', function () { open(i); });
    });
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', function () { show(cur - 1); });
    $('#lbNext').addEventListener('click', function () { show(cur + 1); });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lightbox__stage')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('is-open')) return;
      if (e.key === 'Escape')     { close(); }
      if (e.key === 'ArrowLeft')  { show(cur - 1); }
      if (e.key === 'ArrowRight') { show(cur + 1); }
    });

    // スワイプ（モバイル）
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) { show(cur + (dx < 0 ? 1 : -1)); }
      x0 = null;
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDrawer();
    initFilters();
    initLightbox();
  });
})();
