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

  /* =====================================================================
     クレジットの焼き込み（site/assets/js/photo.js の stampCredit と同じロジック）
     ===================================================================== */
  function stampCredit(img, credit) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    var base   = Math.max(w, h);
    var size   = Math.max(14, Math.round(base * 0.022));
    var margin = Math.round(base * 0.022);

    ctx.font = '500 ' + size + 'px "Noto Sans JP", "Hiragino Sans", sans-serif';
    ctx.textAlign = 'right';

    var x = w - margin, y = h - margin;
    var tw = ctx.measureText(credit).width;

    var sampleX = Math.max(0, Math.round(x - tw - margin * 0.3));
    var sampleY = Math.max(0, Math.round(y - size - margin * 0.3));
    var sampleW = Math.min(w - sampleX, Math.round(tw + margin * 0.6));
    var sampleH = Math.min(h - sampleY, Math.round(size + margin * 0.6));
    var isLight = false;
    try {
      var data = ctx.getImageData(sampleX, sampleY, Math.max(1, sampleW), Math.max(1, sampleH)).data;
      var sum = 0, n = 0;
      for (var i = 0; i < data.length; i += 4) {
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        n++;
      }
      isLight = (sum / n) > 150;
    } catch (e) { /* 測れない場合は白文字のまま */ }

    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * 0.1);
    ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.45)';
    ctx.strokeText(credit, x, y);
    ctx.fillStyle = isLight ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.94)';
    ctx.fillText(credit, x, y);

    return cv;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (location.protocol !== 'file:') img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('画像を読み込めませんでした: ' + src)); };
      img.src = src;
    });
  }

  function canvasToBlob(cv) {
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (blob) {
        if (!blob) { reject(new Error('画像を生成できませんでした')); return; }
        resolve(blob);
      }, 'image/jpeg', 0.92);
    });
  }

  function trackDownload(photoId, filename) {
    if (typeof gtag !== 'function') return;
    gtag('event', 'photo_download', { photo_id: photoId, file_name: filename });
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
    var flag = p.restricted ? '<span class="photo-card__flag" title="ダウンロードには事前のお問い合わせが必要です">要問合せ</span>' : '';
    return '<a class="photo-card" href="photos/' + esc(p.id) + '.html">' +
      '<div class="photo-card__media"><img src="' + esc(p.thumb) + '" alt="' + esc(p.alt) +
        '" loading="lazy" width="640" height="480">' + flag + '</div>' +
      '<div class="photo-card__body">' +
        '<h3 class="photo-card__title">' + esc(p.title) + '</h3>' +
        '<p class="photo-card__area"><svg aria-hidden="true"><use href="#i-pin"/></svg>' + esc(p.area) + '</p>' +
        '<div class="photo-card__tags">' + tags + '</div>' +
      '</div></a>';
  }

  /* =====================================================================
     まとめてダウンロード：お気に入り全件にクレジットを焼き込み、
     ひとつのZIPファイル（site/assets/js/zip-writer.js）にまとめて保存する。
     ===================================================================== */
  function initBulkDownload(getList) {
    var btn = $('#bulkDlBtn');
    if (!btn || !window.SPLZip) return;
    var modal = $('#bulkDlModal');
    var check = $('#bulkAgreeCheck');
    var start = $('#bulkStartDl');
    var omitCredit = $('#bulkOmitCredit');
    var langRadios = Array.prototype.slice.call(document.querySelectorAll('input[name="bulkCreditLang"]'));
    var status = $('#bulkDlStatus');

    var open = function () {
      check.checked = false; start.disabled = true;
      omitCredit.checked = false;
      langRadios.forEach(function (r) { r.disabled = false; });
      status.style.display = 'none'; status.textContent = '';
      modal.classList.add('is-open'); document.body.style.overflow = 'hidden';
    };
    var close = function () {
      modal.classList.remove('is-open'); document.body.style.overflow = '';
    };

    btn.addEventListener('click', open);
    $('#bulkCancelDl').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
    check.addEventListener('change', function () { start.disabled = !check.checked; });
    omitCredit.addEventListener('change', function () {
      langRadios.forEach(function (r) { r.disabled = omitCredit.checked; });
    });

    start.addEventListener('click', function () {
      if (!check.checked) return;
      var list = getList();
      if (!list.length) { close(); return; }
      var omit = omitCredit.checked;
      var lang = (document.querySelector('input[name="bulkCreditLang"]:checked') || {}).value || 'ja';

      start.disabled = true; $('#bulkCancelDl').disabled = true;
      status.style.display = 'block';

      var files = [];
      var fails = [];
      var restricted = [];
      var total = list.length;

      function processOne(i) {
        if (i >= total) return Promise.resolve();
        var p = list[i];
        status.textContent = '写真を用意しています…（' + (i + 1) + ' / ' + total + '）';
        // 祭りや人物が大きく写る写真など「ダウンロード制限」が付いている写真は、
        // まとめてダウンロードの対象から外す（個別ページで問い合わせ案内を表示する）。
        if (p.restricted) {
          restricted.push(p.id);
          return processOne(i + 1);
        }
        var credit = lang === 'en' ? '© Shika Town' : (p.credit || '© 志賀町');
        var name = p.id + '_' + (p.spotId || 'shika') + '.jpg';
        var work = omit
          ? fetch(p.large).then(function (r) { return r.blob(); })
          : loadImage(p.large).then(function (img) { return canvasToBlob(stampCredit(img, credit)); });
        return work.then(function (blob) {
          files.push({ name: name, blob: blob });
          trackDownload(p.id, name);
        }).catch(function (e) {
          console.error(e);
          fails.push(p.id);
        }).then(function () { return processOne(i + 1); });
      }

      var emptyReasonMsg = null;

      processOne(0).then(function () {
        if (!files.length) {
          emptyReasonMsg = restricted.length
            ? '選択した写真はダウンロードに事前のお問い合わせが必要なため、まとめてダウンロードできませんでした。'
            : 'ダウンロードできる写真がありませんでした。';
          throw new Error(emptyReasonMsg);
        }
        status.textContent = 'ZIPファイルを作成しています…';
        return window.SPLZip.build(files);
      }).then(function (zipBlob) {
        var url = URL.createObjectURL(zipBlob);
        var a = document.createElement('a');
        a.href = url; a.download = 'あとで見るリスト_志賀町フォトライブラリー.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        close();
        var notes = [];
        if (restricted.length) notes.push(restricted.length + '件は事前のお問い合わせが必要な写真のため含まれていません（各写真のページからお問い合わせください）。');
        if (fails.length) notes.push(fails.length + '件は読み込めなかったため含まれていません。');
        if (notes.length) alert(files.length + '件をダウンロードしました。' + notes.join(' '));
      }).catch(function (e) {
        console.error(e);
        status.textContent = '';
        alert(emptyReasonMsg || 'ダウンロードに失敗しました。ページを再読み込みしてお試しください。');
      }).then(function () {
        start.disabled = false; $('#bulkCancelDl').disabled = false;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.SPLFavorites) return;

    loadLibrary().then(function (lib) {
      var byId = {};
      lib.photos.forEach(function (p) { byId[p.id] = p; });
      var currentList = [];

      function render() {
        var ids = window.SPLFavorites.getFavorites();
        currentList = ids.map(function (id) { return byId[id]; }).filter(Boolean);
        $('#favCount').textContent = currentList.length ? currentList.length + '件の写真' : '';
        $('#clearFav').hidden = !currentList.length;
        $('#bulkDlBtn').hidden = !currentList.length;
        $('#noResult').hidden = !!currentList.length;
        $('#photoGrid').innerHTML = currentList.map(card).join('');
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

      initBulkDownload(function () { return currentList; });
    }).catch(function (err) {
      console.error(err);
      $('#noResult').hidden = false;
      $('#noResult').textContent = 'データを読み込めませんでした。ローカルで確認する場合は簡易サーバーを起動してください。';
    });
  });
})();
