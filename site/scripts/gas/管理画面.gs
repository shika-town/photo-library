/**
 * SHIKA PHOTO LIBRARY - スプレッドシート管理画面
 *
 * Googleスプレッドシートに貼り付けると、メニューから入力用サイドバーを開けます。
 * 既存の「写真」「スポット」「フォーム回答」タブを書き換えるだけなので、
 * 公開中サイトのURLやGitHub Pagesの設定には触れません。
 */

var ADMIN_MENU_NAME = 'フォトライブラリー管理';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(ADMIN_MENU_NAME)
    .addItem('入力画面を開く', '管理画面を開く')
    .addSeparator()
    .addItem('承認待ちを再読み込み', '管理画面を開く')
    .addToUi();
}

function 管理画面を開く() {
  var html = HtmlService.createTemplateFromFile('管理画面')
    .evaluate()
    .setTitle('フォトライブラリー管理');
  SpreadsheetApp.getUi().showSidebar(html);
}

function 管理画面データを取得する() {
  var ss = _管理対象シート();
  return {
    spots: _スポット一覧(ss),
    choices: _選択肢(ss),
    pending: _承認待ち一覧(ss),
    today: Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd')
  };
}

function 写真を登録する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, '写真');
  var col = _列番号(sh);
  ['id', 'title', 'spot', 'area', 'driveFileId', 'publish'].forEach(function (key) {
    if (col[key] === undefined) throw new Error('「写真」タブに ' + key + ' 列がありません。');
  });

  var fileId = String(payload.driveFileId || '').trim();
  if (!fileId && payload.file && payload.file.bytes) {
    fileId = _写真ファイルを保存(payload.file, payload.spot);
  }
  if (!fileId) throw new Error('写真ファイル、またはGoogleドライブの共有リンクを指定してください。');

  var spot = String(payload.spot || '').trim();
  var area = _スポット別エリア(ss)[spot] || String(payload.area || '').trim();
  var id = _次の写真ID(sh, col.id);
  var width = sh.getLastColumn();
  var row = new Array(width).fill('');
  row[col.id] = id;
  row[col.title] = String(payload.title || '').trim();
  row[col.spot] = spot;
  row[col.area] = area;
  row[col.season] = String(payload.season || '').trim();
  row[col.tags] = _配列文字列(payload.tags);
  row[col.roles] = _配列文字列(payload.roles);
  row[col.sortOrder] = Number(payload.sortOrder || 9000);
  row[col.driveFileId] = fileId;
  if (col.focus !== undefined) row[col.focus] = String(payload.focus || '中央');
  if (col.photographer !== undefined) row[col.photographer] = String(payload.photographer || '志賀町');
  if (col.copyright !== undefined) row[col.copyright] = String(payload.copyright || '© 志賀町');
  if (col.description !== undefined) row[col.description] = String(payload.description || '').trim();
  row[col.publish] = payload.publish === true ? 'TRUE' : 'FALSE';
  if (col.updatedBy !== undefined) row[col.updatedBy] = Session.getEffectiveUser().getEmail() || '管理画面';
  if (col.updatedAt !== undefined) row[col.updatedAt] = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd');

  if (!row[col.title]) throw new Error('タイトルを入力してください。');
  sh.getRange(sh.getLastRow() + 1, 1, 1, width).setValues([row]);
  return { ok: true, message: id + ' を登録しました。公開するには承認してください。', id: id };
}

