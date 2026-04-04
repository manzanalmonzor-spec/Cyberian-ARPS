import { db } from "../../firebase-config.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const session = JSON.parse(localStorage.getItem('arps_session') || 'null');
if (session && session.uid) {
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem('arps_profile_' + session.uid) || '{}'); } catch(e) {}

  if (profile.status === 'approved') {
    function sendHeartbeat() {
      updateDoc(doc(db, "users", session.uid), {
        lastSeen: serverTimestamp()
      }).catch(function() {});
    }
    sendHeartbeat();
    setInterval(sendHeartbeat, 120000);
  }
}
