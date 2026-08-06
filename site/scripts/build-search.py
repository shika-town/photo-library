# -*- coding: utf-8 -*-
"""検索結果ページ search.html を生成します。

  使い方:  python3 scripts/build-search.py     ← site フォルダ直下で実行
"""
import io, os, importlib.util

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('bs', os.path.join(BASE, 'scripts', 'build-spots.py'))
cwd = os.getcwd(); os.chdir(BASE)
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
os.chdir(cwd)

PRE = ''   # サイト直下

page = bs.head('写真から探す｜SHIKA PHOTO LIBRARY',
               '志賀町の観光写真を、スポット・エリア・タグ・季節から検索できます。',
               'assets/img/ogp.jpg', './search.html', pre=PRE)
page += '</head>\n<body>\n' + bs.SPRITE + '\n<a href="#main" class="sr-only">本文へスキップ</a>\n'
page += bs.header('写真から探す', pre=PRE)
page += '''
<main id="main">
  <nav class="breadcrumb container" aria-label="パンくずリスト">
    <ol>
      <li><a href="index.html">HOME</a></li>
      <li>写真から探す</li>
    </ol>
  </nav>

  <section class="searchpage">
    <div class="container">
      <div class="pagehead">
        <span class="pagehead__eyebrow">PHOTOS</span>
        <h1 class="pagehead__title" id="searchTitle">写真から探す</h1>
        <p class="pagehead__lead">スポット名・エリア・タグ・季節で検索できます。</p>
      </div>

      <form class="searchbox" id="searchForm" role="search">
        <span class="searchbox__icon"><svg><use href="#i-search"/></svg></span>
        <label class="sr-only" for="searchInput">写真・スポット・タグで検索</label>
        <input class="searchbox__input" id="searchInput" type="search" placeholder="写真・スポット・タグで検索" autocomplete="off">
        <button class="searchbox__btn" type="submit">検索</button>
      </form>

      <div class="filters" id="areaFilters"></div>

      <div class="searchmeta">
        <p class="searchmeta__count" id="searchCount">読み込んでいます…</p>
        <a class="searchmeta__reset" id="resetLink" href="search.html" hidden>検索条件をクリア</a>
      </div>

      <div class="photo-grid" id="photoGrid"></div>
      <p class="results__empty" id="noResult" hidden>条件に一致する写真が見つかりませんでした。<br>キーワードを変えてお試しください。</p>

      <nav class="pager" id="pager" aria-label="ページ送り"></nav>
    </div>
  </section>
</main>
'''
page += bs.footer(pre=PRE, js='search.js').replace(
    '<script src="assets/js/search.js"></script>',
    '<script src="assets/js/library-data.js"></script>\n<script src="assets/js/search.js"></script>')

io.open(os.path.join(BASE, 'search.html'), 'w', encoding='utf-8').write(page)
print('search.html を生成しました')
