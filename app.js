// js/app.js — Main app logic (Firebase version)

/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
var S = {
  vid: null, title: null, thumb: null,
  sections: [], videos: [], cats: [],
  player: null, ready: false,
  poll: null,
  currentTab: 1
};

/* ═══════════════════════════════════════════════════
   WAIT FOR AUTH BEFORE BOOTING
═══════════════════════════════════════════════════ */
window.addEventListener('userSignedIn', function() {
  loadCats(function() { loadVideos(); });
});
window.addEventListener('userSignedOut', function() {
  S.vid = null; S.sections = []; S.videos = []; S.cats = [];
  if (S.player) { try { S.player.destroy(); } catch(e){} S.player = null; }
  if (S.poll)   { clearInterval(S.poll); S.poll = null; }
});

/* ═══════════════════════════════════════════════════
   TAB NAVIGATION + SWIPE
═══════════════════════════════════════════════════ */
window.goTab = function(n) {
  S.currentTab = n;
  document.getElementById('pagesSlider').style.transform = 'translateX(-' + (n * 33.333) + '%)';
  [0,1,2].forEach(function(i) {
    document.getElementById('tab' + i).classList.toggle('active', i === n);
  });
};

// Swipe gestures
(function() {
  var sx = 0, sy = 0, dragging = false;
  document.addEventListener('DOMContentLoaded', function() {
    var wrap = document.querySelector('.page-wrap');
    if (!wrap) return;
    wrap.addEventListener('touchstart', function(e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dragging = true;
    }, { passive: true });
    wrap.addEventListener('touchend', function(e) {
      if (!dragging) return; dragging = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        if (dx < 0 && S.currentTab < 2) goTab(S.currentTab + 1);
        if (dx > 0 && S.currentTab > 0) goTab(S.currentTab - 1);
      }
    }, { passive: true });
  });
})();

/* ═══════════════════════════════════════════════════
   YOUTUBE IFRAME API
═══════════════════════════════════════════════════ */
window.onYouTubeIframeAPIReady = function() { /* ready */ };
(function() {
  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
})();

function createPlayer(videoId, startSec) {
  startSec = parseInt(startSec) || 0;
  S.ready = false;
  if (S.player) { try { S.player.destroy(); } catch(e){} S.player = null; }
  var host = document.getElementById('ytPlayerHost');
  host.innerHTML = '';
  host.classList.remove('hidden');
  document.getElementById('playerPH').classList.add('hidden');
  if (!(window.YT && window.YT.Player)) {
    var tries = 0;
    var wait = setInterval(function() {
      tries++;
      if (window.YT && window.YT.Player) { clearInterval(wait); doCreate(videoId, startSec, host); }
      if (tries > 30) { clearInterval(wait); toast('YouTube API failed to load', 'err'); }
    }, 300);
    return;
  }
  doCreate(videoId, startSec, host);
}

function doCreate(videoId, startSec, host) {
  var inner = document.createElement('div');
  inner.id = 'ytP_' + Date.now();
  host.appendChild(inner);
  S.player = new YT.Player(inner.id, {
    videoId: videoId,
    width: '100%', height: '100%',
    playerVars: { autoplay: 1, start: startSec, rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1 },
    events: {
      onReady: function(e) { S.ready = true; e.target.seekTo(startSec, true); e.target.playVideo(); },
      onError: function()   { toast('Player error — try "Open on YouTube"', 'err'); }
    }
  });
}

function startPoll(endSec) {
  if (S.poll) { clearInterval(S.poll); S.poll = null; }
  if (endSec <= 0) return;
  S.poll = setInterval(function() {
    if (!S.player || !S.ready) return;
    try {
      if (S.player.getCurrentTime() >= endSec) {
        S.player.pauseVideo(); clearInterval(S.poll); S.poll = null;
      }
    } catch(e) { clearInterval(S.poll); S.poll = null; }
  }, 200);
}

