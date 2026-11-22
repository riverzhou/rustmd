// Local relative script; exercises rmd MIME/CSP support and updates the page
// status line so script execution is visible (not just an invisible dataset).
document.body.dataset.localScript = 'yes';
var localStatus = document.getElementById('local-status');
if (localStatus) {
  localStatus.textContent = '本地脚本：已执行';
  localStatus.classList.add('is-ok');
}
