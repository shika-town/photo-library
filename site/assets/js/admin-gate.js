/* =====================================================================
   SHIKA PHOTO LIBRARY  ―  admin-gate.js
   ヘッダー／ドロワーの「管理者ページ」リンク：合言葉を入力すると、
   管理画面（Google Apps Script）を新しいタブで開く。
   一度正しく入力したブラウザ（この端末のこのブラウザ）では、
   次回からは確認なしですぐ開く。

   ※ これは一般の来訪者やいたずらの誤操作を防ぐための簡易な確認であり、
      本当のセキュリティ対策ではない（ページのソースを見ればURLも分かる）。
      アクセスできる人を厳密に絞りたい場合は、Apps Script 側の
      デプロイ設定（アクセスできるユーザー）で制限してください。
   ===================================================================== */
(function () {
  'use strict';

  var ADMIN_URL = 'https://script.google.com/macros/s/AKfycbyudf6_QNYycyyauow4Rm0fWwbMUUfYEgqAJgIl0w5cLfMXjKgB7HJAlmIvkfhK2Nn4/exec';
  var PASSWORD  = 'shika17384';
  var STORE_KEY = 'splAdminUnlocked';

  function isUnlocked() {
    try { return localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  }
  function unlock() {
    try { localStorage.setItem(STORE_KEY, '1'); } catch (e) { /* プライベートブラウズ等では諦める */ }
  }
  function openAdmin() {
    window.open(ADMIN_URL, '_blank', 'noopener');
  }

  var modal, input, error, form;

  function buildModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'adminGateModal';
    modal.innerHTML =
      '<div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="adminGateTitle">' +
        '<h2 class="modal__title" id="adminGateTitle">管理者ページ</h2>' +
        '<p class="admingate__lead">担当者の合言葉を入力してください。</p>' +
        '<form id="adminGateForm" novalidate>' +
          '<input type="password" id="adminGatePassword" class="admingate__input" placeholder="合言葉" autocomplete="off" inputmode="text">' +
          '<p class="admingate__error" id="adminGateError" hidden>合言葉が違います。</p>' +
          '<div class="modal__actions">' +
            '<button type="button" class="modal__btn modal__btn--ghost" id="adminGateCancel">キャンセル</button>' +
            '<button type="submit" class="modal__btn modal__btn--primary">入る</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(modal);

    input = modal.querySelector('#adminGatePassword');
    error = modal.querySelector('#adminGateError');
    form  = modal.querySelector('#adminGateForm');

    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('#adminGateCancel').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value === PASSWORD) {
        unlock();
        close();
        openAdmin();
      } else {
        error.hidden = false;
        input.value = '';
        input.focus();
      }
    });
  }

  function open() {
    buildModal();
    error.hidden = true;
    input.value = '';
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () { input.focus(); }, 60);
  }
  function close() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-admin-gate]');
    if (!el) return;
    e.preventDefault();
    if (isUnlocked()) { openAdmin(); return; }
    open();
  });
})();
