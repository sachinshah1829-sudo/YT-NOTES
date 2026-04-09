// js/auth.js — Authentication (no inline onclick needed)
import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const provider = new GoogleAuthProvider();
let currentMode = 'login'; // 'login' | 'signup'

// ── Wire up all buttons once DOM is ready ────────────
document.addEventListener('DOMContentLoaded', () => {

  // Auth tab buttons
  document.getElementById('tabLogin').addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tabSignup').addEventListener('click', () => switchAuthTab('signup'));

  // Google sign-in
  document.getElementById('googleBtn').addEventListener('click', signInGoogle);

  // Email/password submit
  document.getElementById('authSubmitBtn').addEventListener('click', submitAuth);

  // Footer link (Sign Up / Sign In toggle)
  document.getElementById('authFootLink').addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthTab(currentMode === 'login' ? 'signup' : 'login');
  });

  // Enter key on password field
  document.getElementById('passInp').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAuth();
  });

  // App: sign out
  document.getElementById('signOutBtn').addEventListener('click', async () => {
    closeUserMenu();
    await fbSignOut(auth);
  });

  // App: user menu toggle
  document.getElementById('userBtn').addEventListener('click', () => {
    document.getElementById('userMenu').classList.toggle('hidden');
  });

  // App: close user menu on outside click
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenu');
    const btn  = document.getElementById('userBtn');
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // App: category sheet open
  document.getElementById('openCatSheetBtn').addEventListener('click', () => {
    window.openCatSheet && window.openCatSheet();
  });

  // App: category sheet overlay close
  document.getElementById('catOverlay').addEventListener('click', (e) => {
    window.closeCatSheet && window.closeCatSheet(e);
  });

  // App: add category
  document.getElementById('addCatBtn').addEventListener('click', () => {
    window.addCat && window.addCat();
  });

  // App: cat filter change
  document.getElementById('catFilter').addEventListener('change', () => {
    window.renderLib && window.renderLib();
  });

  // App: load video
  document.getElementById('loadBtn').addEventListener('click', () => {
    window.loadVideo && window.loadVideo();
  });

  // App: video category change
  document.getElementById('vidCatSel').addEventListener('change', () => {
    window.changeVideoCat && window.changeVideoCat();
  });

  // App: save video
  document.getElementById('saveVidBtn').addEventListener('click', () => {
    window.saveCurrentVideo && window.saveCurrentVideo();
  });

  // App: time inputs
  document.getElementById('startInp').addEventListener('input', () => {
    window.onTimeInput && window.onTimeInput();
  });
  document.getElementById('endInp').addEventListener('input', () => {
    window.onTimeInput && window.onTimeInput();
  });

  // App: stamp buttons
  document.getElementById('btnS').addEventListener('click', () => {
    window.stampNow && window.stampNow('start');
  });
  document.getElementById('btnE').addEventListener('click', () => {
    window.stampNow && window.stampNow('end');
  });

  // App: preview section
  document.getElementById('previewSecBtn').addEventListener('click', () => {
    window.previewSec && window.previewSec();
  });

  // App: add section
  document.getElementById('addBtn').addEventListener('click', () => {
    window.addSection && window.addSection();
  });

  // App: tab bar
  document.getElementById('tab0').addEventListener('click', () => window.goTab && window.goTab(0));
  document.getElementById('tab1').addEventListener('click', () => window.goTab && window.goTab(1));
  document.getElementById('tab2').addEventListener('click', () => window.goTab && window.goTab(2));
});

// ── Auth functions ───────────────────────────────────

function switchAuthTab(mode) {
  currentMode = mode;
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('nameGroup').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authSubmitTxt').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  document.getElementById('authFootLink').textContent = mode === 'login' ? 'Sign Up' : 'Sign In';
  document.getElementById('authFoot').firstChild.textContent = mode === 'login'
    ? "Don't have an account? "
    : "Already have an account? ";
  document.getElementById('passInp').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  clearAuthError();
}

async function signInGoogle() {
  clearAuthError();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    showAuthError(friendlyError(e));
  }
}

async function submitAuth() {
  const email = document.getElementById('emailInp').value.trim();
  const pass  = document.getElementById('passInp').value;
  const name  = document.getElementById('nameInp').value.trim();

  if (!email) { showAuthError('Please enter your email.'); return; }
  if (!pass)  { showAuthError('Please enter your password.'); return; }
  if (currentMode === 'signup' && pass.length < 6) {
    showAuthError('Password must be at least 6 characters.'); return;
  }

  setAuthLoading(true);
  clearAuthError();
  try {
    if (currentMode === 'login') {
      await signInWithEmailAndPassword(auth, email, pass);
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name) await updateProfile(cred.user, { displayName: name });
    }
  } catch (e) {
    showAuthError(friendlyError(e));
    setAuthLoading(false);
  }
}

// ── Auth state observer ──────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    showApp(user);
    window.dispatchEvent(new CustomEvent('userSignedIn', { detail: user }));
  } else {
    showAuth();
    window.dispatchEvent(new CustomEvent('userSignedOut'));
  }
});

// ── UI helpers ───────────────────────────────────────
function showApp(user) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  const initEl   = document.getElementById('userInitial');
  const avatarEl = document.getElementById('userAvatar');
  document.getElementById('umName').textContent  = user.displayName || 'User';
  document.getElementById('umEmail').textContent = user.email || '';

  if (user.photoURL) {
    avatarEl.src = user.photoURL;
    avatarEl.classList.remove('hidden');
    initEl.classList.add('hidden');
  } else {
    initEl.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
    initEl.classList.remove('hidden');
    avatarEl.classList.add('hidden');
  }
  setAuthLoading(false);
}

function showAuth() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  setAuthLoading(false);
}

function showAuthError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearAuthError() {
  const el = document.getElementById('authError');
  el.textContent = '';
  el.classList.add('hidden');
}

function setAuthLoading(on) {
  document.getElementById('authSubmitBtn').disabled = on;
  document.getElementById('authSpin').classList.toggle('hidden', !on);
  document.getElementById('authSubmitTxt').style.opacity = on ? '0.5' : '1';
}

function friendlyError(e) {
  const code = e.code || '';
  if (code.includes('user-not-found'))     return 'No account found with this email.';
  if (code.includes('wrong-password'))     return 'Incorrect password. Please try again.';
  if (code.includes('email-already'))      return 'This email is already registered. Sign in instead.';
  if (code.includes('invalid-email'))      return 'Please enter a valid email address.';
  if (code.includes('weak-password'))      return 'Password must be at least 6 characters.';
  if (code.includes('popup-closed'))       return 'Sign-in popup was closed. Please try again.';
  if (code.includes('network-request'))    return 'Network error. Check your connection.';
  if (code.includes('too-many-requests'))  return 'Too many attempts. Please wait before trying again.';
  if (code.includes('invalid-credential')) return 'Incorrect email or password.';
  return e.message || 'Something went wrong. Please try again.';
}

function closeUserMenu() {
  document.getElementById('userMenu').classList.add('hidden');
}
