// js/firebase.js  — Firebase init
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAt2VZJi6nXCMunuQt_qOarq3NjYhabQzI",
  authDomain:        "yt-notes-11cfa.firebaseapp.com",
  projectId:         "yt-notes-11cfa",
  storageBucket:     "yt-notes-11cfa.firebasestorage.app",
  messagingSenderId: "458309083115",
  appId:             "1:458309083115:web:92f10291b5616faadd83ae",
  measurementId:     "G-0VE36L83JS"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
