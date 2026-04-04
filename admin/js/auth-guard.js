
(function () {

  document.documentElement.style.visibility = 'hidden';

  var session = null;
  try {
    session = JSON.parse(localStorage.getItem('arps_admin_session') || 'null');
  } catch (_) {}

  if (!session || !session.authenticated) {

    window.location.replace('./index.html');
    return;
  }


  document.documentElement.style.visibility = '';
})();
