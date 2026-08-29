/**
 * SHIKA PHOTO LIBRARY - スプレッドシート管理画面
 *
 * Googleスプレッドシートに貼り付けると、メニューから入力用サイドバーを開けます。
 * 既存の「写真」「スポット」「フォーム回答」タブを書き換えるだけなので、
 * 公開中サイトのURLやGitHub Pagesの設定には触れません。
 */

var ADMIN_MENU_NAME = 'フォトライブラリー管理';
var DEFAULT_SHEET_ID = '1A9_xzFMdD-UhKyo_a7xJ2h-5cM-orZ_giXX41ZiKT3Y';
var PUBLIC_SITE_URL = 'https://shika-town.github.io/photo-library/';
var GITHUB_REPO = 'shika-town/photo-library';
var GITHUB_WORKFLOW_FILE = 'publish.yml';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(ADMIN_MENU_NAME)
    .addItem('入力画面を開く', '管理画面を開く')
    .addSeparator()
    .addItem('承認待ちを再読み込み', '管理画面を開く')
    .addToUi();
}

function doGet() {
  return _管理画面HTML()
    .setTitle('フォトライブラリー管理')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function 管理画面を開く() {
  var html = _管理画面HTML()
    .setTitle('フォトライブラリー管理');
  SpreadsheetApp.getUi().showSidebar(html);
}

function _管理画面HTML() {
  return HtmlService.createTemplateFromFile('管理画面').evaluate();
}

function 管理画面データを取得する() {
  var ss = _管理対象シート();
  _写真列を保証(_必須タブ(ss, '写真'), ['downloadAllowed', 'updatedAt', 'updatedBy']);
  return {
    spots: _スポット一覧(ss),
    photos: _写真一覧(ss),
    choices: _選択肢(ss),
    pending: _承認待ち一覧(ss),
    scenes: _シーン一覧(ss),
    seasons: _季節一覧(ss),
    today: Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd'),
    sitePhotoBaseUrl: PUBLIC_SITE_URL + 'assets/img/lib/'
  };
}

function 今すぐ公開する() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    throw new Error('GitHubのアクセストークンが未設定です。管理者に「Apps Scriptのスクリプトプロパティに GITHUB_TOKEN を設定してください」とご相談ください。');
  }
  var url = 'https://api.github.com/repos/' + GITHUB_REPO + '/actions/workflows/' + GITHUB_WORKFLOW_FILE + '/dispatches';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 204) {
    throw new Error('GitHubへの反映リクエストに失敗しました（コード ' + code + '）。トークンの権限（workflowスコープ）を確認してください。');
  }
  return { ok: true, message: '公開処理を開始しました。1〜2分ほどで公開サイトに反映されます。' };
}

function ダッシュボード情報を取得する() {
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, '写真');
  var col = _写真列を保証(sh, ['downloadAllowed', 'updatedAt', 'updatedBy']);
  var photos = _写真一覧(ss);
  var spots = _スポット一覧(ss);
  var pending = _承認待ち一覧(ss);

  var validSpotNames = {};
  spots.forEach(function (s) { validSpotNames[s.name] = true; });

  var publishCount = photos.filter(function (p) { return p.publish; }).length;
  var reviewCount = photos.filter(function (p) { return _要確認(p, validSpotNames); }).length;

  var bySpot = {};
  photos.forEach(function (p) {
    var key = p.spot || '未設定';
    bySpot[key] = (bySpot[key] || 0) + 1;
  });
  var spotCounts = Object.keys(bySpot).map(function (k) {
    return { spot: k, count: bySpot[k] };
  }).sort(function (a, b) { return b.count - a.count; });

  var recentUpdates = [];
  if (col.updatedAt !== undefined && sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    rows.forEach(function (r) {
      var updatedAt = String(r[col.updatedAt] || '').trim();
      if (!updatedAt) return;
      recentUpdates.push({
        id: String(r[col.id] || '').trim(),
        title: String(r[col.title] || '').trim(),
        updatedBy: col.updatedBy !== undefined ? String(r[col.updatedBy] || '').trim() : '',
        updatedAt: updatedAt
      });
    });
    recentUpdates.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : (a.updatedAt > b.updatedAt ? -1 : 0); });
    recentUpdates = recentUpdates.slice(0, 10);
  }

  return {
    totalPhotos: photos.length,
    publishCount: publishCount,
    privateCount: photos.length - publishCount,
    reviewCount: reviewCount,
    pendingCount: pending.length,
    spotCount: spots.length,
    spotCounts: spotCounts,
    recentUpdates: recentUpdates,
    lastRun: _GitHub最終実行()
  };
}

