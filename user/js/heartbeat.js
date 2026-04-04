import { db } from "../../firebase-config.js";
import { doc, updateDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const session = JSON.parse(localStorage.getItem('arps_session') || 'null');
if (session && session.uid) {
  const userRef = doc(db, "users", session.uid);

  async function startHeartbeat() {
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== 'approved') return;

      const profile = JSON.parse(localStorage.getItem('arps_profile_' + session.uid) || '{}');
      if (profile.status !== 'approved') {
        profile.status = 'approved';
        localStorage.setItem('arps_profile_' + session.uid, JSON.stringify(profile));
      }

      function sendHeartbeat() {
        updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(function() {});
      }
      sendHeartbeat();
      setInterval(sendHeartbeat, 60000);
    } catch(e) {}
  }

  startHeartbeat();
}
