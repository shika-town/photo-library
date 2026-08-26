# -*- coding: utf-8 -*-
"""あとで見るリスト favorites.html を生成します。

  使い方:  python3 scripts/build-favorites.py     ← site フォルダ直下で実行
"""
import io, os, importlib.util

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('bs', os.path.join(BASE, 'scripts', 'build-spots.py'))
cwd = os.getcwd(); os.chdir(BASE)
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
os.chdir(cwd)

PRE = ''   # サイト直下

TERMS = [
 '掲載写真の著作権は志賀町に帰属します。',
 '観光PR・報道・教育・研究など、志賀町の魅力を紹介する目的でご利用いただけます。',
 'ダウンロードした画像には右下に「© 志賀町」のクレジットが入ります。クレジットの削除・改変はご遠慮ください'
 '（志賀町から利用の許可を得ている場合は、下の選択肢からクレジットを省略できます）。',
 '商用利用、および画像の内容を大きく変える加工を行う場合は、事前にご相談ください。',
 '公序良俗に反する用途、志賀町の名誉を損なう用途での使用は固くお断りします。',
 '人物が写り込んでいる写真の利用にあたっては、肖像権にご配慮ください。',
]
TERMS_HTML = ''.join('<li>・%s</li>' % t for t in TERMS)

page = bs.head('あとで見るリスト｜SHIKA PHOTO LIBRARY',
               'ハートを付けた写真だけを、このブラウザに保存して一覧できます。',
               'assets/img/ogp.jpg', './favorites.html', pre=PRE)
page += '</head>\n<body>\n' + bs.SPRITE + '\n<a href="#main" class="sr-only">本文へスキップ</a>\n'
page += bs.header('favorites', pre=PRE)
page += '''
<main id="main">
  <nav class="breadcrumb container" aria-label="パンくずリスト">
    <ol>
      <li><a href="index.html">HOME</a></li>
      <li>あとで見るリスト</li>
    </ol>
  </nav>

  <section class="searchpage">
    <div class="container">
      <div class="pagehead">
        <span class="pagehead__eyebrow">FAVORITES</span>
        <h1 class="pagehead__title">あとで見るリスト</h1>
        <p class="pagehead__lead">
          写真カードの<svg style="width:14px;height:14px;vertical-align:-2px;"><use href="#i-heart"/></svg>ハートで追加した写真が並びます。
          このブラウザだけに保存され、サーバーには送られません。
        </p>
      </div>

      <div class="searchmeta">
        <p class="searchmeta__count" id="favCount">読み込んでいます…</p>
        <div style="display:flex;align-items:center;gap:18px;">
          <button class="dlbtn" id="bulkDlBtn" type="button" style="width:auto;margin-top:0;padding:11px 18px;" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
            <span>まとめてダウンロード（ZIP）</span>
          </button>
          <button class="searchmeta__reset" id="clearFav" type="button" hidden>全部削除する</button>
        </div>
      </div>

      <div class="photo-grid" id="photoGrid"></div>
      <p class="results__empty" id="noResult" hidden>
        まだ「あとで見る」に追加した写真がありません。<br>
        写真カードの右上のハートを押すと、ここに追加されます。
      </p>
    </div>
  </section>
</main>

<div class="modal" id="bulkDlModal" role="dialog" aria-modal="true" aria-labelledby="bulkDlTitle">
  <div class="modal__panel">
    <h2 class="modal__title" id="bulkDlTitle">写真の利用規約</h2>
    <ul class="modal__terms">%(terms)s</ul>
    <div class="modal__lang">
      <span class="modal__lang-label">クレジット表記</span>
      <label class="modal__lang-opt"><input type="radio" name="bulkCreditLang" value="ja" checked> 日本語（© 志賀町）</label>
      <label class="modal__lang-opt"><input type="radio" name="bulkCreditLang" value="en"> English（© Shika Town）</label>
      <label class="modal__lang-opt modal__lang-opt--omit">
        <input type="checkbox" id="bulkOmitCredit">
        クレジット表記を省略する（志賀町から利用の許可を得ている場合のみ）
      </label>
    </div>
    <label class="modal__check">
      <input type="checkbox" id="bulkAgreeCheck">
      <span>利用規約に同意します</span>
    </label>
    <p class="hint" id="bulkDlStatus" style="display:none;margin-top:14px;"></p>
    <div class="modal__actions">
      <button class="modal__btn modal__btn--ghost" id="bulkCancelDl" type="button">キャンセル</button>
      <button class="modal__btn modal__btn--primary" id="bulkStartDl" type="button" disabled>同意してダウンロード</button>
    </div>
  </div>
</div>
''' % {'terms': TERMS_HTML}
page += bs.footer(pre=PRE, js='favorites.js').replace(
    '<script src="assets/js/favorites.js"></script>',
    '<script src="assets/js/library-data.js"></script>\n'
    '<script src="assets/js/zip-writer.js"></script>\n'
    '<script src="assets/js/favorites.js"></script>')

io.open(os.path.join(BASE, 'favorites.html'), 'w', encoding='utf-8').write(page)
print('favorites.html を生成しました')