// 写真管理タブの「要確認」判定と同じ基準（タイトル未入力・仮のファイル名風・日本語の文字が無い・スポット未分類）
// 「その他」＝あえて特定のスポットに当てはめないという判断なので要確認の対象にしない。
// 空欄・「未分類」＝まだ決めていない状態として要確認のままにする。
// validSpotNames を渡すと、現在の「スポット」タブに無い名前（スポット名の変更・削除・入力ミスで
// 孤立した写真）も検知する。孤立した写真はサイトのスポットギャラリーから静かに消えてしまうため、
// ここで拾って画面に出すことで「気づけないまま公開から漏れる」事故を防ぐ。
function _要確認(p, validSpotNames) {
  var title = String(p.title || '').trim();
  if (!title) return true;
  if (/^(dsc|img|dji|pxl|mov|gopr|p\d{3,}|100_|100-)[-_ ]?\d*/i.test(title)) return true;
  if (!/[぀-ヿ一-鿿]/.test(title)) return true; // ひらがな・カタカナ・漢字が一つも無い
  if (!p.spot || p.spot === '未分類') return true;
  if (p.spot !== 'その他' && validSpotNames && !validSpotNames[p.spot]) return true;
  return false;
}

function _GitHub最終実行() {
  try {
    var url = 'https://api.github.com/repos/' + GITHUB_REPO + '/actions/workflows/' + GITHUB_WORKFLOW_FILE + '/runs?per_page=1&status=success';
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: 'application/vnd.github+json' } });
    if (res.getResponseCode() !== 200) return null;
    var data = JSON.parse(res.getContentText());
    var run = data.workflow_runs && data.workflow_runs[0];
    if (!run) return null;
    return { at: run.updated_at || run.created_at, url: run.html_url };
  } catch (e) {
    return null;
  }
}

function 写真を登録する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, '写真');
  var col = _写真列を保証(sh, ['downloadAllowed', 'updatedAt', 'updatedBy']);
  ['id', 'title', 'spot', 'area', 'driveFileId', 'publish'].forEach(function (key) {
    if (col[key] === undefined) throw new Error('「写真」タブに ' + key + ' 列がありません。');
  });

  var fileId = String(payload.driveFileId || '').trim();
  if (!fileId && payload.file && payload.file.bytes) {
    fileId = _写真ファイルを保存(payload.file, payload.spot);
  }
  if (!fileId) throw new Error('写真ファイル、またはGoogleドライブの共有リンクを指定してください。');

  var title = String(payload.title || '').trim();
  if (!title) throw new Error('タイトルを入力してください。');
  var dupId = _同じタイトルの写真ID(sh, col, title, '');
  if (dupId) throw new Error('同じタイトル「' + title + '」の写真がすでに登録されています（' + dupId + '）。別のタイトルにしてください。');

  var spot = String(payload.spot || '').trim();
  var area = _スポット別エリア(ss)[spot] || String(payload.area || '').trim();
  var id = _次の写真ID(sh, col.id);
  var width = sh.getLastColumn();
  var row = new Array(width).fill('');
  row[col.id] = id;
  row[col.title] = title;
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
  if (col.downloadAllowed !== undefined) row[col.downloadAllowed] = payload.downloadAllowed === false ? 'FALSE' : 'TRUE';
  if (col.updatedBy !== undefined) row[col.updatedBy] = Session.getEffectiveUser().getEmail() || '管理画面';
  if (col.updatedAt !== undefined) row[col.updatedAt] = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd');

  sh.getRange(sh.getLastRow() + 1, 1, 1, width).setValues([row]);
  return { ok: true, message: id + ' を登録しました。公開するには承認してください。', id: id };
}