function seekPlay(startSec, endSec) {
  if (!S.player || !S.ready) { toast('Player not ready yet', 'err'); return; }
  if (S.poll) { clearInterval(S.poll); S.poll = null; }
  S.player.seekTo(startSec, true);
  S.player.playVideo();
  if (endSec > startSec) startPoll(endSec);
}

/* ═══════════════════════════════════════════════════
   STAMP
═══════════════════════════════════════════════════ */
window.stampNow = function(which) {
  if (!S.player || !S.ready) { toast('Load and play a video first', 'err'); return; }
  var sec = Math.floor(S.player.getCurrentTime());
  var id  = which === 'start' ? 'startInp' : 'endInp';
  var bid = which === 'start' ? 'btnS'     : 'btnE';
  document.getElementById(id).value = s2t(sec);
  var b = document.getElementById(bid);
  b.classList.add('ok'); b.textContent = '✓';
  setTimeout(function() { b.classList.remove('ok'); b.textContent = '⏱'; }, 1400);
  onTimeInput();
  toast((which === 'start' ? '⏮ Start' : '⏭ End') + ' stamped: ' + s2t(sec));
};

window.onTimeInput = function() {
  var ss = parseT(document.getElementById('startInp').value);
  var es = parseT(document.getElementById('endInp').value);
  var el = document.getElementById('durRow');
  if (ss >= 0 && es > ss)      el.textContent = 'Duration: ' + s2t(es - ss);
  else if (ss >= 0 && es >= 0) el.textContent = es <= ss ? '⚠ End must be after start' : '';
  else                         el.textContent = '';
};

/* ═══════════════════════════════════════════════════
   LOAD VIDEO
═══════════════════════════════════════════════════ */
window.loadVideo = async function() {
  var url = document.getElementById('urlInp').value.trim();
  if (!url) { toast('Paste a YouTube URL first', 'err'); return; }
  var vid = extractId(url);
  if (!vid) { toast('Could not find a YouTube video ID', 'err'); return; }
  var btn = document.getElementById('loadBtn');
  btn.disabled = true;
  document.getElementById('loadTxt').textContent = '...';
  try {
    var info = await DB.fetchVideoInfo(vid);
    btn.disabled = false;
    document.getElementById('loadTxt').textContent = 'Load';
    if (!info || !info.success) { toast(info && info.error ? info.error : 'Could not load video', 'err'); return; }
    S.vid = vid; S.title = info.title; S.thumb = info.thumbnail;
    document.getElementById('vThumb').src = info.thumbnail || '';
    document.getElementById('vTitle').textContent = info.title || vid;
    document.getElementById('vSub').textContent   = vid + (info.author ? ' · ' + info.author : '');
    var v = S.videos.find(function(x) { return x.videoId === vid; });
    document.getElementById('vCatLbl').textContent = '🗂 ' + getCatName(v ? v.category : 'CAT_default');
    populateSel('vidCatSel', v ? v.category : 'CAT_default');
    document.getElementById('saveVidBtn').style.display = v ? 'none' : '';
    document.getElementById('ytLink').href = 'https://www.youtube.com/watch?v=' + vid;
    // Reset capture
    ['startInp','endInp','secLbl','secNote'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('durRow').textContent = '';
    ['btnS','btnE'].forEach(function(id){ var b=document.getElementById(id); b.classList.remove('ok'); b.textContent='⏱'; });
    // Show cards
    ['vinfoCard','fallbackBar','capCard'].forEach(function(id){ document.getElementById(id).classList.remove('hidden'); });
    // Mark active in library
    document.querySelectorAll('.lib-card').forEach(function(c){ c.classList.toggle('active', c.dataset.id === vid); });
    createPlayer(vid, 0);
    await loadSections(vid);
    toast('✓ ' + info.title);
  } catch(e) {
    btn.disabled = false;
    document.getElementById('loadTxt').textContent = 'Load';
    toast('Error: ' + e.message, 'err');
  }
};

document.getElementById('urlInp').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); loadVideo(); }
});

function extractId(url) {
  var patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = url.match(patterns[i]);
    if (m) return m[1];
  }
  return null;
}

