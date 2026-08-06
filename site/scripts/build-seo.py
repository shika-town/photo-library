# -*- coding: utf-8 -*-
"""data/site-config.json をもとに robots.txt と sitemap.xml を作り直します。
TOPページ（index.html）の noindex の付け外しもここで行います。

  使い方:  python3 scripts/build-seo.py     ← site フォルダ直下で実行
"""
import json, io, os, datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg  = json.load(io.open(os.path.join(BASE, 'data', 'site-config.json'), encoding='utf-8'))
BASE_URL = cfg.get('baseUrl', './').rstrip('/') + '/'
NOINDEX  = bool(cfg.get('noindex', False))
TODAY    = datetime.date.today().isoformat()

spots = json.load(io.open(os.path.join(BASE, 'data', 'spots.json'),   encoding='utf-8'))['spots']
lib   = json.load(io.open(os.path.join(BASE, 'data', 'library.json'), encoding='utf-8'))['photos']

# ---------- robots.txt ----------
if NOINDEX:
    robots = ('# テスト公開中のため、検索エンジンには載せません。\n'
              '# 本公開のときは scripts/set-public.py を実行してください。\n'
              'User-agent: *\nDisallow: /\n')
else:
    robots = 'User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n' % BASE_URL
io.open(os.path.join(BASE, 'robots.txt'), 'w', encoding='utf-8').write(robots)

# ---------- sitemap.xml ----------
urls  = [('', '1.0', 'weekly'), ('search.html', '0.9', 'weekly'), ('spots/', '0.8', 'weekly')]
urls += [('spots/%s.html'  % s['id'], '0.7', 'monthly') for s in spots]
urls += [('photos/%s.html' % p['id'], '0.5', 'monthly') for p in lib]
urls += [(n, '0.4', 'yearly') for n in ('terms.html', 'privacy.html', 'credit.html', 'faq.html')]
xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for path, pri, freq in urls:
    xml += ('  <url><loc>%s%s</loc><lastmod>%s</lastmod>'
            '<changefreq>%s</changefreq><priority>%s</priority></url>\n'
            % (BASE_URL, path, TODAY, freq, pri))
xml += '</urlset>\n'
io.open(os.path.join(BASE, 'sitemap.xml'), 'w', encoding='utf-8').write(xml)

# ---------- index.html の noindex ----------
MARK = '<meta name="robots" content="noindex, nofollow"><!-- テスト公開中 -->\n'
p = os.path.join(BASE, 'index.html')
s = io.open(p, encoding='utf-8').read()
s = s.replace(MARK, '')
if NOINDEX:
    s = s.replace('<meta name="theme-color" content="#0B4F82">\n',
                  '<meta name="theme-color" content="#0B4F82">\n' + MARK)
io.open(p, 'w', encoding='utf-8').write(s)

# ---------- OGP の絶対URL ----------
# SNSで正しく画像が出るよう、og:image と canonical を絶対URLにする
print('robots.txt / sitemap.xml を更新しました（%s / URL %d件）'
      % ('テスト公開＝検索エンジンに載せない' if NOINDEX else '本公開', len(urls)))
