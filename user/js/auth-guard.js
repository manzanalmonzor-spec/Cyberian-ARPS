// Auth Guard - checks session on protected pages
// Include this script on every page that requires authentication

(function() {
  const session = JSON.parse(localStorage.getItem('arps_session') || 'null');

  // If no session, redirect to login
  if (!session || !session.uid || !session.email) {
    if (window.location.pathname.indexOf('loginpage.html') === -1) {
      window.location.href = 'loginpage.html';
    }
    return;
  }

  // Check onboarding status
  const isOnboarded = localStorage.getItem('arps_onboarded_' + session.uid) === 'true';
  const currentPath = window.location.pathname;
  
  // Try to get profile status
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem('arps_profile_' + session.uid) || '{}'); } catch(e){}
  
  // If not onboarded, redirect to onboarding (ignore loginpage)
  if (!isOnboarded && currentPath.indexOf('onboarding.html') === -1 && currentPath.indexOf('loginpage.html') === -1) {
    window.location.href = 'onboarding.html';
    return;
  }

  // If onboarded but pending admin approval, verify against Firestore before redirecting
  if (isOnboarded && profile.status === 'pending' && currentPath.indexOf('pending.html') === -1 && currentPath.indexOf('loginpage.html') === -1) {
    // Double-check Firestore — localStorage may be stale
    (async function() {
      try {
        var firestore = firebase.firestore();
        var uid = session.uid;
        var freshDoc = await firestore.collection('users').doc(uid).get();
        var freshData = freshDoc.exists ? freshDoc.data() : null;

        // Also try email lookup if UID doc not found
        if (!freshData && session.email) {
          var eq = await firestore.collection('users').where('email', '==', session.email.trim().toLowerCase()).get();
          if (!eq.empty) freshData = eq.docs[0].data();
        }

        if (freshData && freshData.status === 'approved') {
          // Admin already approved — update local profile and let user through
          profile.status = 'approved';
          localStorage.setItem('arps_profile_' + uid, JSON.stringify(profile));
          return; // stay on current page
        }

        // Still pending or no data — redirect to pending
        window.location.href = 'pending.html';
      } catch(e) {
        // Firestore failed — fall back to local status
        window.location.href = 'pending.html';
      }
    })();
    return;
  }

  // If rejected, block access and redirect to login
  if (profile.status === 'rejected' && currentPath.indexOf('loginpage.html') === -1) {
    localStorage.removeItem('arps_session');
    window.location.href = 'loginpage.html';
    return;
  }

  // Expose session data globally
  window.arpsUser = session;

  // Helper to update user name displays across the app
  document.addEventListener('DOMContentLoaded', function() {
    var nameEls = document.querySelectorAll('.user-display-name');
    nameEls.forEach(function(el) {
      el.textContent = session.name || 'Resident';
    });
  });

  // Session is permanent (PWA) — user stays logged in until they manually sign out
})();

// Logout helper with confirmation UI
function arpsLogout() {
  if (document.getElementById('logout-modal')) return;

  const modalHtml = `
    <div id="logout-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.3s ease;">
      <div style="background:#fff; border-radius:24px; width:90%; max-width:340px; padding:24px; text-align:center; transform:scale(0.95); transition:transform 0.3s ease; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
        <div style="width:56px; height:56px; border-radius:18px; background:#FEE2E2; color:#DC2626; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <h3 style="font-size:18px; font-weight:800; color:#0F172A; margin:0 0 8px; font-family:sans-serif;">Sign out of ARPS?</h3>
        <p style="font-size:14px; color:#64748B; margin:0 0 24px; line-height:1.5; font-family:sans-serif;">You will stop receiving live disaster alerts and notifications until you log back in.</p>
        <div style="display:flex; gap:12px;">
          <button id="cancel-logout" style="flex:1; padding:12px; border-radius:14px; border:none; background:#F1F5F9; color:#475569; font-weight:700; font-size:14px; cursor:pointer;">Cancel</button>
          <button id="confirm-logout" style="flex:1; padding:12px; border-radius:14px; border:none; background:#DC2626; color:#fff; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 4px 14px rgba(220,38,38,0.4);">Sign Out</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = document.getElementById('logout-modal');
  const modalContent = modal.firstElementChild;
  
  // Trigger animation
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    modalContent.style.transform = 'scale(1)';
  });

  const closeModal = () => {
    modal.style.opacity = '0';
    modalContent.style.transform = 'scale(0.95)';
    setTimeout(() => modal.remove(), 300);
  };

  document.getElementById('cancel-logout').addEventListener('click', closeModal);
  document.getElementById('confirm-logout').addEventListener('click', () => {
    localStorage.removeItem('arps_session');
    window.location.href = 'loginpage.html';
  });
}
