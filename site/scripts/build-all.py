# -*- coding: utf-8 -*-
"""サイト全体を正しい順番で再生成します。

  使い方:  python3 scripts/build-all.py     ← site フォルダ直下で実行

  1. build-data.py     photos.json  → assets/js/data.js
  2. build-library.py  photos.json + spots.json → data/library.json
  3. build-spots.py    spots.json   → spots/*.html
  4. build-photos.py   library.json → photos/*.html
  5. build-search.py                → search.html
  6. build-pages.py                 → terms/privacy/credit/faq/404.html
  7. build-seo.py                   → robots.txt / sitemap.xml
"""
import subprocess, sys, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEPS = ['build-data.py', 'build-library.py', 'build-spots.py', 'build-photos.py',
         'build-search.py', 'build-pages.py', 'build-seo.py']

for name in STEPS:
    print('\n── %s ' % name + '─' * (46 - len(name)))
    r = subprocess.run([sys.executable, os.path.join('scripts', name)], cwd=BASE)
    if r.returncode != 0:
        print('！ %s で失敗しました。' % name); sys.exit(1)
print('\nすべて生成しました。')
