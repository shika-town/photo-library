# -*- coding: utf-8 -*-
"""GA4（Googleアナリティクス）から、直近30日でダウンロードが多かった写真の
ランキングを取得して data/ranking.json を作ります。

  使い方:  python3 scripts/fetch-ga4-ranking.py     ← site フォルダ直下で実行

  必要な環境変数:
    GA4_PROPERTY_ID          … GA4プロパティ番号（例: 123456789）
    GA4_SERVICE_ACCOUNT_JSON … サービスアカウントの認証情報（JSONの中身をそのまま）

  どちらも無い場合は、何もせず正常終了します（GA4連携はオプション機能のため、
  未設定でもサイトのビルド自体は止めません）。

  事前準備が必要です。詳しくは docs/03_初期設定/GA4ランキング設定手順.md を
  参照してください。
"""
import io, os, json, sys, tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'data', 'ranking.json')
TOP_N = 8
DAYS = 30

PROPERTY_ID = os.environ.get('GA4_PROPERTY_ID', '').strip()
CREDS_JSON = os.environ.get('GA4_SERVICE_ACCOUNT_JSON', '').strip()

if not PROPERTY_ID or not CREDS_JSON:
    print('  GA4_PROPERTY_ID / GA4_SERVICE_ACCOUNT_JSON が未設定のため、ランキング取得をスキップしました。')
    sys.exit(0)

try:
    from google.oauth2 import service_account
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        DateRange, Dimension, Metric, RunReportRequest, FilterExpression, Filter, OrderBy,
    )
except ImportError:
    print('  ！ google-analytics-data がインストールされていません（pip install google-analytics-data）。'
          'ランキング取得をスキップしました。')
    sys.exit(0)

with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
    f.write(CREDS_JSON)
    key_path = f.name

try:
    credentials = service_account.Credentials.from_service_account_file(
        key_path, scopes=['https://www.googleapis.com/auth/analytics.readonly'])
    client = BetaAnalyticsDataClient(credentials=credentials)

    request = RunReportRequest(
        property='properties/%s' % PROPERTY_ID,
        dimensions=[Dimension(name='customEvent:photo_id')],
        metrics=[Metric(name='eventCount')],
        date_ranges=[DateRange(start_date='%ddaysAgo' % DAYS, end_date='today')],
        dimension_filter=FilterExpression(
            filter=Filter(field_name='eventName',
                           string_filter=Filter.StringFilter(value='photo_download'))),
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name='eventCount'), desc=True)],
        # GA4には photo_id が記録されていない行（"(not set)" など、計測コード導入前の
        # イベントや不正なリクエスト由来）が混ざることがあるため、後段でそれらを除いても
        # TOP_N件を確保できるよう多めに取得する。
        limit=TOP_N * 3,
    )
    response = client.run_report(request)

    # 表示に必要な情報（タイトル・サムネイル等）を、直前のビルドのlibrary.jsonから引く。
    # まだ無い/読めない場合はIDだけのランキングになる（フロント側で描画をスキップする）。
    lib_by_id = {}
    lib_path = os.path.join(BASE, 'data', 'library.json')
    if os.path.exists(lib_path):
        try:
            lib_by_id = {p['id']: p for p in json.load(io.open(lib_path, encoding='utf-8'))['photos']}
        except Exception:
            lib_by_id = {}

    photos = []
    for row in response.rows:
        photo_id = row.dimension_values[0].value.strip()
        count = int(row.metric_values[0].value)
        if not photo_id or photo_id == '(not set)':
            continue
        p = lib_by_id.get(photo_id)
        if not p:
            # library.jsonに存在しないID（削除済み写真、計測ミス等）は、サムネイルを
            # 出せずフロントで画像が欠けて見えるため、ランキングに載せない。
            continue
        photos.append({'id': photo_id, 'downloads': count, 'title': p['title'], 'area': p['area'],
                       'thumb': p['thumb'], 'alt': p.get('alt', p['title']), 'tags': p.get('tags', [])})
        if len(photos) >= TOP_N:
            break

    data = {
        'note': 'fetch-ga4-ranking.py が自動生成しています。直接編集しないでください。',
        'periodDays': DAYS,
        'photos': photos,
    }
    io.open(OUT, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2))
    print('  ranking.json: %d件' % len(photos))

except Exception as e:
    # GA4側の一時的な不調やAPI制限で失敗しても、サイト全体のビルドは止めない。
    # 既にranking.jsonがあれば、それを使い続けるため何もしない。
    print('  ！ GA4からのランキング取得に失敗しました（%s）。前回のランキングをそのまま使います。' % e)

finally:
    try:
        os.remove(key_path)
    except OSError:
        pass
