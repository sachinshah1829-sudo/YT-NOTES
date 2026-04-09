// js/firebase.js  — Firebase init
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD086hlwt6vqIvqvk-maOIftIjGRKUWJgg",
  authDomain: "yt-notes-91623.firebaseapp.com",
  projectId: "yt-notes-91623",
  storageBucket: "yt-notes-91623.firebasestorage.app",
  messagingSenderId: "727482074062",
  appId: "1:727482074062:web:141153934301e8e309a19f",
  measurementId: "G-S22RVZKX4Z"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
