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
    ctx.textBaseline = 'alphabetic';

    var x = w - margin, y = h - margin;
    var tw = ctx.measureText(credit).width;
    var padX = size * 0.6, padY = size * 0.42;

    // 明るい写真でも読めるよう、半透明の黒帯を敷く
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    var rx = x - tw - padX, ry = y - size - padY, rw = tw + padX * 2, rh = size + padY * 2;
    var r = Math.round(size * 0.28);
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    // バッジの幾何中心（ry + rh/2）に文字の視覚中心を合わせるため middle ベースラインで描画
    ctx.textBaseline = 'middle';
    ctx.fillText(credit, x - padX, ry + rh / 2);

    return cv;
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
  }

  function download(cv, filename) {
    return new Promise(function (resolve, reject) {
      try {
        cv.toBlob(function (blob) {
          if (!blob) { reject(new Error('画像を生成できませんでした')); return; }
          saveBlob(blob, filename);
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
    var src    = btn.dataset.src;
    var credit = btn.dataset.credit || '© 志賀町';
    var name   = btn.dataset.filename || 'photo.jpg';

    var open  = function () {
      check.checked = false; start.disabled = true;
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

    start.addEventListener('click', function () {
      if (!check.checked) return;
      close();
      btn.disabled = true;
      var label = btn.querySelector('span');
      var before = label.textContent;
      label.textContent = '書き出しています…';

      var isFile = (location.protocol === 'file:');
      var img = new Image();
      if (!isFile) img.crossOrigin = 'anonymous';
      img.onload = function () {
        var done = function () { btn.disabled = false; label.textContent = before; };
        if (isFile) {
          // ファイルを直接開いている（file://）ときは、ブラウザの制限で
          // クレジットの合成ができない。公開後は正常に動作する。
          alert('ファイルを直接開いているため、クレジットの合成ができません。\n\n'
              + 'ウェブに公開した状態では、右下に「© 志賀町」が入った画像が保存されます。\n\n'
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

  document.addEventListener('DOMContentLoaded', function () {
    initCopy();
    initDrawer();
    initDownload();
  });
})();
