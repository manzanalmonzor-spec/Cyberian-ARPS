/**
 * Admin Auth Guard (safe version)
 * - Hides the page while checking session
 * - Redirects to login if not authenticated
 * - Does NOT destroy or modify any DOM content
 */
(function () {
  // Hide page until auth is confirmed (prevents flash of content)
  document.documentElement.style.visibility = 'hidden';

  var session = null;
  try {
    session = JSON.parse(localStorage.getItem('arps_admin_session') || 'null');
  } catch (_) {}

  if (!session || !session.authenticated) {
    // Not logged in — redirect to login page
    window.location.replace('./index.html');
    return; // stop here, page stays hidden during redirect
  }

  // Authenticated — show the page
  document.documentElement.style.visibility = '';
})();
