# -*- coding: utf-8 -*-
"""運用シートを読み込み、写真を自動リサイズして data/*.json を作り直します。

  ローカルのExcelから:  python3 scripts/import-sheet.py ../運用シート_SHIKA_PHOTO_LIBRARY.xlsx
  Googleスプレッドシートから:
      export SHEET_ID=スプレッドシートのID
      python3 scripts/import-sheet.py

Googleスプレッドシートは「リンクを知っている全員が閲覧可」にしておいてください。
写真は driveFileId（Googleドライブ）または localPath（リポジトリ内）のどちらかで指定します。
"""
import json, io, os, sys, csv, re, time, urllib.request, urllib.parse, unicodedata
from PIL import Image, ImageEnhance, UnidentifiedImageError

BASE  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG   = os.path.join(BASE, 'assets', 'img')
CACHE = os.path.join(BASE, '..', '_source', 'cache')   # ドライブから取得した元画像（再取得を避ける）
os.makedirs(os.path.join(IMG, 'spots'), exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

SIZES = {
    'hero':   (2000, 1125),   # スポットのヒーロー・トップの大きな写真
    'thumb':  ( 640,  480),   # ギャラリー・検索結果
    'large':  (1400, 1050),   # 拡大表示・ダウンロード
    'new':    (1080,  840),   # トップの新着写真
    'season': ( 800,  600),   # 季節タイル
    'scene':  ( 600,  600),   # シーンカード
}
FOCUS = {'中央': 0.5, '上寄り': 0.25, '下寄り': 0.75, '': 0.5}

# =====================================================================
# シートの読み込み
# =====================================================================
def read_xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    out = {}
    for ws in wb:
        rows = list(ws.iter_rows(values_only=True))
        if not rows: continue
        head = [str(h).strip() if h is not None else '' for h in rows[0]]
        body = []
        for r in rows[1:]:
            if not any(v not in (None, '') for v in r):
                continue
            first = str(r[0] or '').strip()
            if first.startswith('※'):        # シート内の注記行は読み飛ばす
                continue
            body.append(dict(zip(head, ['' if v is None else v for v in r])))
        out[ws.title] = body
    return out

# 各タブに必ずあるはずの列。これが無ければ「読めていない」と判断して止める。
REQUIRED = {
    '写真':     ['id', 'title', 'publish'],
    'スポット': ['id', 'name', 'area'],
    'サイト設定': ['key', '値'],
    'シーン':   ['label', 'photoId'],
    '季節':     ['ja', 'photoId'],
}
OPTIONAL_SHEETS = ('フォーム回答',)

# gviz（/gviz/tq?tqx=out:csv）は、列数や本文の長い列が多いタブ（特に「スポット」）で、
# まれに行ごとのデータではなく「列見出し＋全行の値を空白でつなげた1行」という壊れた形の
# CSVを返すことがある（Google側の既知の癖で、シート自体のデータは壊れていない）。
# その場合は、より単純で確実な /export?format=csv エンドポイントに切り替えて読み直す。
# ただしこちらは gid（シートの内部ID）指定が必要でシート名を受け付けないため、
# 既知のタブだけ gid を記録しておく（運用シートでタブを作り直すとgidは変わるので、
# 該当タブが増えたらここに追記する）。
SHEET_GID_FALLBACK = {
    'スポット': '985598342',
}

def _fetch_csv(url):
    text = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                text = r.read().decode('utf-8')
            break
        except Exception as e:
            err = e
            time.sleep(3)
    return text, (err if text is None else None)

def read_gsheet(sheet_id):
    """Googleスプレッドシートを読む。
    シートが非公開だと Google はログイン画面のHTMLを返す。それをCSVとして
    読み込むと「行はあるが中身が空」という状態になり、サイトが白紙で
    上書きされてしまう。そこで必ず見出し行を検査し、想定の列が無ければ
    その場で異常終了する（＝GitHubの実行が赤く失敗し、公開はされない）。
    """
    out = {}
    for name in ('写真', 'スポット', 'サイト設定', 'シーン', '季節', 'フォーム回答'):
        url = ('https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&sheet=%s'
               % (sheet_id, urllib.parse.quote(name)))
        text, err = _fetch_csv(url)
        if text is None:
            if name in OPTIONAL_SHEETS:
                continue    # 「フォーム回答」タブが未作成のうちは飛ばす
            raise SystemExit('！ シート「%s」を読み込めませんでした（%s）。\n'
                             '   運用シートの共有設定を「リンクを知っている全員（閲覧者）」に'
                             'してください。' % (name, err))

        # ログイン画面などのHTMLが返っていないか
        if text.lstrip()[:1] == '<' or '<html' in text[:2000].lower():
            if name in OPTIONAL_SHEETS:
                continue
            raise SystemExit('！ シート「%s」の代わりにHTML（ログイン画面）が返りました。\n'
                             '   運用シートの共有設定を「リンクを知っている全員（閲覧者）」に'
                             'してください。' % name)

        rows = list(csv.reader(io.StringIO(text)))
        head = [h.strip() for h in rows[0]] if rows else []
        need = REQUIRED.get(name, [])
        missing = [c for c in need if c not in head]
        if missing and name in SHEET_GID_FALLBACK:
            fallback_url = ('https://docs.google.com/spreadsheets/d/%s/export?format=csv&gid=%s'
                            % (sheet_id, SHEET_GID_FALLBACK[name]))
            fb_text, fb_err = _fetch_csv(fallback_url)
            if fb_text is not None and not (fb_text.lstrip()[:1] == '<' or '<html' in fb_text[:2000].lower()):
                fb_rows = list(csv.reader(io.StringIO(fb_text)))
                fb_head = [h.strip() for h in fb_rows[0]] if fb_rows else []
                fb_missing = [c for c in need if c not in fb_head]
                if not fb_missing:
                    print('  ！ シート「%s」はgvizが壊れた形を返したため、別の読み込み方法に切り替えました。' % name)
                    rows, head, missing = fb_rows, fb_head, fb_missing
        if missing:
            if name in OPTIONAL_SHEETS:
                continue
            raise SystemExit('！ シート「%s」に %s 列が見当たりません。\n'
                             '   見出し行: %s\n'
                             '   タブ名や列名が変わっていないか、共有設定が'
                             '「リンクを知っている全員（閲覧者）」になっているか確認してください。'
                             % (name, '・'.join(missing), head[:12]))

        out[name] = [dict(zip(head, r)) for r in rows[1:] if any(x.strip() for x in r)]
        print('  %s: %d行' % (name, len(out[name])))
    return out

# =====================================================================
# 画像の取得とリサイズ
# =====================================================================
def fetch(photo):
    """元画像のローカルパスを返す。ドライブからは1度だけ取得してキャッシュする。"""
    fid = str(photo.get('driveFileId', '')).strip()
    if fid:
        m = re.search(r'/d/([A-Za-z0-9_-]{20,})', fid) or re.search(r'[?&]id=([A-Za-z0-9_-]{20,})', fid)
        if m: fid = m.group(1)
        dst = os.path.join(CACHE, '%s.jpg' % fid)
        if not os.path.exists(dst):
            url = 'https://drive.usercontent.google.com/download?id=%s&export=download' % fid
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if data[:15].lower().startswith(b'<!doctype html') or data[:5] == b'<html':
                raise SystemExit('！ ドライブの共有設定を確認してください（id=%s）' % fid)
            io.open(dst, 'wb').write(data)
            print('    取得: %s' % fid)
        return dst
    lp = str(photo.get('localPath', '')).strip()
    if lp:
        # assets/img/lib は取り込みの「出力先」。ここを読み込み元にすると、
        # 実行を繰り返すうちに写真の対応が崩れるため受け付けない。
        if 'assets/img/lib' in lp.replace('\\', '/'):
            raise SystemExit('！ localPath に出力先（assets/img/lib）を指定できません: %s' % lp)
        for cand in (os.path.join(BASE, lp), os.path.join(BASE, '..', lp), lp):
            if os.path.exists(cand): return cand
    raise FileNotFoundError('写真 %s の画像が見つかりません（driveFileId か localPath を指定してください）' % photo.get('id'))


_made = {}
def made_path(name):
    """生成済み画像がある場合は、サイト内パスを返す。
    GitHub Actions 側でドライブや元画像を一時的に読めない場合でも、
    すでに公開用画像が残っていればトップページを画像なしで上書きしない。
    """
    out = os.path.join(IMG, name + '.jpg')
    if os.path.exists(out):
        return 'assets/img/%s.jpg' % name
    return None

def make(src, name, size, fy=0.5):
    key = (src, name, size, fy)
    if key in _made: return _made[key]
    W, H = size
    # 元画像より大きく書き出さない（引き伸ばして画質が落ちるのを防ぐ）
    with Image.open(src) as _probe:
        _w, _h = _probe.size
    _fit = min(1.0, (_w / W) if (_w / _h) < (W / H) else (_h / H))
    if _fit < 1.0:
        W, H = max(1, int(W * _fit)), max(1, int(H * _fit))
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', im.size, (255, 255, 255))
        im = im.convert('RGBA'); bg.paste(im, mask=im.split()[-1]); im = bg
    else:
        im = im.convert('RGB')
    tw, th = W / H, im.width / im.height
    if th > tw: nw, nh = int(im.height * tw), im.height
    else:       nw, nh = im.width, int(im.width / tw)
    x = int((im.width - nw) * 0.5); y = int((im.height - nh) * fy)
    im = im.crop((x, y, x + nw, y + nh)).resize((W, H), Image.LANCZOS)
    im = ImageEnhance.Color(im).enhance(1.03)
    im = ImageEnhance.Sharpness(im).enhance(1.06)
    out = os.path.join(IMG, name + '.jpg')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, quality=84, optimize=True, progressive=True)
    _made[key] = 'assets/img/%s.jpg' % name
    return _made[key]