function 承認状態を変更する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  _承認状態を適用する(ss, {}, payload);
  return { ok: true, message: payload.approved ? '公開待ちにしました。次回の自動更新で反映されます。' : '非公開にしました。' };
}

// 複数件をまとめて承認・非公開にする（承認タブでのチェックボックス一括操作用）。
// シートごとにタブ・列番号をキャッシュして使い回すことで、件数が多くても1回の実行で終わらせる。
function 複数の承認状態を変更する(items) {
  items = items || [];
  var ss = _管理対象シート();
  var cache = {};
  var ok = 0, fails = [];
  items.forEach(function (item) {
    try {
      _承認状態を適用する(ss, cache, item);
      ok++;
    } catch (e) {
      fails.push((item.id || item.rowNumber || '?') + '：' + e.message);
    }
  });
  return {
    ok: true,
    message: ok + '件を更新しました。' + (fails.length ? '（失敗 ' + fails.length + '件：' + fails.join(' / ') + '）' : '次回の自動更新で反映されます。')
  };
}

// 複数の写真の「表示場所」タグ（例：ダウンロード制限）をまとめて付ける・外す
// （写真管理タブのチェックボックス一括操作用）。他のタグは触らず、指定した1つだけを増減する。
function 複数の写真の表示場所を変更する(ids, role, add) {
  ids = ids || [];
  role = String(role || '').trim();
  if (!role) throw new Error('対象のタグが指定されていません。');
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, '写真');
  var col = _写真列を保証(sh, ['downloadAllowed', 'updatedAt', 'updatedBy']);
  if (col.roles === undefined) throw new Error('「写真」タブに roles 列がありません。');
  var ok = 0, fails = [];
  ids.forEach(function (id) {
    try {
      var rowNumber = _行を探す(sh, col.id, id);
      if (!rowNumber) throw new Error('写真が見つかりません');
      var current = String(sh.getRange(rowNumber, col.roles + 1).getValue() || '')
        .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var has = current.indexOf(role) !== -1;
      if (add && !has) current.push(role);
      if (!add && has) current = current.filter(function (r) { return r !== role; });
      sh.getRange(rowNumber, col.roles + 1).setValue(current.join(','));
      if (col.updatedBy !== undefined) sh.getRange(rowNumber, col.updatedBy + 1).setValue(Session.getEffectiveUser().getEmail() || '管理画面');
      if (col.updatedAt !== undefined) sh.getRange(rowNumber, col.updatedAt + 1).setValue(Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd'));
      ok++;
    } catch (e) {
      fails.push(id + '：' + e.message);
    }
  });
  return {
    ok: true,
    message: ok + '件を更新しました。' + (fails.length ? '（失敗 ' + fails.length + '件：' + fails.join(' / ') + '）' : '次回の自動更新で反映されます。')
  };
}

function _承認状態を適用する(ss, cache, payload) {
  var sheetName = String(payload.sheet || '');
  if (!cache[sheetName]) {
    var sh = _必須タブ(ss, sheetName);
    cache[sheetName] = { sh: sh, col: _列番号(sh) };
  }
  var sh = cache[sheetName].sh, col = cache[sheetName].col;
  var id = String(payload.id || '').trim();
  // 「写真」タブはidが必ず入っているため、行番号のズレを避けて毎回探し直す。
  // 「フォーム回答」タブは回答者がidを入力しないため空のことが多く、その場合はやむを得ず
  // ブラウザから渡された行番号をそのまま使う（承認タブは開いてすぐ操作することが多く、
  // 「写真管理」の削除ほど間隔が空かないため実害は低い）。
  var rowNumber = (sheetName === '写真' && id) ? _行を探す(sh, col.id, id) : 0;
  if (!rowNumber) rowNumber = Number(payload.rowNumber || 0);
  if (!rowNumber || rowNumber < 2) throw new Error('対象行が見つかりません。');

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
}

