# -*- coding: utf-8 -*-
"""search.html（転送ページ）を生成します。

検索結果ページは廃止し、検索はトップページの「写真を、見つける。」に集約しました。
古いURL（?q= / ?tag= / ?genre= / ?season= など）や外部リンクが切れないよう、
パラメーターを引き継いでトップへ転送するだけのページを置いています。

  使い方:  python3 scripts/build-search.py     ← site フォルダ直下で実行
"""
import io, os, importlib.util

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('bs', os.path.join(BASE, 'scripts', 'build-spots.py'))
cwd = os.getcwd(); os.chdir(BASE)
bs = importlib.util.module_from_spec(spec); spec.loader.exec_module(bs)
os.chdir(cwd)

io.open(os.path.join(BASE, 'search.html'), 'w', encoding='utf-8').write(
    bs.redirect_page('index.html#find', '写真から探す｜SHIKA PHOTO LIBRARY', map_params=True))
print('search.html（転送ページ）を生成しました')
