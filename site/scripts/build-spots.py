# -*- coding: utf-8 -*-
"""data/spots.json から spots/ 配下のHTMLを生成します。

  使い方:  python3 scripts/build-spots.py     ← site フォルダ直下で実行

生成物:
  spots/index.html   スポット一覧（エリア絞り込み付き）
  spots/<id>.html    スポット詳細（ヒーロー・説明・基本情報・写真グリッド・関連スポット）
"""
import json, io, os, html, urllib.parse

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(io.open(os.path.join(BASE, 'data', 'spots.json'), encoding='utf-8'))

# 公開設定（テスト公開のあいだは検索エンジンに載せない）
_cfg_path = os.path.join(BASE, 'data', 'site-config.json')
CONFIG  = json.load(io.open(_cfg_path, encoding='utf-8')) if os.path.exists(_cfg_path) else {}
BASE_URL = CONFIG.get('baseUrl', './')
NOINDEX  = bool(CONFIG.get('noindex', False))
ROBOTS   = '<meta name="robots" content="noindex, nofollow">\n' if NOINDEX else ''
SPOTS = DATA['spots']

# 写真詳細ページのID（library.json があれば読み込む。無ければリンクを省略）
PHOTO_ID = {}
_lib = os.path.join(BASE, 'data', 'library.json')
if os.path.exists(_lib):
    for _p in json.load(io.open(_lib, encoding='utf-8'))['photos']:
        PHOTO_ID[_p['thumb']] = _p['id']
_norm = lambda t: t.replace('../', '')
OUT = os.path.join(BASE, 'spots')
os.makedirs(OUT, exist_ok=True)

E = lambda s: html.escape(str(s), quote=True)

SITE = 'SHIKA PHOTO LIBRARY'
SITE_JA = '志賀町公式フォトライブラリー'

# Google アナリティクス（GA4）計測ID。アクセス解析・ダウンロード計測に使う。
GA_MEASUREMENT_ID = 'G-T1JHX80JS6'
GA_SNIPPET = '''<script async src="https://www.googletagmanager.com/gtag/js?id=%s"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '%s');
</script>
''' % (GA_MEASUREMENT_ID, GA_MEASUREMENT_ID)

# {p} には階層に応じた接頭辞が入る（サイト直下なら '' 、1階層下なら '../'）
NAV = [('HOME', '{p}index.html'), ('スポットから探す', '{p}spots/index.html'),
       ('写真から探す', '{p}search.html'), ('シーンで探す', '{p}index.html#scenes'),
       ('ご利用について', '{p}terms.html'), ('お問い合わせ', '{p}index.html#contact')]

SPRITE = '''<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
  <symbol id="i-camera" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.8A1.5 1.5 0 0 1 9.6 3.5h4.8a1.5 1.5 0 0 1 1.3.7L16.8 6h1.7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M16.2 16.2 21 21"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-chev-l" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></symbol>
  <symbol id="i-chev-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></symbol>
  <symbol id="i-compass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7z"/></symbol>
  <symbol id="i-instagram" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.6 7 8.4 6 8.4-6"/></symbol>
  <symbol id="i-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.7-4.35-9.3-8.1C1 10 1.5 6.5 4.4 5.1 6.7 4 9.2 4.8 12 7.4 14.8 4.8 17.3 4 19.6 5.1c2.9 1.4 3.4 4.9 1.7 7.8C18.7 16.65 12 21 12 21z"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 3h3l-6.6 7.5L22.5 21h-6.1l-4.8-6.3L5.9 21H2.9l7-8-7.6-10h6.2l4.4 5.8L18.3 3z"/></symbol>
  <symbol id="i-line" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.2 1.2c0 .3-.2 1.1 1 .6 1.2-.5 6.4-3.8 8.7-6.5C22.2 13.9 22 12.5 22 11c0-4.4-4.5-8-10-8z"/></symbol>
  <symbol id="i-facebook" viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h2.5V5.5H14C11.8 5.5 10 7.3 10 9.5V12H8v3.5h2V22h3.5v-6.5H16l.5-3.5h-3V9.8c0-.5.4-.8.9-.8z"/></symbol>
</svg>'''