function 写真を保存する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, '写真');
  var col = _写真列を保証(sh, ['downloadAllowed', 'updatedAt', 'updatedBy']);
  var id = String(payload.id || '').trim();
  // ブラウザが持っている行番号は、他の人の編集や時間経過でずれている可能性があるため信用しない。
  // idから毎回その場で正しい行を探し直す（idが渡された場合のみ、渡された行番号は最後の保険）。
  var rowNumber = id ? _行を探す(sh, col.id, id) : 0;
  if (!rowNumber) rowNumber = Number(payload.rowNumber || 0);
  if (!rowNumber || rowNumber < 2) throw new Error('写真が見つかりません。');

  var updates = {
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    tags: _配列文字列(payload.tags),
    roles: _配列文字列(payload.roles),
    sortOrder: payload.sortOrder === '' ? '' : Number(payload.sortOrder || 0),
    publish: payload.publish ? 'TRUE' : 'FALSE',
    downloadAllowed: payload.downloadAllowed ? 'TRUE' : 'FALSE'
  };
  if (payload.spot !== undefined) {
    var newSpot = String(payload.spot || '').trim();
    if (!newSpot) throw new Error('スポットを選んでください。');
    updates.spot = newSpot;
    updates.area = _スポット別エリア(ss)[newSpot] || '';
  }
  if (!updates.title) throw new Error('キャプションを入力してください。');
  var selfId = id || String(sh.getRange(rowNumber, col.id + 1).getValue() || '').trim();
  var dupId = _同じタイトルの写真ID(sh, col, updates.title, selfId);
  if (dupId) throw new Error('同じタイトル「' + updates.title + '」の写真がすでにあります（' + dupId + '）。別のタイトルにしてください。');

  Object.keys(updates).forEach(function (key) {
    if (col[key] !== undefined) sh.getRange(rowNumber, col[key] + 1).setValue(updates[key]);
  });
  if (col.updatedBy !== undefined) sh.getRange(rowNumber, col.updatedBy + 1).setValue(Session.getEffectiveUser().getEmail() || '管理画面');
  if (col.updatedAt !== undefined) sh.getRange(rowNumber, col.updatedAt + 1).setValue(Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd'));
  return { ok: true, message: '写真情報を保存しました。次回の自動更新で反映されます。' };
}

function 写真を削除する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, '写真');
  var col = _列番号(sh);
  var id = String(payload.id || '').trim();
  // 削除は取り消せない操作なので、ブラウザが持っている行番号は信用せず、
  // idから「今まさに」その行がどこにあるかを探し直してから消す。
  // （他の人の編集や時間経過で行番号がずれていると、無関係な写真が消えてしまうため）
  var rowNumber = id ? _行を探す(sh, col.id, id) : 0;
  if (!rowNumber) rowNumber = Number(payload.rowNumber || 0);
  if (!rowNumber || rowNumber < 2) throw new Error('写真が見つかりません。');

  var deletedId = String(sh.getRange(rowNumber, col.id + 1).getValue() || '').trim() || id;
  if (id && deletedId !== id) throw new Error('削除対象の特定に失敗しました（安全のため中止しました）。もう一度お試しください。');
  var deletedDriveId = col.driveFileId !== undefined
    ? String(sh.getRange(rowNumber, col.driveFileId + 1).getValue() || '').trim() : '';
  sh.deleteRow(rowNumber);
  // 「フォルダ取り込み」を使っている場合、写真ファイルの実体はドライブに残ったままなので、
  // 除外リストに控えておかないと次の自動巡回で「新しい写真」として再登録されてしまう。
  if (deletedDriveId) _取り込み除外に追加する(ss, deletedDriveId, deletedId);
  return { ok: true, message: (deletedId || '写真') + ' を削除しました。写真ファイルの実体はGoogleドライブに残っていますが、'
    + '「フォルダ取り込み」で再登録されることはありません。' };
}

