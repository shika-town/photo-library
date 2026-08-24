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
        <button class="searchmeta__reset" id="clearFav" type="button" hidden>全部削除する</button>
      </div>

      <div class="photo-grid" id="photoGrid"></div>
      <p class="results__empty" id="noResult" hidden>
        まだ「あとで見る」に追加した写真がありません。<br>
        写真カードの右上のハートを押すと、ここに追加されます。
      </p>
    </div>
  </section>
</main>
'''
page += bs.footer(pre=PRE, js='favorites.js').replace(
    '<script src="assets/js/favorites.js"></script>',
    '<script src="assets/js/library-data.js"></script>\n<script src="assets/js/favorites.js"></script>')

io.open(os.path.join(BASE, 'favorites.html'), 'w', encoding='utf-8').write(page)
print('favorites.html を生成しました')
