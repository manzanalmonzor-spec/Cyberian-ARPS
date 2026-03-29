import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAIE4y2j-4VfHPepa9wjGHrZ4YlM2SVN1s",
  authDomain: "hackathon-7955d.firebaseapp.com",
  projectId: "hackathon-7955d",
  storageBucket: "hackathon-7955d.firebasestorage.app",
  messagingSenderId: "257085823212",
  appId: "1:257085823212:web:39affb5a1459d029b4adc9",
  measurementId: "G-3NP99K13BE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(err => {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    console.warn('Firestore offline persistence error:', err.code);
  }
});

export { app, db };