/** 「フォルダ取り込み」が同じ写真を二度と拾わないよう、削除したドライブファイルIDを控えておく。
 * 「取り込み除外」タブが無い環境（フォルダ取り込みを使っていない）でも壊れないよう、無ければ作る。 */
function _取り込み除外に追加する(ss, driveFileId, deletedId) {
  var sh = ss.getSheetByName('取り込み除外');
  if (!sh) {
    sh = ss.insertSheet('取り込み除外');
    sh.getRange(1, 1, 1, 3).setValues([['driveFileId', '削除した写真ID', '削除日']]);
  }
  sh.appendRow([driveFileId, deletedId || '', Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd')]);
}

function スポットを追加する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sh = _必須タブ(ss, 'スポット');
  var col = _列番号(sh);
  ['id', 'name'].forEach(function (key) {
    if (col[key] === undefined) throw new Error('「スポット」タブに ' + key + ' 列がありません。');
  });

  var id = String(payload.id || '').trim().toLowerCase();
  var name = String(payload.name || '').trim();
  if (!name) throw new Error('スポット名を入力してください。');
  if (!id) throw new Error('IDを入力してください（例：shrine）。');
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('IDは半角英小文字・数字・ハイフンのみ使えます。');
  if (_行を探す(sh, col.id, id)) throw new Error('このIDはすでに使われています: ' + id);

  var width = sh.getLastColumn();
  var row = new Array(width).fill('');
  row[col.id] = id;
  row[col.name] = name;
  if (col.area !== undefined) row[col.area] = String(payload.area || '').trim();
  if (col.catch !== undefined) row[col.catch] = String(payload.catch || '').trim();
  if (col.publish !== undefined) row[col.publish] = 'FALSE';
  if (col.updatedBy !== undefined) row[col.updatedBy] = Session.getEffectiveUser().getEmail() || '管理画面';
  if (col.updatedAt !== undefined) row[col.updatedAt] = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd');

  sh.getRange(sh.getLastRow() + 1, 1, 1, width).setValues([row]);
  return { ok: true, message: '「' + name + '」を追加しました。まだ非公開です。説明文や写真を入力してから公開してください。', id: id };
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
  if (DEFAULT_SHEET_ID) return SpreadsheetApp.openById(DEFAULT_SHEET_ID);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('管理対象のスプレッドシートIDが未設定です。');
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

function _写真列を保証(sh, names) {
  var col = _列番号(sh);
  names.forEach(function (name) {
    if (col[name] !== undefined) return;
    var next = sh.getLastColumn() + 1;
    sh.getRange(1, next).setValue(name);
    if (name === 'downloadAllowed' && sh.getLastRow() > 1) {
      sh.getRange(2, next, sh.getLastRow() - 1, 1).setValue('TRUE');
    }
    col[name] = next - 1;
  });
  return _列番号(sh);
}

function _スポット一覧(ss) {
  var sh = _必須タブ(ss, 'スポット');
  var col = _列番号(sh);
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
  // 先に rowNumber を確定させてからフィルタする（filter→map の順だと、
  // 空行がフィルタで取り除かれた分だけ後続行の rowNumber がずれてしまうため）。
  return rows.map(function (r, i) {
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
  }).filter(function (s) { return s.name; });
}

function _写真一覧(ss) {
  var sh = _必須タブ(ss, '写真');
  var col = _列番号(sh);
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
  return rows.map(function (r, i) {
    var title = String(r[col.title] || '').trim();
    var spot = String(r[col.spot] || '').trim();
    var id = String(r[col.id] || '').trim();
    var driveFileId = col.driveFileId !== undefined ? String(r[col.driveFileId] || '').trim() : '';
    return {
      rowNumber: i + 2,
      id: id,
      title: title,
      spot: spot,
      area: col.area !== undefined ? String(r[col.area] || '').trim() : '',
      season: col.season !== undefined ? String(r[col.season] || '').trim() : '',
      tags: col.tags !== undefined ? String(r[col.tags] || '').trim() : '',
      roles: col.roles !== undefined ? String(r[col.roles] || '').trim() : '',
      sortOrder: col.sortOrder !== undefined ? String(r[col.sortOrder] || '').trim() : '',
      description: col.description !== undefined ? String(r[col.description] || '').trim() : '',
      publish: col.publish === undefined || String(r[col.publish] || 'TRUE').toUpperCase() === 'TRUE',
      downloadAllowed: col.downloadAllowed === undefined || String(r[col.downloadAllowed] || 'TRUE').toUpperCase() === 'TRUE',
      previewUrl: _写真プレビューURL(id, driveFileId),
      label: id + ' / ' + (title || 'キャプション未入力') + ' / ' + (spot || 'スポット未設定')
    };
  }).filter(function (p) { return p.id; });
}

function _写真プレビューURL(id, driveFileId) {
  var fid = _ドライブIDを抜く(driveFileId);
  if (fid) return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fid) + '&sz=w360';
  if (id) return PUBLIC_SITE_URL + 'assets/img/lib/' + encodeURIComponent(id) + '-thumb.jpg';
  return '';
}

function _ドライブIDを抜く(value) {
  value = String(value || '').trim();
  if (!value) return '';
  var m = value.match(/\/d\/([A-Za-z0-9_-]{20,})/) || value.match(/[?&]id=([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(value) ? value : '';
}

function _シーン一覧(ss) {
  var sh = ss.getSheetByName('シーン');
  if (!sh) return [];
  var col = _列番号(sh);
  if (col.label === undefined) return [];
  var out = [];
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
  rows.forEach(function (r, i) {
    var label = String(r[col.label] || '').trim();
    if (!label) return;
    out.push({
      rowNumber: i + 2,
      label: label,
      photoId: col.photoId !== undefined ? String(r[col.photoId] || '').trim() : '',
      sortOrder: col.sortOrder !== undefined ? String(r[col.sortOrder] || '').trim() : ''
    });
  });
  return out;
}

function _季節一覧(ss) {
  var sh = ss.getSheetByName('季節');
  if (!sh) return [];
  var col = _列番号(sh);
  if (col.ja === undefined) return [];
  var out = [];
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];
  rows.forEach(function (r, i) {
    var ja = String(r[col.ja] || '').trim();
    if (!ja) return;
    out.push({
      rowNumber: i + 2,
      ja: ja,
      photoId: col.photoId !== undefined ? String(r[col.photoId] || '').trim() : '',
      sortOrder: col.sortOrder !== undefined ? String(r[col.sortOrder] || '').trim() : ''
    });
  });
  return out;
}

function シーン季節の写真を保存する(payload) {
  payload = payload || {};
  var ss = _管理対象シート();
  var sheetName = payload.type === '季節' ? '季節' : 'シーン';
  var sh = _必須タブ(ss, sheetName);
  var col = _列番号(sh);
  var rowNumber = Number(payload.rowNumber || 0);
  if (!rowNumber || rowNumber < 2) throw new Error('対象が見つかりません。');
  if (col.photoId === undefined) throw new Error('「' + sheetName + '」タブに photoId 列がありません。');

  var photoId = String(payload.photoId || '').trim();
  if (photoId) {
    var photoSh = _必須タブ(ss, '写真');
    var photoCol = _列番号(photoSh);
    if (!_行を探す(photoSh, photoCol.id, photoId)) throw new Error('写真ID「' + photoId + '」が見つかりません。');
  }
  sh.getRange(rowNumber, col.photoId + 1).setValue(photoId);
  return { ok: true, message: '代表写真を更新しました。' };
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
  // 実際によく使われているタグを中心に、季節・定番の候補を加えた一覧（頻度: 実データ調査ベース）
  out.tags = [
    '海', '夕陽', '朝日', '空撮', '岩', '断崖', '島', '砂浜', 'さくら貝', '星空',
    '神社', '文化施設', '名所旧跡', '建築', '庭園', '遊覧船', '屋内', 'ベンチ',
    'ライトアップ', '夜景', 'イルミネーション', '体験', 'お土産', 'キャンプ', '義経',
    '桜', '花', '青空', '雪', '紅葉', '祭り'
  ];
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
      var id = String(r[pc.id] || '').trim();
      var driveFileId = pc.driveFileId !== undefined ? String(r[pc.driveFileId] || '').trim() : '';
      // updatedBy が空＝まだ誰も手を触れていない新規登録。値があれば、過去に一度確認・保存された上で非公開にされている写真。
      var isNew = pc.updatedBy === undefined || !String(r[pc.updatedBy] || '').trim();
      out.push({
        sheet: '写真',
        rowNumber: i + 2,
        id: id,
        title: String(r[pc.title] || '').trim(),
        spot: String(r[pc.spot] || '').trim(),
        note: String(r[pc.description] || '').trim(),
        previewUrl: _写真プレビューURL(id, driveFileId),
        isNew: isNew,
        updatedAt: pc.updatedAt !== undefined ? _日付文字列(r[pc.updatedAt]) : ''
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
      var driveCol = fc['driveFileId'] !== undefined ? fc['driveFileId'] : fc['写真'];
      // 承認列が空＝まだ確認していない新規投稿。「FALSE」が明示的に入っていれば、確認した上で非公開のままにした投稿。
      var isNewForm = String(r[fc['承認']] || '').trim() === '';
      out.push({
        sheet: 'フォーム回答',
        rowNumber: i + 2,
        id: String(r[fc.id] || '').trim(),
        title: String(r[titleCol] || '').trim(),
        spot: String(r[spotCol] || '').trim(),
        note: String(r[fc['備考']] || '').trim(),
        previewUrl: driveCol !== undefined ? _写真プレビューURL('', String(r[driveCol] || '').trim()) : '',
        isNew: isNewForm,
        updatedAt: fc['タイムスタンプ'] !== undefined ? _日付文字列(r[fc['タイムスタンプ']]) : ''
      });
    });
  }
  // 登録日の新しい順に並べる（同じ日付の中では元の並びを保つ）。日付が分からないものは末尾へ。
  out.forEach(function (item, i) { item._order = i; });
  out.sort(function (a, b) {
    if (a.updatedAt !== b.updatedAt) {
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    }
    return a._order - b._order;
  });
  out.forEach(function (item) { delete item._order; });
  return out;
}

// 日付らしき値（Dateオブジェクトまたは文字列）を yyyy-MM-dd の文字列に揃える
function _日付文字列(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'JST', 'yyyy-MM-dd');
  }
  return String(v).trim().slice(0, 10);
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

// 「写真」タブの中から、指定したタイトルと同じ（大文字小文字・前後の空白を無視して一致）写真IDを探す。
// selfId に一致する行は自分自身なので除外する。
function _同じタイトルの写真ID(sh, col, title, selfId) {
  var target = String(title || '').trim().toLowerCase();
  if (!target || sh.getLastRow() <= 1) return '';
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < rows.length; i++) {
    var rowId = String(rows[i][col.id] || '').trim();
    if (rowId && rowId === selfId) continue;
    var rowTitle = String(rows[i][col.title] || '').trim().toLowerCase();
    if (rowTitle && rowTitle === target) return rowId;
  }
  return '';
}

function _写真ファイルを保存(file, spotName) {
  // PHOTO_FOLDER_ID は「フォルダ取り込み.gs」など別のスクリプトで設定されている想定だが、
  // 未設定でも写真登録自体は止めず、マイドライブのルートに保存する（そこにスポットごとの
  // フォルダを作る）。整理された場所に保存したい場合は PHOTO_FOLDER_ID を設定してください。
  var root = (typeof PHOTO_FOLDER_ID !== 'undefined' && PHOTO_FOLDER_ID)
    ? DriveApp.getFolderById(PHOTO_FOLDER_ID)
    : DriveApp.getRootFolder();
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
