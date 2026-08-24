/**
 * SHIKA PHOTO LIBRARY ― ドライブのフォルダを見張って、写真をシートに登録する
 *
 * やること
 *   1. 写真フォルダの中の「スポット別フォルダ」を巡回する
 *   2. 新しく入った画像を見つけて、運用シートの「写真」タブに1行追加する
 *   3. その画像の共有設定を「リンクを知っている全員が閲覧可」に自動で変える
 *
 * 追加された行は publish が FALSE（非公開）です。
 * 内容を確認して TRUE に変えると、次の自動更新でサイトに載ります。
 *
 * 設置方法は「フォルダ投げ込み設置手順.md」をご覧ください。
 */

// =====================================================================
// 設定 ― ここだけ書き換えてください
// =====================================================================

/** 運用シートのID（シートを開いたときのURLの /d/ と /edit の間） */
var SHEET_ID = '1A9_xzFMdD-UhKyo_a7xJ2h-5cM-orZ_giXX41ZiKT3Y';

/** 写真フォルダのID（フォルダを開いたときのURLの、最後の部分） */
var PHOTO_FOLDER_ID = '1r6CDHXqvVNaQKhydeB1rQAZNR441cJLR';

/** 運用シートのタブ名（通常は変更不要） */
var SHEET_PHOTOS = '写真';
var SHEET_SPOTS  = 'スポット';

/** 追加した写真を最初から公開するか（false = 確認してから公開） */
var PUBLISH_ON_ADD = false;

/** 新しく振るIDの頭文字 */
var ID_PREFIX = 'P';


// =====================================================================
// メイン ― 1時間ごとに自動で動きます
// =====================================================================
function フォルダを確認する() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_PHOTOS);
  if (!sh) throw new Error('「' + SHEET_PHOTOS + '」タブが見つかりません。');

  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = {};
  head.forEach(function (h, i) { col[String(h).trim()] = i; });
  ['id', 'title', 'spot', 'area', 'driveFileId', 'publish'].forEach(function (k) {
    if (col[k] === undefined) throw new Error('「写真」タブに ' + k + ' 列がありません。');
  });

  var rows = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues() : [];

  // すでに登録済みのファイルIDと、使用済みのID番号を控える
  var known = {}, maxNo = 0;
  rows.forEach(function (r) {
    var fid = String(r[col.driveFileId] || '').trim();
    if (fid) known[fid] = true;
    var m = String(r[col.id] || '').match(/^([A-Za-z]*)(\d+)$/);
    if (m) maxNo = Math.max(maxNo, parseInt(m[2], 10));
  });
  // 管理画面から一度「削除」した写真は、ファイル自体はドライブに残るため、
  // 除外リストに載っているファイルIDも「登録済み」として扱い、二度と取り込まない。
  _除外済みIDを読む(ss).forEach(function (fid) { known[fid] = true; });

  // スポット名 → エリア名 の対応表
  var areaOf = {};
  var sp = ss.getSheetByName(SHEET_SPOTS);
  if (sp && sp.getLastRow() > 1) {
    var sHead = sp.getRange(1, 1, 1, sp.getLastColumn()).getValues()[0];
    var ni = sHead.indexOf('name'), ai = sHead.indexOf('area');
    sp.getRange(2, 1, sp.getLastRow() - 1, sp.getLastColumn()).getValues().forEach(function (r) {
      if (r[ni]) areaOf[String(r[ni]).trim()] = String(r[ai] || '').trim();
    });
  }

  var root = DriveApp.getFolderById(PHOTO_FOLDER_ID);
  var added = [], skipped = 0;

  // スポット別フォルダを順に見る
  var folders = root.getFolders();
  while (folders.hasNext()) {
    var f = folders.next();
    added = added.concat(_フォルダ内を読む(f, f.getName(), known, areaOf));
  }
  // フォルダ直下に置かれた写真も拾う（スポットは空欄になります）
  added = added.concat(_フォルダ内を読む(root, '', known, areaOf));

  if (!added.length) {
    Logger.log('新しい写真はありませんでした。');
    return;
  }

  // シートに書き込む
  var width = sh.getLastColumn();
  var newRows = added.map(function (a) {
    var row = new Array(width).fill('');
    maxNo += 1;
    row[col.id] = ID_PREFIX + ('0000' + maxNo).slice(-4);
    row[col.title] = a.title;
    row[col.spot] = a.spot;
    row[col.area] = a.area;
    row[col.driveFileId] = a.fileId;
    row[col.publish] = PUBLISH_ON_ADD ? 'TRUE' : 'FALSE';
    if (col.focus !== undefined) row[col.focus] = '中央';
    if (col.photographer !== undefined) row[col.photographer] = '志賀町';
    if (col.copyright !== undefined) row[col.copyright] = '© 志賀町';
    if (col.updatedBy !== undefined) row[col.updatedBy] = '自動取り込み';
    if (col.updatedAt !== undefined) {
      row[col.updatedAt] = Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd');
    }
    if (col.sortOrder !== undefined) row[col.sortOrder] = 9000 + maxNo;
    return row;
  });
  sh.getRange(sh.getLastRow() + 1, 1, newRows.length, width).setValues(newRows);

  Logger.log(added.length + '枚を追加しました。');
  _お知らせメール(added);
}


