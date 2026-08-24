/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  photo.js
   写真詳細ページ：利用規約の同意 → クレジット付きダウンロード
   画像はブラウザ内（canvas）で加工するため、サーバー側の処理は不要です。
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

  /* =====================================================================
     クレジットの焼き込み
     元画像を canvas に描き、右下に「© 志賀町」を重ねて JPEG を書き出します。
     ===================================================================== */
  function stampCredit(img, credit) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // 画像の長辺に対する比率でサイズを決め、どの解像度でも同じ見え方にする
    var base   = Math.max(w, h);
    var size   = Math.max(14, Math.round(base * 0.022));
    var margin = Math.round(base * 0.022);

    ctx.font = '500 ' + size + 'px "Noto Sans JP", "Hiragino Sans", sans-serif';
    ctx.textAlign = 'right';

    var x = w - margin, y = h - margin;
    var tw = ctx.measureText(credit).width;

    // 枠は付けず、文字だけを写真に重ねる。読みやすさは、文字が乗る場所の
    // 明るさを測って白文字／黒文字を自動で切り替えることで確保する。
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
    } catch (e) { /* 測れない場合は白文字のまま（従来どおり） */ }

    ctx.textBaseline = 'alphabetic';
    // 縁取りを薄く入れて、背景の明るさが混ざる場所でも読みやすくする
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, size * 0.1);
    ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.45)';
    ctx.strokeText(credit, x, y);
    ctx.fillStyle = isLight ? 'rgba(20, 20, 20, 0.92)' : 'rgba(255, 255, 255, 0.94)';
    ctx.fillText(credit, x, y);

    return cv;
  }

  /* ダウンロード回数をGoogleアナリティクス（GA4）に記録する */
  function trackDownload(filename) {
    if (typeof gtag !== 'function') return;
    var photoId = (location.pathname.match(/P\d+/) || [])[0] || '';
    gtag('event', 'photo_download', { photo_id: photoId, file_name: filename });
  }

  /* ブラウザに保存させる */
  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* クレジットを付けずに元画像をそのまま保存する（フォールバック） */
  function saveOriginal(src, filename) {
    var a = document.createElement('a');
    a.href = src; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    trackDownload(filename);
  }

  function download(cv, filename) {
    return new Promise(function (resolve, reject) {
      try {
        cv.toBlob(function (blob) {
          if (!blob) { reject(new Error('画像を生成できませんでした')); return; }
          saveBlob(blob, filename);
          trackDownload(filename);
          resolve();
        }, 'image/jpeg', 0.92);
      } catch (e) {
        // ファイルを直接開いている（file://）場合、ブラウザの制限で
        // canvas から画像を書き出せない。公開後は正常に動作する。
        reject(e);
      }
    });
  }

  function initDownload() {
    var btn = $('#dlBtn');
    if (!btn) return;
    var modal = $('#termsModal');
    var check = $('#agreeCheck');
    var start = $('#startDl');
    var omitCredit = $('#omitCredit');
    var langRadios = $$('input[name="creditLang"]');
    var src      = btn.dataset.src;
    var creditJa = btn.dataset.creditJa || '© 志賀町';
    var creditEn = btn.dataset.creditEn || '© Shika Town';
    var name     = btn.dataset.filename || 'photo.jpg';

    var open  = function () {
      check.checked = false; start.disabled = true;
      if (omitCredit) omitCredit.checked = false;
      modal.classList.add('is-open'); document.body.style.overflow = 'hidden';
    };
    var close = function () {
      modal.classList.remove('is-open'); document.body.style.overflow = '';
    };

    btn.addEventListener('click', open);
    $('#cancelDl').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    check.addEventListener('change', function () { start.disabled = !check.checked; });
    // クレジット省略にチェックが入っている間は、言語の選択に意味が無いため触れなくする
    if (omitCredit) {
      omitCredit.addEventListener('change', function () {
        langRadios.forEach(function (r) { r.disabled = omitCredit.checked; });
      });
    }

    start.addEventListener('click', function () {
      if (!check.checked) return;
      close();
      btn.disabled = true;
      var label = btn.querySelector('span');
      var before = label.textContent;
      var done = function () { btn.disabled = false; label.textContent = before; };

      if (omitCredit && omitCredit.checked) {
        // 許可済み利用者向け：クレジットを合成せず、元画像をそのまま保存する
        label.textContent = '書き出しています…';
        saveOriginal(src, name);
        done();
        return;
      }

      var lang = (document.querySelector('input[name="creditLang"]:checked') || {}).value || 'ja';
      var credit = lang === 'en' ? creditEn : creditJa;
      label.textContent = '書き出しています…';

      var isFile = (location.protocol === 'file:');
      var img = new Image();
      if (!isFile) img.crossOrigin = 'anonymous';
      img.onload = function () {
        if (isFile) {
          // ファイルを直接開いている（file://）ときは、ブラウザの制限で
          // クレジットの合成ができない。公開後は正常に動作する。
          alert('ファイルを直接開いているため、クレジットの合成ができません。\n\n'
              + 'ウェブに公開した状態では、右下に「' + credit + '」が入った画像が保存されます。\n\n'
              + 'このあと元の画像を別タブで開きます。中身を確認したい場合は、'
              + 'その画像を右クリックして保存してください。');
          window.open(src, '_blank');
          done(); return;
        }
        download(stampCredit(img, credit), name)
          .catch(function (err) {
            console.error(err);
            saveOriginal(src, name);
            alert('クレジットの合成ができなかったため、元画像を保存しました。');
          })
          .then(done);
      };
      img.onerror = function () {
        btn.disabled = false; label.textContent = before;
        alert('画像を読み込めませんでした。ページを再読み込みしてお試しください。');
      };
      img.src = src;
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

  /* ---------- シェア：Instagramはリンクをコピーするだけ（直接投稿する仕組みが無いため） ---------- */
  function initShareCopy() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.sharebtn--instagram');
      if (!b) return;
      var url = b.dataset.copyUrl || '';
      var done = function () {
        b.classList.add('is-done');
        setTimeout(function () { b.classList.remove('is-done'); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt('コピーしてInstagramに貼り付けてください', url); });
      } else {
        window.prompt('コピーしてInstagramに貼り付けてください', url);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCopy();
    initDrawer();
    initDownload();
    initShareCopy();
  });
})();