/* ═══════════════════════════════════════════════════
   SAVE VIDEO
═══════════════════════════════════════════════════ */
window.saveCurrentVideo = async function() {
  if (!S.vid) return;
  var cat = document.getElementById('vidCatSel').value || 'CAT_default';
  var btn = document.getElementById('saveVidBtn');
  btn.disabled = true; btn.textContent = '…';
  try {
    await DB.saveVideo(S.vid, S.title, 'https://www.youtube.com/watch?v=' + S.vid, S.thumb, cat, '');
    btn.style.display = 'none';
    toast('📼 Saved to library!', 'ok');
    loadVideos();
  } catch(e) {
    btn.disabled = false; btn.textContent = '💾 Save';
    toast('Save failed: ' + e.message, 'err');
  }
};

window.changeVideoCat = async function() {
  var cat = document.getElementById('vidCatSel').value;
  if (!S.vid || !cat) return;
  document.getElementById('vCatLbl').textContent = '🗂 ' + getCatName(cat);
  try {
    await DB.updateVideoCategory(S.vid, cat);
    toast('Category updated', 'ok');
    loadVideos();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
};

/* ═══════════════════════════════════════════════════
   LIBRARY
═══════════════════════════════════════════════════ */
async function loadVideos() {
  try {
    var vids = await DB.getAllVideos();
    S.videos = vids || [];
    renderLib();
  } catch(e) { console.error(e); }
}

window.renderLib = function() {
  var filter = document.getElementById('catFilter').value || '';
  var vids = filter ? S.videos.filter(function(v) { return v.category === filter; }) : S.videos;
  document.getElementById('libBadge').textContent = S.videos.length;
  // Repopulate filter
  var cf = document.getElementById('catFilter');
  var cur = cf.value;
  cf.innerHTML = '<option value="">All categories</option>';
  S.cats.forEach(function(c) {
    var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; cf.appendChild(o);
  });
  if (cur) cf.value = cur;
  var list = document.getElementById('libList');
  if (!vids.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">📼</div>No videos yet.<br>Load one from the Capture tab.</div>';
    return;
  }
  list.innerHTML = '';
  vids.forEach(function(v) {
    var d = document.createElement('div');
    d.className = 'card lib-card mt-4' + (v.videoId === S.vid ? ' active' : '');
    d.dataset.id = v.videoId;
    d.innerHTML =
      '<img class="lib-thumb" src="' + esc(v.thumbnail) + '" onerror="this.style.display=\'none\'">' +
      '<div class="lib-info">' +
        '<div class="lib-title">' + esc(v.title || v.videoId) + '</div>' +
        '<div class="lib-meta">' + fmtDate(v.dateAdded) + '</div>' +
        '<div class="lib-cat">🗂 ' + esc(getCatName(v.category)) + '</div>' +
      '</div>' +
      '<button class="lib-del" onclick="delVideo(event,\'' + esc(v.videoId) + '\')">🗑</button>';
    d.onclick = function(e) {
      if (e.target.tagName === 'BUTTON') return;
      document.getElementById('urlInp').value = v.url || ('https://www.youtube.com/watch?v=' + v.videoId);
      goTab(1); loadVideo();
    };
    list.appendChild(d);
  });
};

window.delVideo = async function(e, id) {
  e.stopPropagation();
  if (!confirm('Delete video and all its sections?')) return;
  try {
    await DB.deleteVideo(id);
    if (S.vid === id) S.vid = null;
    toast('Deleted', 'ok');
    loadVideos();
  } catch(err) { toast('Error: ' + err.message, 'err'); }
};

/* ═══════════════════════════════════════════════════
   CATEGORIES
═══════════════════════════════════════════════════ */
async function loadCats(cb) {
  try {
    var cats = await DB.getCategories();
    S.cats = cats && cats.length ? cats : [{ id: 'CAT_default', name: 'Uncategorized' }];
    fillAllSelects();
    if (cb) cb();
  } catch(e) { if (cb) cb(); }
}

function getCatName(id) {
  var c = S.cats.find(function(x) { return x.id === id; });
  return c ? c.name : 'Uncategorized';
}

function fillAllSelects() {
  var el = document.getElementById('vidCatSel');
  if (!el) return;
  var cur = el.value;
  el.innerHTML = '';
  S.cats.forEach(function(c) {
    var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; el.appendChild(o);
  });
  if (cur) el.value = cur;
}

function populateSel(elId, selected) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  S.cats.forEach(function(c) {
    var o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    if (c.id === selected) o.selected = true;
    el.appendChild(o);
  });
}

