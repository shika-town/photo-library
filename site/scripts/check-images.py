# -*- coding: utf-8 -*-
"""生成されたJSONが参照している画像ファイルが、実際にすべて存在するかを確認します。

  使い方:  python3 scripts/check-images.py     ← site フォルダ直下で実行

  何を確認するか:
    data/library.json … 写真ごとの thumb / large
    data/spots.json    … スポットの hero、写真ごとの thumb / large
    data/photos.json   … トップのhero・スポットカード・新着写真・シーン・季節の image
    data/ranking.json  … 「先月人気だった写真」の thumb（GA4連携時のみ）

  例えば「GA4のイベントにphoto_idが記録されていない」「driveFileIdが間違っている」
  「Googleドライブの共有設定が外れている」等の理由で画像が用意できないまま
  JSONだけ更新されると、公開サイト側でその項目だけ画像が表示されない
  （リンク切れの見た目になる）事故につながります。

  ここで1つでも見つかった場合はビルド全体を失敗させます（build-all.py が
  非0で終了し、GitHub Actionsも失敗します）。他のビルド失敗と同じく、
  直前に公開されている内容はそのまま残るため、サイトが壊れた状態で
  公開されることはありません。まずシート側のdriveFileIdや共有設定を
  確認し、直したうえで再実行してください。
"""
import io, json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _exists(rel_path):
    # spots.json 内のパスは spots/*.html から見た相対パス（../ 付き）なので、
    # site直下からの相対パスに揃えてから確認する。
    p = rel_path[3:] if rel_path.startswith('../') else rel_path
    return os.path.exists(os.path.join(BASE, p))


def _load(name):
    path = os.path.join(BASE, 'data', name)
    if not os.path.exists(path):
        return None
    return json.load(io.open(path, encoding='utf-8'))


def main():
    problems = []  # (発生元, 識別子, 項目, パス)

    def check(source, ident, field, path):
        if not path:
            return  # 空文字は「未設定」であり、欠落ではないので対象外
        if not _exists(path):
            problems.append((source, ident, field, path))

    lib = _load('library.json')
    if lib:
        for p in lib.get('photos', []):
            check('library.json', p.get('id', '?'), 'thumb', p.get('thumb'))
            check('library.json', p.get('id', '?'), 'large', p.get('large'))

    spots = _load('spots.json')
    if spots:
        for s in spots.get('spots', []):
            check('spots.json', s.get('id', '?'), 'hero', s.get('hero'))
            for ph in s.get('photos', []):
                ident = '%s（写真 %s）' % (s.get('id', '?'), ph.get('id', '?'))
                check('spots.json', ident, 'thumb', ph.get('thumb'))
                check('spots.json', ident, 'large', ph.get('large'))

    top = _load('photos.json')
    if top:
        hero = top.get('hero', {})
        check('photos.json', 'トップ', 'hero.image', hero.get('image'))
        for i, h in enumerate(hero.get('images', [])):
            check('photos.json', 'トップ（ヒーロー%d枚目）' % (i + 1), 'image', h.get('image'))
        for s in top.get('spots', []):
            check('photos.json', 'スポットカード %s' % s.get('id', '?'), 'image', s.get('image'))
        for p in top.get('photos', []):
            check('photos.json', '新着写真 %s' % p.get('id', '?'), 'image', p.get('image'))
        for sc in top.get('scenes', []):
            check('photos.json', 'シーン「%s」' % sc.get('label', '?'), 'image', sc.get('image'))
        for se in top.get('seasons', []):
            check('photos.json', '季節「%s」' % se.get('ja', '?'), 'image', se.get('image'))

    ranking = _load('ranking.json')
    if ranking:
        for p in ranking.get('photos', []):
            check('ranking.json', p.get('id', '?'), 'thumb', p.get('thumb'))

    if problems:
        print('  ！ 参照先の画像ファイルが見つからない項目が %d件 あります:' % len(problems))
        for source, ident, field, path in problems:
            print('      [%s] %s の %s → %s' % (source, ident, field, path))
        print('\n  シートの driveFileId・共有設定を確認するか、該当の写真の publish を'
              ' FALSE にしてから、シートの取り込みからやり直してください。')
        raise SystemExit(1)

    print('  画像の欠落チェック: 問題ありませんでした。')


if __name__ == '__main__':
    main()