function 承認状態を変更する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sheetName = String(payload.sheet || '');
  var rowNumber = Number(payload.rowNumber || 0);
  if (!rowNumber || rowNumber < 2) throw new Error('対象行が見つかりません。');

  var sh = _必須タブ(ss, sheetName);
  var col = _列番号(sh);
  if (sheetName === 'フォーム回答') {
    if (col['承認'] === undefined) throw new Error('「フォーム回答」タブに承認列がありません。');
    sh.getRange(rowNumber, col['承認'] + 1).setValue(payload.approved ? 'TRUE' : 'FALSE');
    if (col.focus !== undefined && payload.focus) sh.getRange(rowNumber, col.focus + 1).setValue(payload.focus);
    if (col.sortOrder !== undefined && payload.sortOrder) sh.getRange(rowNumber, col.sortOrder + 1).setValue(payload.sortOrder);
  } else if (sheetName === '写真') {
    if (col.publish === undefined) throw new Error('「写真」タブに publish 列がありません。');
    sh.getRange(rowNumber, col.publish + 1).setValue(payload.approved ? 'TRUE' : 'FALSE');
    if (col.updatedBy !== undefined) sh.getRange(rowNumber, col.updatedBy + 1).setValue(Session.getEffectiveUser().getEmail() || '管理画面');
    if (col.updatedAt !== undefined) sh.getRange(rowNumber, col.updatedAt + 1).setValue(Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd'));
  } else {
    throw new Error('承認できないタブです。');
  }
  return { ok: true, message: payload.approved ? '公開待ちにしました。次回の自動更新で反映されます。' : '非公開にしました。' };
}

function スポットを保存する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, 'スポット');
  var col = _列番号(sh);
  var id = String(payload.id || '').trim();
  if (!id) throw new Error('スポットを選んでください。');
  var rowNumber = _行を探す(sh, col.id, id);
  if (!rowNumber) throw new Error('スポットが見つかりません: ' + id);

  ['catch', 'body1', 'body2', 'body3', 'body4', 'heroPhotoId', 'publish'].forEach(function (key) {
    if (col[key] !== undefined && payload[key] !== undefined) {
      sh.getRange(rowNumber, col[key] + 1).setValue(payload[key]);
    }
  });
  if (col.updatedBy !== undefined) sh.getRange(rowNumber, col.updatedBy + 1).setValue(Session.getEffectiveUser().getEmail() || '管理画面');
  if (col.updatedAt !== undefined) sh.getRange(rowNumber, col.updatedAt + 1).setValue(Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd'));
  return { ok: true, message: 'スポット情報を保存しました。' };
}

