/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  search-core.js
   トップページ（home-search.js）と検索結果ページ（search.js）で共通の検索ルール。
   入力された語と写真側の文字を「同じ規則」でそろえてから照合します。

     ・全角／半角、英字の大文字／小文字、前後の空白をそろえる
     ・半角／全角の空白で区切った複数語は AND 検索
     ・「夕日／夕陽」「桜貝／さくら貝」の表記ゆれを同じ語として扱う
     ・検索対象は 写真名・スポット・エリア・季節・ジャンル・タグ
     ・語と各絞り込み（スポット／ジャンル／用途／季節）はすべて AND
   ===================================================================== */
(function () {
  'use strict';

  var SEASONS = ['春', '夏', '秋', '冬'];

  function normalize(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC').toLowerCase()
      .replace(/夕日/g, '夕陽')
      .replace(/桜貝/g, 'さくら貝')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 季節は ['春','冬'] のような配列で持つ。古い '春,冬' の文字列が来ても配列にそろえる。
  function seasonsOf(p) {
    var v = p.season;
    var items = Array.isArray(v) ? v : String(v || '').split(/[,、，/／・\s]+/);
    return SEASONS.filter(function (s) { return items.indexOf(s) !== -1; });
  }

  // 写真ごとに、検索対象の文字を1本にまとめて正規化しておく（初回だけ計算）。
  function haystack(p) {
    if (p._hay == null) {
      p._hay = normalize([p.title, p.spot, p.area, p.genre, seasonsOf(p).join(' ')]
        .concat(p.tags || []).join(' '));
    }
    return p._hay;
  }

  function hasTag(p, tag) {
    var t = normalize(tag);
    return (p.tags || []).some(function (x) { return normalize(x) === t; });
  }

  // cond: { q, spot, genre, use, season, tag, tags[] }（空の項目は無視）
  function filter(photos, cond) {
    var words = normalize(cond.q).split(' ').filter(Boolean);
    var tags = (cond.tags || []).filter(Boolean);
    return photos.filter(function (p) {
      if (cond.spot && p.spot !== cond.spot) return false;
      if (cond.genre && p.genre !== cond.genre) return false;
      if (cond.use && !hasTag(p, cond.use)) return false;
      if (cond.season && seasonsOf(p).indexOf(cond.season) === -1) return false;
      if (cond.tag && !hasTag(p, cond.tag)) return false;
      for (var i = 0; i < tags.length; i++) { if (!hasTag(p, tags[i])) return false; }
      if (words.length) {
        var h = haystack(p);
        for (var j = 0; j < words.length; j++) { if (h.indexOf(words[j]) === -1) return false; }
      }
      return true;
    });
  }

  window.SPLSearch = {
    SEASONS: SEASONS,
    normalize: normalize,
    seasonsOf: seasonsOf,
    filter: filter
  };
})();
