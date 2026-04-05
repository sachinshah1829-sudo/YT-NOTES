// js/db.js — Firestore data layer (replaces all google.script.run calls)
// Data is stored per-user: users/{uid}/categories, users/{uid}/videos, users/{uid}/sections

import { db, auth } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Helpers ─────────────────────────────────────────
function uid()       { return auth.currentUser?.uid; }
function userRef()   { return doc(db, 'users', uid()); }
function catsRef()   { return collection(db, 'users', uid(), 'categories'); }
function vidsRef()   { return collection(db, 'users', uid(), 'videos'); }
function secsRef()   { return collection(db, 'users', uid(), 'sections'); }

// ── Ensure default category ──────────────────────────
async function ensureDefaultCat() {
  const ref = doc(catsRef(), 'CAT_default');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { name: 'Uncategorized', dateCreated: serverTimestamp() });
  }
}

// ══════════════════════════════════════
//  CATEGORIES
// ══════════════════════════════════════
window.DB = {};

DB.getCategories = async function() {
  await ensureDefaultCat();
  const snap = await getDocs(catsRef());
  const cats = [];
  snap.forEach(d => cats.push({ id: d.id, name: d.data().name }));
  // Ensure Uncategorized is first
  cats.sort((a, b) => a.id === 'CAT_default' ? -1 : b.id === 'CAT_default' ? 1 : a.name.localeCompare(b.name));
  return cats;
};

DB.addCategory = async function(name) {
  const snap = await getDocs(catsRef());
  for (const d of snap.docs) {
    if (d.data().name.toLowerCase() === name.toLowerCase())
      return { success: false, error: 'Category already exists' };
  }
  const id = 'CAT_' + Date.now();
  await setDoc(doc(catsRef(), id), { name, dateCreated: serverTimestamp() });
  return { success: true, id, name };
};

DB.deleteCategory = async function(catId) {
  if (catId === 'CAT_default') return { success: false, error: 'Cannot delete Uncategorized' };
  await deleteDoc(doc(catsRef(), catId));
  // Move videos in this category to Uncategorized
  const snap = await getDocs(query(vidsRef(), where('category', '==', catId)));
  const batch = [];
  snap.forEach(d => batch.push(updateDoc(d.ref, { category: 'CAT_default' })));
  await Promise.all(batch);
  return { success: true };
};

// ══════════════════════════════════════
//  VIDEOS
// ══════════════════════════════════════
DB.fetchVideoInfo = async function(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const d = await resp.json();
    return {
      success:   true,
      title:     d.title,
      author:    d.author_name,
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
};

DB.saveVideo = async function(videoId, title, url, thumbnail, category, notes) {
  const ref = doc(vidsRef(), videoId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    if (category) await updateDoc(ref, { category });
    return { success: true, exists: true };
  }
  await setDoc(ref, {
    videoId, title, url, thumbnail,
    category: category || 'CAT_default',
    notes: notes || '',
    dateAdded: serverTimestamp()
  });
  return { success: true, exists: false };
};

DB.getAllVideos = async function() {
  const snap = await getDocs(vidsRef());
  const vids = [];
  snap.forEach(d => {
    const v = d.data();
    vids.push({
      videoId:   d.id,
      title:     v.title || d.id,
      url:       v.url || `https://www.youtube.com/watch?v=${d.id}`,
      thumbnail: v.thumbnail || '',
      category:  v.category  || 'CAT_default',
      dateAdded: v.dateAdded?.toDate?.()?.toISOString() || '',
      notes:     v.notes || ''
    });
  });
  vids.sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
  return vids;
};

DB.updateVideoCategory = async function(videoId, categoryId) {
  await updateDoc(doc(vidsRef(), videoId), { category: categoryId });
  return { success: true };
};

DB.deleteVideo = async function(videoId) {
  await deleteDoc(doc(vidsRef(), videoId));
  // Delete all sections for this video
  const snap = await getDocs(query(secsRef(), where('videoId', '==', videoId)));
  const batch = [];
  snap.forEach(d => batch.push(deleteDoc(d.ref)));
  await Promise.all(batch);
  return { success: true };
};

// ══════════════════════════════════════
//  SECTIONS
// ══════════════════════════════════════
DB.saveSection = async function(videoId, label, startSec, endSec, notes) {
  const id = 'SEC_' + Date.now();
  const link = `https://youtu.be/${videoId}?t=${startSec}`;
  await setDoc(doc(secsRef(), id), {
    sectionId: id, videoId,
    label: label || 'Section',
    startSec: parseInt(startSec) || 0,
    endSec:   parseInt(endSec)   || 0,
    notes:    notes || '',
    embedLink: link,
    dateCreated: serverTimestamp()
  });
  return { success: true, sectionId: id };
};

DB.getSectionsForVideo = async function(videoId) {
  const snap = await getDocs(query(secsRef(), where('videoId', '==', videoId)));
  const secs = [];
  snap.forEach(d => {
    const s = d.data();
    secs.push({
      sectionId:   d.id,
      videoId:     s.videoId,
      label:       s.label,
      startSec:    s.startSec,
      endSec:      s.endSec,
      notes:       s.notes || '',
      embedLink:   s.embedLink,
      dateCreated: s.dateCreated?.toDate?.()?.toISOString() || ''
    });
  });
  secs.sort((a, b) => a.startSec - b.startSec);
  return secs;
};

DB.deleteSection = async function(sectionId) {
  await deleteDoc(doc(secsRef(), sectionId));
  return { success: true };
};
