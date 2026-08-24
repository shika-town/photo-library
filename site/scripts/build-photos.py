# -*- coding: utf-8 -*-
"""data/library.json から photos/ 配下の写真詳細ページを生成します。

  使い方:  python3 scripts/build-photos.py     ← site フォルダ直下で実行
           （先に build-library.py を実行してください）
"""
import json, io, os, html, urllib.parse, importlib.util

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 共通パーツ（ヘッダー・フッター・アイコン）を build-spots.py から借りる
spec = importlib.util.spec_from_file_location('bs', os.path.join(BASE, 'scripts', 'build-spots.py'))
_prev = os.getcwd()
os.chdir(BASE)
bs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bs)          # ← spots も同時に再生成される
os.chdir(_prev)

E = bs.E
LIB = json.load(io.open(os.path.join(BASE, 'data', 'library.json'), encoding='utf-8'))
PHOTOS = LIB['photos']
SPOTS = {s['id']: s for s in bs.SPOTS}
OUT = os.path.join(BASE, 'photos')
os.makedirs(OUT, exist_ok=True)

TERMS = [
 '掲載写真の著作権は志賀町に帰属します。',
 '観光PR・報道・教育・研究など、志賀町の魅力を紹介する目的でご利用いただけます。',
 'ダウンロードした画像には右下に「© 志賀町」のクレジットが入ります。クレジットの削除・改変はご遠慮ください。',
 '商用利用、および画像の内容を大きく変える加工を行う場合は、事前にご相談ください。',
 '公序良俗に反する用途、志賀町の名誉を損なう用途での使用は固くお断りします。',
 '人物が写り込んでいる写真の利用にあたっては、肖像権にご配慮ください。',
]

def photo_card(p):
    tags = ''.join('<span class="tag">#%s</span>' % E(t) for t in p['tags'][:3])
    return '''<a class="photo-card" href="%s.html">
  <div class="photo-card__media"><img src="../%s" alt="%s" loading="lazy" width="640" height="480"></div>
  <div class="photo-card__body">
    <h3 class="photo-card__title">%s</h3>
    <p class="photo-card__area"><svg><use href="#i-pin"/></svg>%s</p>
    <div class="photo-card__tags">%s</div>
  </div>
</a>''' % (E(p['id']), E(p['thumb']), E(p['alt']), E(p['title']), E(p['area']), tags)


