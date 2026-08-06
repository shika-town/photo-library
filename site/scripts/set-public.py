# -*- coding: utf-8 -*-
"""テスト公開 ↔ 本公開 を切り替えます。

  テスト公開にする:  python3 scripts/set-public.py test
  本公開にする    :  python3 scripts/set-public.py live
  URLを変える     :  python3 scripts/set-public.py live https://photo.town.shika.lg.jp/

切り替えたあとは python3 scripts/build-all.py を実行してください。
"""
import json, io, os, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(BASE, 'data', 'site-config.json')
cfg  = json.load(io.open(path, encoding='utf-8'))

mode = (sys.argv[1] if len(sys.argv) > 1 else '').lower()
if mode not in ('test', 'live'):
    print(__doc__); sys.exit(1)
if len(sys.argv) > 2:
    cfg['baseUrl'] = sys.argv[2].rstrip('/') + '/'
cfg['noindex'] = (mode == 'test')
json.dump(cfg, io.open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

print('%s に切り替えました。' % ('テスト公開（検索エンジンに載せない）' if cfg['noindex'] else '本公開（検索エンジンに載せる）'))
print('  公開URL: %s' % cfg['baseUrl'])
print('\n続けて次を実行してください:')
print('  python3 scripts/build-all.py')