def head(title, desc, ogimg, canonical, pre='../'):
    return ('''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
''' + GA_SNIPPET + '''<title>%s</title>
<meta name="description" content="%s">
<meta name="theme-color" content="#0B4F82">
<link rel="icon" href="{PRE}assets/img/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="{PRE}assets/img/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="{PRE}assets/img/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="{PRE}assets/img/apple-touch-icon.png">
<link rel="manifest" href="{PRE}site.webmanifest">
{ROBOTS}
<meta property="og:type" content="article">
<meta property="og:site_name" content="%s">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:image" content="%s">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="%s">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{PRE}assets/css/style.css">
''').replace('{PRE}', pre).replace('{ROBOTS}', ROBOTS) % (E(title), E(desc), E(SITE), E(title), E(desc), E(ogimg), E(canonical))


def header(current, pre='../'):
    nav = [(l, h.replace('{p}', pre)) for l, h in NAV]
    items = ''.join(
        '<li><a class="nav__link" href="%s"%s>%s</a></li>'
        % (E(href), ' aria-current="page"' if label == current else '', E(label))
        for label, href in nav)
    drawer = ''.join('<a class="drawer__link" href="%s">%s</a>' % (E(h), E(l)) for l, h in nav)
    drawer += '<a class="drawer__link" href="%sfavorites.html">❤ あとで見るリスト</a>' % pre
    return '''<header class="header header--solid" id="header">
  <div class="header__inner">
    <a href="{PRE}index.html" class="logo" aria-label="%s ホーム">
      <span class="logo__mark"><svg><use href="#i-camera"/></svg></span>
      <span class="logo__text">
        <span class="logo__en">SHIKA PHOTO LIBRARY</span>
        <span class="logo__ja">能登・志賀町 公式フォトライブラリー</span>
      </span>
    </a>
    <nav class="nav" aria-label="メインナビゲーション"><ul class="nav__list">%s</ul></nav>
    <a class="header__fav" href="{PRE}favorites.html" aria-label="あとで見るリスト">
      <svg><use href="#i-heart"/></svg><span class="header__fav-badge" hidden>0</span>
    </a>
    <a class="header__search" href="{PRE}search.html" aria-label="写真を検索"><svg><use href="#i-search"/></svg></a>
    <button class="burger" id="btnBurger" aria-label="メニューを開く" aria-expanded="false"><svg><use href="#i-menu"/></svg></button>
  </div>
</header>
<div class="drawer" id="drawer">
  <nav class="drawer__panel" aria-label="モバイルメニュー">
    <button class="drawer__close" id="drawerClose" aria-label="メニューを閉じる"><svg><use href="#i-close"/></svg></button>
    %s
  </nav>
</div>'''.replace('{PRE}', pre) % (E(SITE), items, drawer)


FOOTER_TPL = '''<footer class="footer">
  <div class="container">
    <div class="footer__top">
      <a href="{PRE}index.html" class="logo">
        <span class="logo__mark"><svg><use href="#i-camera"/></svg></span>
        <span class="logo__text"><span class="logo__en">志賀町</span><span class="logo__ja">SHIKA TOWN</span></span>
      </a>
      <div class="footer__primary">
        <a class="footer__btn" href="https://shika-guide.jp" target="_blank" rel="noopener"><svg><use href="#i-compass"/></svg>志賀町観光情報</a>
        <a class="footer__btn" href="https://www.instagram.com/shikatown_official/" target="_blank" rel="noopener"><svg><use href="#i-instagram"/></svg>Instagram</a>
        <a class="footer__btn" href="{PRE}index.html#contact"><svg><use href="#i-mail"/></svg>お問い合わせ</a>
      </div>
    </div>
    <div class="footer__bottom">
      <ul class="footer__links">
        <li><a href="{PRE}terms.html">利用規約</a></li>
        <li><a href="{PRE}privacy.html">プライバシーポリシー</a></li>
        <li><a href="{PRE}credit.html">著作権・クレジット</a></li>
        <li><a href="{PRE}faq.html">よくあるご質問</a></li>
        <li><a href="{PRE}instagram.html">Instagramのご紹介</a></li>
      </ul>
      <p class="footer__copy">© 志賀町 All Rights Reserved.</p>
    </div>
  </div>
</footer>
<script src="{PRE}assets/js/favorites-widget.js"></script>
<script src="{PRE}assets/js/{JS}"></script>
</body>
</html>'''