window.openCatSheet  = function()  { renderCatChips(); document.getElementById('catOverlay').classList.add('open'); };
window.closeCatSheet = function(e) {
  if (!e || e.target === document.getElementById('catOverlay'))
    document.getElementById('catOverlay').classList.remove('open');
};

function renderCatChips() {
  var w = document.getElementById('catChips'); w.innerHTML = '';
  S.cats.forEach(function(c) {
    var chip = document.createElement('span'); chip.className = 'cat-chip'; chip.textContent = c.name;
    if (c.id !== 'CAT_default') {
      var del = document.createElement('button'); del.className = 'cat-chip-del'; del.textContent = '×';
      del.onclick = function() { deleteCat(c.id); };
      chip.appendChild(del);
    }
    w.appendChild(chip);
  });
}

window.addCat = async function() {
  var name = document.getElementById('newCatInp').value.trim();
  if (!name) { toast('Enter a name', 'err'); return; }
  try {
    var r = await DB.addCategory(name);
    if (r && r.success) {
      document.getElementById('newCatInp').value = '';
      await loadCats(function() { renderCatChips(); renderLib(); });
      toast('Category added', 'ok');
    } else { toast(r && r.error ? r.error : 'Error', 'err'); }
  } catch(e) { toast(e.message || 'Error', 'err'); }
};

async function deleteCat(id) {
  if (!confirm('Delete this category? Videos move to Uncategorized.')) return;
  try {
    await DB.deleteCategory(id);
    await loadCats(function() { renderCatChips(); loadVideos(); });
    toast('Deleted', 'ok');
  } catch(e) { toast('Error', 'err'); }
}

document.getElementById('newCatInp').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') addCat();
});

