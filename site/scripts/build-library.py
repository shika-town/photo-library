# -*- coding: utf-8 -*-
"""photos.json（TOP）と spots.json（スポット）から、全写真の統一索引 data/library.json を生成します。

  使い方:  python3 scripts/build-library.py     ← site フォルダ直下で実行

このファイルが写真詳細ページと検索結果ページのデータ源になります。
"""
import json, io, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
top   = json.load(io.open(os.path.join(BASE, 'data', 'photos.json'), encoding='utf-8'))
spots = json.load(io.open(os.path.join(BASE, 'data', 'spots.json'), encoding='utf-8'))

SPOT_BY_NAME = {s['name']: s for s in spots['spots']}
norm = lambda p: re.sub(r'^\.\./', '', p)      # '../assets/...' → 'assets/...'

photos, n = [], 0
_seen = set()
def add(_id=None, **kw):
    """IDはシート由来の値をそのまま使う。写真が増減してもページのURLが変わらない。"""
    global n
    if _id and str(_id).strip():
        kw['id'] = str(_id).strip()
    else:
        n += 1
        while 'P%04d' % n in _seen:
            n += 1
        kw['id'] = 'P%04d' % n
    # トップの新着写真は、スポットのギャラリーにも同じ写真が入っている（同じ1枚）。
    # 同じIDが来たら1件にまとめ、ギャラリー側の画像（thumb / large）を優先して使う。
    if kw['id'] in _seen:
        prev = next(x for x in photos if x['id'] == kw['id'])
        if kw.get('thumb') != kw.get('large'):      # ギャラリー由来のほうが情報が多い
            prev['thumb'] = kw['thumb']; prev['large'] = kw['large']
        if not prev.get('spotId') and kw.get('spotId'):
            prev['spotId'] = kw['spotId']; prev['spot'] = kw['spot']; prev['area'] = kw['area']
        return
    _seen.add(kw['id'])
    photos.append(kw)

# ---- TOP の新着写真 ----
# ここを先頭に置くことで、photos.json 側の id（P0001…）と採番が一致します。
# TOPの写真カードはこの id をそのまま写真詳細ページのURLに使うため、順番を変えないでください。
for p in top['photos']:
    sp = SPOT_BY_NAME.get(p['spot'])
    add(_id=p.get('id'), title=p['title'], spot=p['spot'], spotId=(sp['id'] if sp else None),
        area=p['area'], season=p.get('season', ''), tags=p.get('tags', []),
        thumb=norm(p['image']), large=norm(p['image']),
        alt=p.get('alt', p['title']), credit='© 志賀町', photographer='志賀町',
        source='新着写真')

# ---- 各スポットのギャラリー ----
for s in spots['spots']:
    for ph in s['photos']:
        # 必ず写真自身のタグだけを使う。タグが空の写真は「タグなし」のままにする
        # （スポットの代表タグで埋めると、未タグ付けの写真にも無関係なタグが
        #   ついてしまい、今回のバグと同じ状態を再発させるため）。
        add(_id=ph.get('id'), title=ph['caption'], spot=s['name'], spotId=s['id'], area=s['area'],
            season='', tags=ph.get('tags', []), thumb=norm(ph['thumb']), large=norm(ph['large']),
            alt=ph['caption'], credit='© 志賀町', photographer='志賀町',
            source=s['name'])

data = {
    'meta': {
        'note': 'photos.json と spots.json から自動生成しています。直接編集せず、scripts/build-library.py を実行してください。',
        'count': len(photos)
    },
    'photos': photos
}
json.dump(data, io.open(os.path.join(BASE, 'data', 'library.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=2)

# file:// 用の埋め込みコピー
io.open(os.path.join(BASE, 'assets', 'js', 'library-data.js'), 'w', encoding='utf-8').write(
    '/* 自動生成: data/library.json の埋め込みコピー（file:// 用フォールバック）。\n'
    '   scripts/build-library.py で再生成してください。 */\n'
    'window.SPL_LIBRARY = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

print('library.json: %d枚' % len(photos))
for s in spots['spots']:
    print('  %-28s %d枚' % (s['name'], sum(1 for p in photos if p['spotId'] == s['id'])))