def footer(pre='../', js='spots.js'):
    return FOOTER_TPL.replace('{PRE}', pre).replace('{JS}', js)


def spot_card(s, href_prefix=''):
    return '''<a class="spot-card" href="%s%s.html" data-area="%s">
  <div class="spot-card__media"><img src="../%s" alt="%s" loading="lazy" width="2000" height="1125"></div>
  <div class="spot-card__body">
    <h3 class="spot-card__name">%s</h3>
    <p class="spot-card__area"><svg><use href="#i-pin"/></svg>%s</p>
    <p class="spot-card__count">写真 %d枚</p>
  </div>
</a>''' % (E(href_prefix), E(s['id']), E(s['area']), E(s['hero']), E(s['name']), E(s['name']), E(s['area']), s['count'])


# =====================================================================
# spots/index.html
# =====================================================================
areas = []
for s in SPOTS:
    if s['area'] and s['area'] not in areas:
        areas.append(s['area'])

filters = '<button class="filter is-active" type="button" data-area="all">すべて（%d）</button>' % len(SPOTS)
for a in areas:
    n = sum(1 for s in SPOTS if s['area'] == a)
    filters += '<button class="filter" type="button" data-area="%s">%s（%d）</button>' % (E(a), E(a), n)

index_html = head(
    'スポットから探す｜%s' % SITE,
    '志賀町の観光スポットを写真から探せます。世界一長いベンチ、機具岩、巌門、ヤセの断崖など%d件を掲載。' % len(SPOTS),
    '../assets/img/ogp.jpg', './') + '''</head>
<body>
''' + SPRITE + '''
<a href="#main" class="sr-only">本文へスキップ</a>
''' + header('スポットから探す') + '''
<main id="main">
  <nav class="breadcrumb container" aria-label="パンくずリスト">
    <ol>
      <li><a href="../index.html">HOME</a></li>
      <li>スポットから探す</li>
    </ol>
  </nav>

  <div class="container">
    <div class="pagehead">
      <span class="pagehead__eyebrow">SPOTS</span>
      <h1 class="pagehead__title">スポットから探す</h1>
      <p class="pagehead__lead">志賀町の観光スポットを、写真からたどれます。</p>
    </div>

    <div class="filters" id="areaFilters">''' + filters + '''</div>

    <div class="spot-grid" id="spotGrid">
''' + '\n'.join(spot_card(s) for s in SPOTS) + '''
    </div>
    <p class="results__empty" id="noResult" hidden>該当するスポットがありません。</p>
  </div>

  <div style="height:var(--section-gap)"></div>
</main>
''' + footer()

io.open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(index_html)
print('spots/index.html')


