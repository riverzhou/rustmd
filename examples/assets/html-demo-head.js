// Deferred head script: after asset inlining it must still run when <body>
// exists, and it must not lose the document wrappers (html lang/body class).
(function () {
  var body = document.body;
  if (!body) return;
  body.dataset.headDefer = 'body-ok';
  var status = document.getElementById('defer-status');
  if (status) {
    status.textContent = '延迟脚本：已执行';
    status.classList.add('is-ok');
  }
})();
