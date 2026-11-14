// Deferred head script: after asset inlining it must still run when <body>
// exists, and it must not lose the document wrappers (html lang/body class).
document.body.dataset.headDefer = document.body ? 'body-ok' : 'body-null';
