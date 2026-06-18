// supabase.js — Shared auth + API module for CPA Learning Platform
// All pages load this via <script src="supabase.js"></script>
// Uses Supabase REST API directly (no SDK), matching existing project pattern

// ============ Configuration ============
// These are empty because _worker.js proxies them
const SB_URL = '';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZWt5aGFpbGVvenJzbHdnb2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDgwMTQsImV4cCI6MjA5NTI4NDAxNH0.urz5cnfpbakiiChjo4orgux9KNboKCmgGERvf3kUxQc';

// ============ Auth Token Management ============
function getSession() {
  try {
    return JSON.parse(localStorage.getItem('cpa_session') || '{}');
  } catch (e) {
    return {};
  }
}

function setSession(data) {
  localStorage.setItem('cpa_session', JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem('cpa_session');
  localStorage.removeItem('cpa_user');
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('cpa_user') || '{}');
  } catch (e) {
    return {};
  }
}

function setStoredUser(user) {
  localStorage.setItem('cpa_user', JSON.stringify(user));
}

// ============ HTTP Headers ============
function authHeaders() {
  var session = getSession();
  var h = { 'apikey': SB_KEY };
  if (session.access_token) {
    h['Authorization'] = 'Bearer ' + session.access_token;
  } else {
    h['Authorization'] = 'Bearer ' + SB_KEY;
  }
  return h;
}

function jsonHeaders() {
  return Object.assign({}, authHeaders(), {
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  });
}

// ============ Auth API ============
async function signup(email, password, displayName) {
  var resp = await fetch('/auth/v1/signup', {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
      password: password,
      data: { display_name: displayName }
    })
  });
  var data = await resp.json();
  if (resp.ok && data.access_token) {
    setSession(data);
    // Fetch and store user profile
    var userResp = await fetch('/auth/v1/user', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + data.access_token }
    });
    if (userResp.ok) {
      var user = await userResp.json();
      setStoredUser(user);
    }
  }
  return { ok: resp.ok, data: data };
}

async function signin(email, password) {
  var resp = await fetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: email, password: password })
  });
  var data = await resp.json();
  if (resp.ok && data.access_token) {
    setSession(data);
    // Fetch and store user profile
    var userResp = await fetch('/auth/v1/user', {
      headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + data.access_token }
    });
    if (userResp.ok) {
      var user = await userResp.json();
      setStoredUser(user);
    }
    // Auto-refresh token 55 minutes later
    setTimeout(refreshSession, 55 * 60 * 1000);
  }
  return { ok: resp.ok, data: data };
}

async function refreshSession() {
  var session = getSession();
  if (!session.refresh_token) return;

  var resp = await fetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  var data = await resp.json();
  if (data.access_token) {
    setSession(data);
    setTimeout(refreshSession, 55 * 60 * 1000);
  } else {
    clearSession();
    window.location.href = '/login.html';
  }
}

function signout() {
  clearSession();
  window.location.href = '/login.html';
}

async function getCurrentUser() {
  var session = getSession();
  if (!session.access_token) return null;

  var resp = await fetch('/auth/v1/user', {
    headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + session.access_token }
  });
  if (resp.ok) {
    var user = await resp.json();
    setStoredUser(user);
    return user;
  }
  return null;
}

// ============ Auth Guard ============
async function requireAuth() {
  var session = getSession();
  if (!session.access_token) {
    window.location.href = '/login.html';
    return null;
  }

  try {
    var user = await getCurrentUser();
    if (!user || user.code === 'unauthorized') {
      // Try refresh
      await refreshSession();
      user = await getCurrentUser();
      if (!user || user.code === 'unauthorized') {
        clearSession();
        window.location.href = '/login.html';
        return null;
      }
    }
    return user;
  } catch (e) {
    clearSession();
    window.location.href = '/login.html';
    return null;
  }
}

// ============ Database Helpers ============
async function dbGet(table, query) {
  var qs = query || 'select=*';
  var resp = await fetch(SB_URL + '/rest/v1/' + table + '?' + qs, {
    headers: authHeaders()
  });
  if (!resp.ok) {
    console.error('dbGet error:', table, resp.status, await resp.text());
    throw new Error('Failed to fetch ' + table);
  }
  return resp.json();
}

async function dbPost(table, body) {
  var resp = await fetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    console.error('dbPost error:', table, resp.status, await resp.text());
    throw new Error('Failed to insert into ' + table);
  }
  return resp.json();
}

async function dbPatch(table, id, body) {
  var resp = await fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    console.error('dbPatch error:', table, resp.status, await resp.text());
    throw new Error('Failed to update ' + table);
  }
}

async function dbDelete(table, id) {
  var resp = await fetch(SB_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!resp.ok) {
    console.error('dbDelete error:', table, resp.status, await resp.text());
    throw new Error('Failed to delete from ' + table);
  }
}

// Upsert: Post with on_conflict support via Prefer header
async function dbUpsert(table, body, onConflict) {
  var headers = jsonHeaders();
  headers['Prefer'] = 'resolution=merge-duplicates';
  var qs = '';
  if (onConflict) {
    qs = '?on_conflict=' + onConflict;
  }
  var resp = await fetch(SB_URL + '/rest/v1/' + table + qs, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    console.error('dbUpsert error:', table, resp.status, await resp.text());
    throw new Error('Failed to upsert ' + table);
  }
  return resp.json();
}

// ============ User Display ============
function displayName() {
  var user = getStoredUser();
  if (user.user_metadata && user.user_metadata.display_name) {
    return user.user_metadata.display_name;
  }
  if (user.email) {
    return user.email.split('@')[0];
  }
  return '未登录';
}

function userId() {
  var user = getStoredUser();
  return user ? user.id : null;
}
