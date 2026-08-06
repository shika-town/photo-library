# -*- coding: utf-8 -*-
"""data/photos.json を編集したら、このスクリプトで assets/js/data.js を再生成します。

  使い方:  python3 scripts/build-data.py     ← site フォルダ直下で実行
"""
import json, io, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src  = os.path.join(BASE, 'data', 'photos.json')
dst  = os.path.join(BASE, 'assets', 'js', 'data.js')
data = json.load(io.open(src, encoding='utf-8'))
io.open(dst, 'w', encoding='utf-8').write(
    "/* 自動生成: data/photos.json の埋め込みコピー。\n"
    "   file:// で直接開いた場合のフォールバックです。\n"
    "   photos.json を更新したら scripts/build-data.py を実行して再生成してください。 */\n"
    "window.SPL_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")
print('data.js を更新しました:', dst)
