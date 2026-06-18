// supabase.js — Slot-based identity for CPA Learning Platform
// No auth required. Users pick a slot (1-5) and set a display name.
// All pages load this via <script src="supabase.js"></script>

// ============ Configuration ============
var SB_URL = '';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZWt5aGFpbGVvenJzbHdnb2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDgwMTQsImV4cCI6MjA5NTI4NDAxNH0.urz5cnfpbakiiChjo4orgux9KNboKCmgGERvf3kUxQc';

// ============ Slot Management ============
function getSlot() {
  try { return JSON.parse(localStorage.getItem('cpa_slot') || 'null'); }
  catch(e) { return null; }
}

function setSlot(slotId, displayName) {
  var data = { slot_id: slotId, display_name: displayName };
  localStorage.setItem('cpa_slot', JSON.stringify(data));
}

function clearSlot() {
  localStorage.removeItem('cpa_slot');
}

function slotId() {
  var s = getSlot();
  return s ? s.slot_id : null;
}

function displayName() {
  var s = getSlot();
  return s ? s.display_name : '未选择';
}

// ============ HTTP Headers ============
function apiHeaders() {
  return { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
}

function jsonHeaders() {
  return {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

// ============ Slot Guard ============
function requireSlot() {
  var s = getSlot();
  if (!s || !s.slot_id) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// ============ Profile API ============
async function getProfiles() {
  var resp = await fetch(SB_URL + '/rest/v1/profiles?select=*&order=slot_id', { headers: apiHeaders() });
  if (!resp.ok) return [];
  return resp.json();
}

async function updateProfile(slotId, name) {
  await fetch(SB_URL + '/rest/v1/profiles?slot_id=eq.' + slotId, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({ display_name: name, updated_at: new Date().toISOString() })
  });
}

// ============ Database Helpers (auto-add slot_id) ============
async function dbGet(table, query) {
  var qs = query || 'select=*';
  var resp = await fetch(SB_URL + '/rest/v1/' + table + '?' + qs, { headers: apiHeaders() });
  if (!resp.ok) { console.error('dbGet error:', table, resp.status); throw new Error('Failed to fetch ' + table); }
  return resp.json();
}

async function dbPost(table, body) {
  var data = Object.assign({}, body);
  var sid = slotId();
  if (sid && table !== 'profiles') data.slot_id = sid;
  var resp = await fetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data)
  });
  if (!resp.ok) { console.error('dbPost error:', table, resp.status); throw new Error('Failed to insert ' + table); }
  return resp.json();
}

async function dbPatch(table, id, body) {
  var resp = await fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(body)
  });
  if (!resp.ok) { console.error('dbPatch error:', table, resp.status); throw new Error('Failed to update ' + table); }
}

async function dbDelete(table, id) {
  var resp = await fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'DELETE', headers: apiHeaders()
  });
  if (!resp.ok) { console.error('dbDelete error:', table, resp.status); throw new Error('Failed to delete from ' + table); }
}

// ============ Signout ============
function signout() {
  clearSlot();
  window.location.href = '/login.html';
}