/** 管理画面で削除された写真の、除外リスト（「取り込み除外」タブ）を読む。
 * タブが無い場合（管理画面の削除機能をまだ一度も使っていない）は空リストを返す。 */
function _除外済みIDを読む(ss) {
  var sh = ss.getSheetByName('取り込み除外');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0] || '').trim(); })
    .filter(Boolean);
}

/** フォルダ1つ分の画像を読む */
function _フォルダ内を読む(folder, spotName, known, areaOf) {
  var out = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (file.getMimeType().indexOf('image/') !== 0) continue;   // 画像以外は無視
    var id = file.getId();
    if (known[id]) continue;                                     // 登録済みは飛ばす
    known[id] = true;

    // サイトから読めるように、共有設定を自動で変える（設定忘れ防止）
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('共有設定を変更できませんでした: ' + file.getName() + ' / ' + e);
    }

    out.push({
      fileId: id,
      title: file.getName().replace(/\.[^.]+$/, ''),   // 拡張子を除いたファイル名
      spot: spotName,
      area: areaOf[spotName] || ''
    });
  }
  return out;
}


/** 追加があったときにお知らせメールを送る */
function _お知らせメール(added) {
  try {
    var to = Session.getEffectiveUser().getEmail();
    var url = SpreadsheetApp.openById(SHEET_ID).getUrl();
    var list = added.map(function (a) {
      return '・' + a.title + '（' + (a.spot || 'スポット未設定') + '）';
    }).join('\n');
    MailApp.sendEmail(to,
      '[フォトライブラリー] 写真が' + added.length + '枚 追加されました',
      '新しい写真がシートに登録されました。\n\n' + list +
      '\n\n内容を確認して、公開してよければ publish 欄を TRUE に変えてください。\n' + url);
  } catch (e) {
    Logger.log('メールを送れませんでした: ' + e);
  }
}


// =====================================================================
// 準備用 ― 最初に1回だけ実行するもの
// =====================================================================

/** スポット別のフォルダをまとめて作る */
function スポットのフォルダを作る() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sp = ss.getSheetByName(SHEET_SPOTS);
  if (!sp) throw new Error('「' + SHEET_SPOTS + '」タブが見つかりません。');
  var head = sp.getRange(1, 1, 1, sp.getLastColumn()).getValues()[0];
  var ni = head.indexOf('name');
  var root = DriveApp.getFolderById(PHOTO_FOLDER_ID);

  var made = [];
  sp.getRange(2, 1, sp.getLastRow() - 1, sp.getLastColumn()).getValues().forEach(function (r) {
    var name = String(r[ni] || '').trim();
    if (!name) return;
    if (root.getFoldersByName(name).hasNext()) return;
    root.createFolder(name);
    made.push(name);
  });
  Logger.log(made.length ? '作成: ' + made.join(' / ') : 'すでに揃っています。');
}

/** 1時間ごとの自動実行をオンにする */
function 自動実行をオンにする() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'フォルダを確認する') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('フォルダを確認する').timeBased().everyHours(1).create();
  Logger.log('1時間ごとに自動で確認します。');
}

/** 自動実行を止める */
function 自動実行をオフにする() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'フォルダを確認する') ScriptApp.deleteTrigger(t);
  });
  Logger.log('自動実行を止めました。');
}