function _管理対象シート() {
  if (typeof SHEET_ID !== 'undefined' && SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function _必須タブ(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('「' + name + '」タブが見つかりません。');
  return sh;
}

function _列番号(sh) {
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = {};
  head.forEach(function (h, i) {
    h = String(h || '').trim();
    if (h) col[h] = i;
  });
  return col;
}

function _スポット一覧(ss) {
  var sh = _必須タブ(ss, 'スポット');
  var col = _列番号(sh);
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
  return rows.filter(function (r) { return String(r[col.name] || '').trim(); }).map(function (r, i) {
    return {
      rowNumber: i + 2,
      id: String(r[col.id] || '').trim(),
      name: String(r[col.name] || '').trim(),
      area: String(r[col.area] || '').trim(),
      catch: String(r[col.catch] || '').trim(),
      body1: String(r[col.body1] || '').trim(),
      body2: String(r[col.body2] || '').trim(),
      body3: String(r[col.body3] || '').trim(),
      body4: String(r[col.body4] || '').trim(),
      heroPhotoId: String(r[col.heroPhotoId] || '').trim(),
      publish: String(r[col.publish] || 'TRUE').toUpperCase() === 'TRUE'
    };
  });
}

function _選択肢(ss) {
  var out = { area: [], season: ['春', '夏', '秋', '冬', '通年'], focus: ['中央', '上寄り', '下寄り'], tags: [], roles: ['新着', 'シーン', '季節'] };
  var sh = ss.getSheetByName('選択肢');
  if (!sh) return out;
  var values = sh.getDataRange().getValues();
  for (var c = 0; c < values[0].length; c++) {
    var label = String(values[0][c] || '').trim();
    var list = [];
    for (var r = 1; r < values.length; r++) {
      var v = String(values[r][c] || '').trim();
      if (v && v.charAt(0) !== '※') list.push(v);
    }
    if (label === 'エリア') out.area = list;
    if (label === '季節') out.season = list;
    if (label === '切り抜き') out.focus = list;
    if (label === '役割') out.roles = list;
  }
  out.tags = ['夕陽', '朝日', '星空', '海', '砂浜', '岩', '断崖', '空撮', 'さくら貝', '花', '祭り', 'ライトアップ', '雪', '紅葉', '建築', '庭園'];
  return out;
}

function _承認待ち一覧(ss) {
  var out = [];
  var photos = ss.getSheetByName('写真');
  if (photos) {
    var pc = _列番号(photos);
    var rows = photos.getLastRow() > 1 ? photos.getRange(2, 1, photos.getLastRow() - 1, photos.getLastColumn()).getValues() : [];
    rows.forEach(function (r, i) {
      if (String(r[pc.publish] || '').toUpperCase() === 'TRUE') return;
      out.push({
        sheet: '写真',
        rowNumber: i + 2,
        id: String(r[pc.id] || '').trim(),
        title: String(r[pc.title] || '').trim(),
        spot: String(r[pc.spot] || '').trim(),
        note: String(r[pc.description] || '').trim()
      });
    });
  }
  var forms = ss.getSheetByName('フォーム回答');
  if (forms) {
    var fc = _列番号(forms);
    var fRows = forms.getLastRow() > 1 ? forms.getRange(2, 1, forms.getLastRow() - 1, forms.getLastColumn()).getValues() : [];
    fRows.forEach(function (r, i) {
      if (String(r[fc['承認']] || '').toUpperCase() === 'TRUE') return;
      var titleCol = fc['タイトル'];
      var spotCol = fc['スポット'] !== undefined ? fc['スポット'] : fc['どこで撮った写真ですか'];
      out.push({
        sheet: 'フォーム回答',
        rowNumber: i + 2,
        id: String(r[fc.id] || '').trim(),
        title: String(r[titleCol] || '').trim(),
        spot: String(r[spotCol] || '').trim(),
        note: String(r[fc['備考']] || '').trim()
      });
    });
  }
  return out;
}

function _スポット別エリア(ss) {
  var map = {};
  _スポット一覧(ss).forEach(function (s) { map[s.name] = s.area; });
  return map;
}

function _次の写真ID(sh, idIndex) {
  var maxNo = 0;
  if (sh.getLastRow() > 1) {
    sh.getRange(2, idIndex + 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      var m = String(r[0] || '').match(/^P(\d+)$/);
      if (m) maxNo = Math.max(maxNo, parseInt(m[1], 10));
    });
  }
  return 'P' + ('0000' + (maxNo + 1)).slice(-4);
}

function _行を探す(sh, idIndex, id) {
  var vals = sh.getRange(2, idIndex + 1, Math.max(sh.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === id) return i + 2;
  }
  return 0;
}

function _写真ファイルを保存(file, spotName) {
  if (typeof PHOTO_FOLDER_ID === 'undefined' || !PHOTO_FOLDER_ID) {
    throw new Error('写真フォルダIDが未設定です。先に PHOTO_FOLDER_ID を設定してください。');
  }
  var root = DriveApp.getFolderById(PHOTO_FOLDER_ID);
  var folder = root;
  if (spotName) {
    var found = root.getFoldersByName(spotName);
    folder = found.hasNext() ? found.next() : root.createFolder(spotName);
  }
  var bytes = Utilities.base64Decode(String(file.bytes || '').split(',').pop());
  var blob = Utilities.newBlob(bytes, file.mimeType || 'image/jpeg', file.name || 'photo.jpg');
  var saved = folder.createFile(blob);
  saved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return saved.getId();
}

function _配列文字列(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.filter(String).join(',');
  return String(value || '').trim();
}