for i, p in enumerate(PHOTOS):
    # 関連写真：同じスポットの他の写真を優先し、足りなければ同じエリアから補う
    same = [q for q in PHOTOS if q['spotId'] == p['spotId'] and q['id'] != p['id']]
    if len(same) < 4:
        same += [q for q in PHOTOS if q['area'] == p['area'] and q['id'] != p['id'] and q not in same]
    related = same[:4]

    sp = SPOTS.get(p['spotId'])
    spot_link = ('<a href="../spots/%s.html">%s</a>' % (E(p['spotId']), E(p['spot']))) if sp else E(p['spot'])

    rows = [('スポット', spot_link), ('エリア', E(p['area']))]
    if p.get('season'):
        rows.append(('季節', E(p['season'])))
    rows.append(('撮影・提供', E(p['photographer'])))
    rows.append(('クレジット', E(p['credit'])))
    rows_html = ''.join(
        '<div class="photometa__row"><p class="photometa__label">%s</p><p class="photometa__value">%s</p></div>' % (a, b)
        for a, b in rows)
    # タグは自由文検索（q=）ではなく、そのタグが実際に付いている写真だけに絞り込む
    # 専用パラメータ（tag=）にリンクする（タイトルやスポット名にたまたま同じ文字が
    # 含まれる無関係な写真まで拾ってしまうのを防ぐため）。
    tags_html = ''.join('<a class="tag" href="../search.html?tag=%s">#%s</a>'
                        % (urllib.parse.quote(t), E(t)) for t in p['tags'])

    terms_html = ''.join('<li>・%s</li>' % E(t) for t in TERMS)
    fname = '%s_%s.jpg' % (p['id'], p['spotId'] or 'shika')

    ld = json.dumps({
        "@context": "https://schema.org", "@type": "ImageObject",
        "name": p['title'], "contentUrl": '../' + p['large'],
        "creditText": p['credit'], "copyrightHolder": {"@type": "GovernmentOrganization", "name": "志賀町"},
        "contentLocation": {"@type": "Place", "name": p['spot']}, "inLanguage": "ja"
    }, ensure_ascii=False)

    page = bs.head('%s｜%s' % (p['title'], bs.SITE),
                   '%s（%s／%s）の写真。志賀町公式フォトライブラリーで、クレジット付きでダウンロードできます。'
                   % (p['title'], p['spot'], p['area']),
                   '../' + p['large'], './%s.html' % p['id'])
    page += '<script type="application/ld+json">%s</script>\n</head>\n<body>\n' % ld
    page += bs.SPRITE + '\n<a href="#main" class="sr-only">本文へスキップ</a>\n' + bs.header('写真から探す')
    page += '''
<main id="main">
  <nav class="breadcrumb container" aria-label="パンくずリスト">
    <ol>
      <li><a href="../index.html">HOME</a></li>
      <li><a href="../search.html">写真から探す</a></li>
      %s
      <li>%s</li>
    </ol>
  </nav>

  <section class="photoview">
    <div class="container photoview__grid">
      <div class="photoview__stage">
        <img src="../%s" alt="%s" width="1400" height="1050" fetchpriority="high">
      </div>

      <div class="photometa">
        <p class="photometa__eyebrow">%s</p>
        <h1 class="photometa__title">%s</h1>

        <div class="photometa__rows">%s
          <div class="photometa__row">
            <p class="photometa__label">タグ</p>
            <div class="photometa__tags">%s</div>
          </div>
        </div>

        <button class="dlbtn" id="dlBtn" type="button"
                data-src="../%s" data-credit-ja="© 志賀町" data-credit-en="© Shika Town" data-filename="%s">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>
          <span>この写真をダウンロード</span>
        </button>
        <p class="dlnote">
          ダウンロードした画像には、右下にクレジットが入ります（下の確認画面で日本語／英語を選べます）。<br>
          ご利用の前に<a href="../terms.html">利用規約</a>への同意が必要です。
        </p>
      </div>
    </div>
  </section>

  <section class="related">
    <div class="container">
      <div class="section__head">
        <div>
          <span class="section__eyebrow">RELATED</span>
          <h2 class="section__title">関連する写真</h2>
        </div>
        %s
      </div>
      <div class="photo-grid">%s</div>
    </div>
  </section>
</main>

<div class="modal" id="termsModal" role="dialog" aria-modal="true" aria-labelledby="termsTitle">
  <div class="modal__panel">
    <h2 class="modal__title" id="termsTitle">写真の利用規約</h2>
    <ul class="modal__terms">%s</ul>
    <div class="modal__lang">
      <span class="modal__lang-label">クレジット表記</span>
      <label class="modal__lang-opt"><input type="radio" name="creditLang" value="ja" checked> 日本語（© 志賀町）</label>
      <label class="modal__lang-opt"><input type="radio" name="creditLang" value="en"> English（© Shika Town）</label>
    </div>
    <label class="modal__check">
      <input type="checkbox" id="agreeCheck">
      <span>利用規約に同意します</span>
    </label>
    <div class="modal__actions">
      <button class="modal__btn modal__btn--ghost" id="cancelDl" type="button">キャンセル</button>
      <button class="modal__btn modal__btn--primary" id="startDl" type="button" disabled>同意してダウンロード</button>
    </div>
  </div>
</div>
''' % (('<li><a href="../spots/%s.html">%s</a></li>' % (E(p['spotId']), E(p['spot']))) if sp else '',
       E(p['title']), E(p['large']), E(p['alt']), E(p['id']), E(p['title']), rows_html, tags_html,
       E(p['large']), E(fname),
       ('<a class="section__more" href="../spots/%s.html">%sをすべて見る <svg><use href="#i-arrow"/></svg></a>'
        % (E(p['spotId']), E(p['spot']))) if sp else '',
       ''.join(photo_card(q) for q in related),
       terms_html)

    page += bs.footer(js='photo.js')
    io.open(os.path.join(OUT, '%s.html' % p['id']), 'w', encoding='utf-8').write(page)

# 使われなくなった古いページを片付ける（写真を削除したときに残るため）
_keep = {'%s.html' % p['id'] for p in PHOTOS}
_stale = [f for f in os.listdir(OUT) if f.endswith('.html') and f not in _keep]
_removed, _left = 0, []
for f in _stale:
    try:
        os.remove(os.path.join(OUT, f)); _removed += 1
    except OSError:
        _left.append(f)
if _removed:
    print('  古いページを %d件 削除しました。' % _removed)
if _left:
    print('  ！ 古いページが %d件 残っています（手動で削除してください）: %s'
          % (len(_left), ', '.join(sorted(_left)[:5]) + (' …' if len(_left) > 5 else '')))

print('photos/: %d ページを生成しました。' % len(PHOTOS))
