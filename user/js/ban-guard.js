import { db } from "../../firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

(function() {
  var session = null;
  try { session = JSON.parse(localStorage.getItem('arps_session') || 'null'); } catch(e) {}
  if (!session || !session.email) return;

  var email = (session.email || '').trim().toLowerCase();
  if (!email) return;

  onSnapshot(doc(db, "bannedEmails", email), function(snap) {

    if (snap.metadata.fromCache) return;

    if (snap.exists()) {
      var data = snap.data();
      showBanCard(data.reason || 'Your account has been permanently banned by the administrator.');
    }
  });

  function showBanCard(reason) {
    if (document.getElementById('arps-ban-overlay')) return;


    var style = document.createElement('style');
    style.textContent =
      'html.arps-banned, html.arps-banned body { overflow:hidden!important; position:fixed!important; width:100%!important; height:100%!important; top:0!important; left:0!important; touch-action:none!important; overscroll-behavior:none!important; -webkit-overflow-scrolling:auto!important; }' +
      'html.arps-banned *, html.arps-banned body * { overflow:hidden!important; overscroll-behavior:none!important; touch-action:none!important; }' +
      '#arps-ban-overlay { touch-action:auto!important; }' +
      '#arps-ban-overlay button { touch-action:auto!important; cursor:pointer!important; }';
    document.head.appendChild(style);
    document.documentElement.classList.add('arps-banned');

    var overlay = document.createElement('div');
    overlay.id = 'arps-ban-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s ease;overflow:hidden;';

    var safeReason = reason.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:24px;width:90%;max-width:380px;padding:28px 24px;text-align:center;transform:scale(0.95);transition:transform 0.3s ease;box-shadow:0 25px 50px -12px rgba(0,0,0,0.35);">' +
        '<div style="width:64px;height:64px;border-radius:20px;background:#FEE2E2;color:#DC2626;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;box-shadow:0 8px 24px rgba(220,38,38,0.15);">' +
          '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' +
        '</div>' +
        '<h3 style="font-size:20px;font-weight:800;color:#991B1B;margin:0 0 8px;font-family:Inter,sans-serif;">Account Banned</h3>' +
        '<p style="font-size:14px;color:#64748B;margin:0 0 16px;line-height:1.6;font-family:Inter,sans-serif;">Your account has been permanently banned by the administrator.</p>' +
        '<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:12px 16px;margin-bottom:20px;text-align:left;">' +
          '<p style="font-size:11px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Reason</p>' +
          '<p style="font-size:13px;color:#DC2626;margin:0;line-height:1.5;font-weight:600;">' + safeReason + '</p>' +
        '</div>' +
        '<button id="arps-ban-signout" style="width:100%;padding:14px;border-radius:14px;border:none;background:#DC2626;color:#fff;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(220,38,38,0.4);font-family:Inter,sans-serif;">Sign Out</button>' +
      '</div>';

    document.body.appendChild(overlay);

    // Block touchmove globally
    document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    // Force scroll to top if anything tries to scroll
    window.addEventListener('scroll', function() { window.scrollTo(0, 0); }, true);

    requestAnimationFrame(function() {
      overlay.style.opacity = '1';
      overlay.firstElementChild.style.transform = 'scale(1)';
    });

    document.getElementById('arps-ban-signout').addEventListener('click', function() {
      localStorage.removeItem('arps_session');
      window.location.href = 'loginpage.html';
    });

    // Auto force logout after 10 seconds
    setTimeout(function() {
      localStorage.removeItem('arps_session');
      window.location.href = 'loginpage.html';
    }, 10000);
  }
})();