# =====================================================================
# spots/<id>.html
# =====================================================================
for i, s in enumerate(SPOTS):
    related = [SPOTS[(i + k) % len(SPOTS)] for k in (1, 2, 3, 4)]

    body = ''.join('<p>%s</p>' % E(p) for p in s['body'])
    tags = ''.join('<a class="tag" href="../index.html#photos">#%s</a>' % E(t) for t in s['tags'])

    rows = '<div class="infobox__row"><p class="infobox__label">住所</p><p class="infobox__value">%s</p></div>' % E(s['address'])
    for r in s['info']:
        rows += '<div class="infobox__row"><p class="infobox__label">%s</p><p class="infobox__value">%s</p></div>' % (E(r['label']), E(r['value']))

    mapq = urllib.parse.quote(s['name'].split('・')[0] + ' ' + s['address'])
    srcs = '　'.join('<a href="%s" target="_blank" rel="noopener">%s</a>' % (E(x['url']), E(x['label'])) for x in s['sources'])

    gallery = ''.join('''<button class="gallery__item" type="button" data-index="%d" data-large="%s" data-caption="%s" data-photo="%s">
      <img src="%s" alt="%s" loading="lazy" width="640" height="480">
      <span class="gallery__cap">%s</span>
    </button>''' % (j, E(p['large']), E(p['caption']), E(PHOTO_ID.get(_norm(p['thumb']), '')),
                    E(p['thumb']), E(p['caption']), E(p['caption']))
        for j, p in enumerate(s['photos']))

    ld = json.dumps({
        "@context": "https://schema.org", "@type": "TouristAttraction",
        "name": s['name'], "description": s['catch'],
        "address": {"@type": "PostalAddress", "addressCountry": "JP", "streetAddress": s['address']},
        "image": "../" + s['hero'], "inLanguage": "ja"
    }, ensure_ascii=False)

    page = head('%s｜%s' % (s['name'], SITE), s['catch'], '../' + s['hero'], './%s.html' % s['id'])
    page += '<script type="application/ld+json">%s</script>\n</head>\n<body>\n' % ld
    page += SPRITE + '\n<a href="#main" class="sr-only">本文へスキップ</a>\n' + header('スポットから探す') + '''
<main id="main">
  <section class="spothero">
    <div class="spothero__media"><img src="../%s" alt="%s" fetchpriority="high" width="2000" height="1125"></div>
    <div class="spothero__body">
      <p class="spothero__area"><svg><use href="#i-pin"/></svg>%s</p>
      <h1 class="spothero__title">%s<span class="spothero__kana">%s</span></h1>
    </div>
  </section>

  <nav class="breadcrumb container" aria-label="パンくずリスト">
    <ol>
      <li><a href="../index.html">HOME</a></li>
      <li><a href="index.html">スポットから探す</a></li>
      <li>%s</li>
    </ol>
  </nav>

  <section class="spotbody">
    <div class="container spotbody__grid">
      <div>
        <p class="spotbody__catch">%s</p>
        <div class="spotbody__text">%s</div>
        <div class="spotbody__tags">%s</div>
      </div>
      <aside class="infobox">
        <p class="infobox__title">INFORMATION</p>
        %s
        <a class="infobox__map" href="https://www.google.com/maps/search/?api=1&amp;query=%s" target="_blank" rel="noopener"><svg><use href="#i-pin"/></svg>地図で見る</a>
      </aside>
    </div>
  </section>

  <section class="section section--tight" id="photos">
    <div class="container">
      <div class="section__head">
        <div>
          <span class="section__eyebrow">PHOTOS</span>
          <h2 class="section__title">%sの写真</h2>
          <p class="section__lead">写真をクリックすると拡大表示します。</p>
        </div>
        <span class="section__more">全%d枚</span>
      </div>
      <div class="gallery" id="gallery">%s</div>
    </div>
  </section>

  <section class="related">
    <div class="container">
      <div class="section__head">
        <div>
          <span class="section__eyebrow">RELATED</span>
          <h2 class="section__title">近くのスポット</h2>
        </div>
        <a class="section__more" href="index.html">すべて見る <svg><use href="#i-arrow"/></svg></a>
      </div>
      <div class="spot-grid">%s</div>
    </div>
  </section>
</main>

<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="写真の拡大表示">
  <button class="lightbox__close" id="lbClose" aria-label="閉じる"><svg><use href="#i-close"/></svg></button>
  <button class="lightbox__btn lightbox__btn--prev" id="lbPrev" aria-label="前の写真"><svg><use href="#i-chev-l"/></svg></button>
  <button class="lightbox__btn lightbox__btn--next" id="lbNext" aria-label="次の写真"><svg><use href="#i-chev-r"/></svg></button>
  <div class="lightbox__stage"><img class="lightbox__img" id="lbImg" alt=""></div>
  <div class="lightbox__bar">
    <span class="lightbox__cap" id="lbCap"></span>
    <span class="lightbox__count" id="lbCount"></span>
    <a class="lightbox__link" id="lbLink" href="#" hidden>写真の詳細・ダウンロード →</a>
  </div>
</div>
''' % (E(s['hero']), E(s['name']), E(s['area']), E(s['name']), E(s['kana']), E(s['name']),
       E(s['catch']), body, tags, rows, mapq, E(s['name']), s['count'], gallery,
       '\n'.join(spot_card(r) for r in related)) + footer()

    io.open(os.path.join(OUT, '%s.html' % s['id']), 'w', encoding='utf-8').write(page)
    print('spots/%s.html' % s['id'])

print('\n%d ページを生成しました。' % (len(SPOTS) + 1))