/* ═══════════════════════════════════════════════════
   ADD SECTION
═══════════════════════════════════════════════════ */
window.addSection = async function() {
  if (!S.vid) { toast('Load a video first', 'err'); return; }
  var sv = document.getElementById('startInp').value.trim();
  var ev = document.getElementById('endInp').value.trim();
  if (!sv) { toast('Stamp a start time first', 'err'); return; }
  if (!ev) { toast('Stamp an end time first', 'err');  return; }
  var ss = parseT(sv), es = parseT(ev);
  if (ss < 0)  { toast('Invalid start time', 'err'); return; }
  if (es < 0)  { toast('Invalid end time',   'err'); return; }
  if (es <= ss) { toast('End must be after start', 'err'); return; }
  var label = document.getElementById('secLbl').value.trim() || 'Section';
  var notes = document.getElementById('secNote').value.trim();
  var btn   = document.getElementById('addBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  var vidId = S.vid;
  try {
    var r = await DB.saveSection(vidId, label, ss, es, notes);
    btn.disabled = false; btn.textContent = '+ Add Section';
    if (r && r.success) {
      toast('📌 Section saved!', 'ok');
      document.getElementById('endInp').value  = '';
      document.getElementById('secLbl').value  = '';
      document.getElementById('secNote').value = '';
      document.getElementById('durRow').textContent = '';
      var bE = document.getElementById('btnE'); bE.classList.remove('ok'); bE.textContent = '⏱';
      await loadSections(vidId);
      var ex = S.videos.find(function(v) { return v.videoId === vidId; });
      if (!ex) saveCurrentVideo();
    } else { toast('Save error: ' + (r && r.error ? r.error : '?'), 'err'); }
  } catch(e) {
    btn.disabled = false; btn.textContent = '+ Add Section';
    toast('Error: ' + e.message, 'err');
  }
};

window.previewSec = function() {
  var ss = parseT(document.getElementById('startInp').value);
  var es = parseT(document.getElementById('endInp').value);
  if (ss < 0) { toast('Set a start time first', 'err'); return; }
  seekPlay(ss, es > ss ? es : 0);
  toast('▶ Preview from ' + s2t(ss));
};

/* ═══════════════════════════════════════════════════
   SECTIONS
═══════════════════════════════════════════════════ */
async function loadSections(vid) {
  document.getElementById('secList').innerHTML = '<div class="empty" style="color:#999">Loading…</div>';
  try {
    var secs = await DB.getSectionsForVideo(vid);
    S.sections = secs || [];
    renderSections();
  } catch(e) {
    document.getElementById('secList').innerHTML = '<div class="empty" style="color:#e03">' + esc(e.message || e) + '</div>';
  }
}

function renderSections() {
  var n = S.sections.length;
  document.getElementById('secBadge').textContent = n;
  var list = document.getElementById('secList');
  if (!n) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>No sections yet.<br>Stamp timestamps on the Capture tab.</div>';
    return;
  }
  list.innerHTML = '';
  S.sections.forEach(function(s, i) {
    var st  = s2t(s.startSec), et = s2t(s.endSec);
    var dur = s.endSec - s.startSec;
    var link = s.embedLink || ('https://youtu.be/' + (S.vid || s.videoId) + '?t=' + s.startSec);
    var d = document.createElement('div');
    d.className = 'card sec-card mt-4';
    d.innerHTML =
      '<button class="sec-del" onclick="delSec(\'' + esc(s.sectionId) + '\')">✕</button>' +
      '<div class="sec-lbl">' + esc(s.label || 'Section ' + (i + 1)) + '</div>' +
      '<div class="sec-times"><span>' + esc(st) + '</span><span class="sec-arrow">→</span><span>' + esc(et) + '</span><span class="sec-dur">(' + esc(dur > 0 ? s2t(dur) : '?') + ')</span></div>' +
      (s.notes ? '<div class="sec-note">' + esc(s.notes) + '</div>' : '') +
      '<div class="sec-btns">' +
        '<button class="btn btn-dark btn-xs" onclick="playSec(\'' + esc(s.sectionId) + '\')">▶ Play</button>' +
        '<a class="btn btn-outline btn-xs" href="' + esc(link) + '" target="_blank">↗ Link</a>' +
      '</div>';
    list.appendChild(d);
  });
}

window.playSec = function(id) {
  var s = S.sections.find(function(x) { return x.sectionId === id; });
  if (!s) return;
  goTab(1);
  setTimeout(function() {
    seekPlay(s.startSec, s.endSec);
    toast('▶ ' + s.label + ' (' + s2t(s.startSec) + ' → ' + s2t(s.endSec) + ')');
  }, 100);
};

window.delSec = async function(id) {
  if (!confirm('Delete this section?')) return;
  try {
    await DB.deleteSection(id);
    toast('Deleted');
    loadSections(S.vid);
  } catch(e) { toast('Error', 'err'); }
};

/* ═══════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════ */
function parseT(t) {
  t = String(t || '').trim();
  if (!t) return -1;
  if (/^\d+$/.test(t)) return parseInt(t);
  var p = t.split(':').map(function(x) { return parseInt(x) || 0; });
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return -1;
}
function s2t(sec) {
  sec = Math.max(0, parseInt(sec) || 0);
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}
function pad(n) { return String(n).padStart(2, '0'); }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtDate(d) { try { return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); } catch(e) { return ''; } }

window.toast = function(msg, type) {
  var w = document.getElementById('toastWrap');
  var t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0'; t.style.transform = 'translateY(-4px)';
    setTimeout(function() { if (t.parentNode) t.remove(); }, 280);
  }, 2600);
};