yes = lambda v: str(v).strip().upper() in ('TRUE', '1', 'YES', 'はい', '○')
split = lambda v: [x.strip() for x in str(v or '').replace('、', ',').split(',') if x.strip()]

def photo_visible(p):
    """公開サイトに出す写真だけを通す。
    publish は表示ON/OFF、downloadAllowed はダウンロード対象のON/OFF。
    既存シートに downloadAllowed 列が無い場合は、従来どおり TRUE 扱いにする。
    """
    return yes(p.get('publish', 'TRUE')) and yes(p.get('downloadAllowed', p.get('download', 'TRUE')))

# =====================================================================
# 実行
# =====================================================================
def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    if src:
        print('読み込み: %s' % src); data = read_xlsx(src)
    else:
        sid = os.environ.get('SHEET_ID')
        if not sid: raise SystemExit('！ SHEET_ID を指定するか、Excelのパスを引数で渡してください。')
        print('読み込み: Googleスプレッドシート %s' % sid); data = read_gsheet(sid)

    photos = [p for p in data.get('写真', [])       if photo_visible(p)]

    # 安全装置：読み込み結果が異常に少ないときは、サイトを空で上書きしないように止める
    if len(photos) < 20:
        raise SystemExit('！ 公開対象の写真が %d件しかありません。読み込みに失敗している'
                         '可能性が高いため中止しました。' % len(photos))

    # ---- 職員がフォームから投稿した写真 ----
    # 「承認」欄に TRUE が入っている行だけをサイトに反映する。
    # idは回答の行順から自動で決める（F0001…）。行が追加されるだけなので番号は変わらない。
    forms = data.get('フォーム回答', [])
    F = {'写真': 'driveFileId', 'タイトル': 'title',
         ('スポット', 'どこで撮った写真ですか'): 'spot',
         '季節': 'season', 'タグ': 'tags', '撮影者': 'photographer', '備考': 'description'}
    n_form = 0
    def form_value(row, keys):
        if isinstance(keys, tuple):
            for key in keys:
                v = str(row.get(key, '') or '').strip()
                if v:
                    return v
            return ''
        return str(row.get(keys, '') or '').strip()

    for i, row in enumerate(forms, 1):
        if not yes(row.get('承認', '')):
            continue
        pic = str(row.get('写真', '')).strip()
        title = str(row.get('タイトル', '')).strip()
        if not pic or not title:
            print('  ！ フォーム回答 %d行目：写真かタイトルが空のため飛ばしました' % i)
            continue
        rec = {'id': str(row.get('id', '')).strip() or 'F%04d' % i,
               'roles': '', 'focus': str(row.get('focus', '') or '中央'),
               'copyright': '© 志賀町', 'publish': 'TRUE', 'downloadAllowed': 'TRUE',
               'sortOrder': row.get('sortOrder', '') or 9000 + i}
        for jp, en in F.items():
            rec[en] = form_value(row, jp)
        # ドライブのURL/IDならそのまま、そうでなければリポジトリ内のパスとして扱う
        if 'drive.google' not in pic and not re.fullmatch(r'[A-Za-z0-9_-]{20,}', pic):
            rec['driveFileId'] = ''
            rec['localPath'] = pic
        rec['photographer'] = rec['photographer'] or '志賀町'
        photos.append(rec)
        n_form += 1
    if forms:
        waiting = sum(1 for r in forms if not yes(r.get('承認', '')))
        print('  フォーム投稿：%d枚を反映 / %d枚が承認待ち' % (n_form, waiting))
    spots  = [s for s in data.get('スポット', [])   if yes(s.get('publish', 'TRUE'))]
    scenes = [s for s in data.get('シーン', [])     if yes(s.get('publish', 'TRUE'))]
    seasons= [s for s in data.get('季節', [])       if yes(s.get('publish', 'TRUE'))]
    site   = {r['key']: r.get('値', r.get('value', '')) for r in data.get('サイト設定', []) if r.get('key')}
    by_id  = {str(p['id']).strip(): p for p in photos}
    print('  写真 %d枚 / スポット %d件' % (len(photos), len(spots)))

    skipped = []

    def img(pid, kind):
        p = by_id.get(str(pid).strip())
        if not p: return None, None
        fy = FOCUS.get(str(p.get('focus', '')).strip(), 0.5)
        try:
            return p, make(fetch(p), 'lib/%s-%s' % (p['id'], kind), SIZES[kind], fy)
        except Exception as e:
            old = made_path('lib/%s-%s' % (p['id'], kind))
            if old:
                print('  ！ %s（生成済み画像を再利用します）' % e)
                return p, old
            if not isinstance(e, (FileNotFoundError, UnidentifiedImageError)):
                raise
            if p['id'] not in skipped:
                skipped.append(p['id']); print('  ！ %s' % e)
            return p, None

    # 安全装置：写真の「スポット」欄が、現在の「スポット」タブのどの名前とも一致しない場合を検知する。
    # スポット名の変更・削除・入力ミスがあると、該当の写真は一致するギャラリーが無いまま静かに
    # サイトから抜け落ちてしまう（新着扱いの写真だけはトップに残るが、詳細ページのスポットリンクが壊れる）。
    _spot_names = set(str(s['name']).strip() for s in spots)
    _orphan_spot_photos = [p for p in photos
                            if str(p.get('spot', '')).strip() and str(p.get('spot', '')).strip() not in _spot_names]
    if _orphan_spot_photos:
        print('\n  ！ どのスポットとも一致しない「スポット」欄の写真が %d枚あります（ギャラリーに出ません）:'
              % len(_orphan_spot_photos))
        for p in _orphan_spot_photos[:20]:
            print('      %s: 「%s」（スポット「%s」）' % (p.get('id'), p.get('title', ''), p.get('spot', '')))
        if len(_orphan_spot_photos) > 20:
            print('      …ほか %d枚' % (len(_orphan_spot_photos) - 20))
        print('    管理画面の「写真管理」タブで⚠️要確認として表示されます。スポット名の変更・削除・'
              '入力ミスがないか確認してください。')

    print('  画像を書き出しています…')
    # ---- スポット ----
    spots_out = []
    for s in spots:
        sid = str(s['id']).strip()
        mine = sorted([p for p in photos if str(p.get('spot', '')).strip() == str(s['name']).strip()],
                      key=lambda x: (float(x.get('sortOrder') or 9999), x['id']))
        hero_id = str(s.get('heroPhotoId', '')).strip() or (mine[0]['id'] if mine else '')
        _, hero = img(hero_id, 'hero')
        gal = []
        for p in mine:
            fy = FOCUS.get(str(p.get('focus', '')).strip(), 0.5)
            try:
                f = fetch(p)
                gal.append({'id': p['id'],
                            'thumb': '../' + make(f, 'lib/%s-thumb' % p['id'], SIZES['thumb'], fy),
                            'large': '../' + make(f, 'lib/%s-large' % p['id'], SIZES['large'], fy),
                            'caption': p.get('title', ''), 'tags': split(p.get('tags'))})
            except Exception as e:
                thumb = made_path('lib/%s-thumb' % p['id'])
                large = made_path('lib/%s-large' % p['id'])
                if thumb and large:
                    print('  ！ %s（生成済み画像を再利用します）' % e)
                    gal.append({'id': p['id'],
                                'thumb': '../' + thumb,
                                'large': '../' + large,
                                'caption': p.get('title', ''), 'tags': split(p.get('tags'))})
                    continue
                if not isinstance(e, (FileNotFoundError, UnidentifiedImageError)):
                    raise
                if p['id'] not in skipped:
                    skipped.append(p['id']); print('  ！ %s' % e)
                continue
        spots_out.append({
            'id': sid, 'name': s['name'], 'kana': s.get('kana', ''), 'area': s.get('area', ''),
            'address': s.get('address', ''), 'catch': s.get('catch', ''),
            'body': [s.get('body%d' % i, '') for i in (1, 2, 3, 4) if str(s.get('body%d' % i, '')).strip()],
            'tags': split(s.get('tags')),
            'info': [{'label': s.get('info%d_label' % i), 'value': s.get('info%d_value' % i)}
                     for i in range(1, 7) if str(s.get('info%d_label' % i, '')).strip()],
            'sources': [{'label': s.get('source%d_label' % i), 'url': s.get('source%d_url' % i)}
                        for i in (1, 2) if str(s.get('source%d_url' % i, '')).strip()],
            'hero': hero or '', 'photos': gal, 'count': len(gal),
        })

    io.open(os.path.join(BASE, 'data', 'spots.json'), 'w', encoding='utf-8').write(
        json.dumps({'meta': {'note': '運用シートから自動生成しています。直接編集しないでください。'},
                    'spots': spots_out}, ensure_ascii=False, indent=2))

    # ---- トップページ ----
    # 新着写真はシートの行の並び順をそのまま使う（行をドラッグすれば順番が変わる）
    new_photos = []
    for p in photos:
        if '新着' not in split(p.get('roles')): continue
        fy = FOCUS.get(str(p.get('focus', '')).strip(), 0.5)
        try:
            _img = make(fetch(p), 'lib/%s-new' % p['id'], SIZES['new'], fy)
        except Exception as e:
            _img = made_path('lib/%s-new' % p['id'])
            if _img:
                print('  ！ %s（生成済み画像を再利用します）' % e)
            else:
                if not isinstance(e, (FileNotFoundError, UnidentifiedImageError)):
                    raise
                if p['id'] not in skipped:
                    skipped.append(p['id']); print('  ！ %s' % e)
                continue
        new_photos.append({
            'id': p['id'], 'title': p['title'], 'spot': p.get('spot', ''), 'area': p.get('area', ''),
            'season': p.get('season', ''), 'tags': split(p.get('tags')),
            'image': _img,
            'alt': p.get('description', p['title']),
        })

    # トップのヒーロー画像はスライドショー対応。heroPhotoId にカンマ区切りで
    # 最大3枚まで指定できる（1枚だけ指定した場合は今までどおり静止画として動く）。
    hero_ids = split(site.get('heroPhotoId', ''))[:3]
    hero_images = []
    for hid in hero_ids:
        hp, hpath = img(hid, 'hero')
        if hpath:
            hero_images.append({'image': hpath, 'alt': (hp or {}).get('title', '') or site.get('heroCaption', '')})
    hero_img = hero_images[0]['image'] if hero_images else ''
    spot_cards = []
    for s in spots_out[:4]:
        spot_cards.append({'id': s['id'], 'name': s['name'], 'area': s['area'], 'count': s['count'],
                           'image': s['hero'], 'alt': s['name'], 'description': s['catch']})

    top = {
        'site': {'name': site.get('siteName', ''), 'nameJa': site.get('siteNameJa', ''),
                 'tagline': site.get('tagline', ''), 'copyright': site.get('copyright', '')},
        'hero': {'title': [t for t in (site.get('heroTitle1', ''), site.get('heroTitle2', '')) if t],
                 'image': hero_img or '', 'alt': site.get('heroCaption', ''),
                 'images': hero_images, 'caption': site.get('heroCaption', '')},
        'heroTags': split(site.get('heroTags')),
        'spots': spot_cards,
        'scenes': [], 'photos': new_photos, 'seasons': [],
        'footer': {
            'primary': [
                {'label': '志賀町観光情報', 'href': site.get('kankouUrl', '#'), 'icon': 'i-compass'},
                {'label': 'Instagram', 'href': site.get('instagramUrl', '#'), 'icon': 'i-instagram'},
                {'label': 'お問い合わせ', 'href': '#contact', 'icon': 'i-mail'}],
            'secondary': [
                {'label': '利用規約', 'href': 'terms.html'},
                {'label': 'プライバシーポリシー', 'href': 'privacy.html'},
                {'label': '著作権・クレジット', 'href': 'credit.html'},
                {'label': 'よくあるご質問', 'href': 'faq.html'}],
        },
    }
    for sc in sorted(scenes, key=lambda x: float(x.get('sortOrder') or 0)):
        p, path = img(sc.get('photoId', ''), 'scene')
        top['scenes'].append({'label': sc['label'], 'query': sc.get('query', sc['label']),
                              'image': path or '', 'alt': (p or {}).get('title', sc['label'])})
    for se in sorted(seasons, key=lambda x: float(x.get('sortOrder') or 0)):
        p, path = img(se.get('photoId', ''), 'season')
        top['seasons'].append({'ja': se['ja'], 'en': se.get('en', ''), 'query': se.get('query', se['ja']),
                               'image': path or '', 'alt': (p or {}).get('title', se['ja'])})

    io.open(os.path.join(BASE, 'data', 'photos.json'), 'w', encoding='utf-8').write(
        json.dumps(top, ensure_ascii=False, indent=2))

    if skipped:
        print('\n  ！ 画像が用意できていない写真を %d枚 飛ばしました: %s' % (len(skipped), ', '.join(skipped)))
        print('    シートの driveFileId を埋めるか、publish を FALSE にしてください。')
    print('\n  data/photos.json と data/spots.json を更新しました。')
    print('\n続けて `python3 scripts/build-all.py` を実行するとページが作り直されます。')

if __name__ == '__main__':
    main()
