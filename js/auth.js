// js/auth.js — Authentication
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

// ── Exposed globals ──────────────────────────────────

window.switchAuthTab = function(mode) {
  currentMode = mode;
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('nameGroup').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authSubmitTxt').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  document.getElementById('authFoot').innerHTML = mode === 'login'
    ? 'Don\'t have an account? <a href="#" onclick="switchAuthTab(\'signup\')">Sign Up</a>'
    : 'Already have an account? <a href="#" onclick="switchAuthTab(\'login\')">Sign In</a>';
  clearAuthError();
  if (mode === 'signup') document.getElementById('passInp').autocomplete = 'new-password';
  else                   document.getElementById('passInp').autocomplete = 'current-password';
};

window.signInGoogle = async function() {
  clearAuthError();
  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged will handle the rest
  } catch (e) {
    showAuthError(friendlyError(e));
  }
};

window.submitAuth = async function() {
  const email = document.getElementById('emailInp').value.trim();
  const pass  = document.getElementById('passInp').value;
  const name  = document.getElementById('nameInp').value.trim();

  if (!email) { showAuthError('Please enter your email.'); return; }
  if (!pass)  { showAuthError('Please enter your password.'); return; }
  if (currentMode === 'signup' && pass.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }

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
};

window.signOut = async function() {
  closeUserMenu();
  await fbSignOut(auth);
};

window.toggleUserMenu = function() {
  document.getElementById('userMenu').classList.toggle('hidden');
};

window.closeUserMenu = function() {
  document.getElementById('userMenu').classList.add('hidden');
};

// Close user menu on outside click
document.addEventListener('click', function(e) {
  const menu = document.getElementById('userMenu');
  const btn  = document.getElementById('userBtn');
  if (!menu.classList.contains('hidden') && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

// ── Auth state observer ──────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Signed in → show app
    showApp(user);
    // Dispatch custom event so db.js / app.js can load data
    window.dispatchEvent(new CustomEvent('userSignedIn', { detail: user }));
  } else {
    // Signed out → show auth screen
    showAuth();
    window.dispatchEvent(new CustomEvent('userSignedOut'));
  }
});

// ── UI helpers ───────────────────────────────────────
function showApp(user) {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  // Fill user info in nav
  const initEl   = document.getElementById('userInitial');
  const avatarEl = document.getElementById('userAvatar');
  const nameEl   = document.getElementById('umName');
  const emailEl  = document.getElementById('umEmail');

  nameEl.textContent  = user.displayName || 'User';
  emailEl.textContent = user.email || '';

  if (user.photoURL) {
    avatarEl.src = user.photoURL;
    avatarEl.classList.remove('hidden');
    initEl.classList.add('hidden');
  } else {
    const initial = (user.displayName || user.email || '?')[0].toUpperCase();
    initEl.textContent = initial;
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

// Enter key on password field
document.getElementById('passInp').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') window.submitAuth();
});
// At the bottom of auth.js, after defining your functions:
window.submitAuth = submitAuth;
window.signInGoogle = signInGoogle;
window.switchAuthTab = switchAuthTab;
