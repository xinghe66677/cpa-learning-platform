// CPA Learning Platform — Cloudflare Pages Worker
// Proxies: Supabase REST API + Auth + DeepSeek AI

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Proxy Supabase REST API (database queries)
    if (pathname.startsWith('/rest/v1/')) {
      return proxySupabase(url, request, env, 'rest');
    }

    // 2. Proxy Supabase Auth (GoTrue)
    if (pathname.startsWith('/auth/v1/')) {
      return proxySupabase(url, request, env, 'auth');
    }

    // 3. Proxy DeepSeek AI API
    if (pathname.startsWith('/ai/')) {
      return proxyAI(url, request, env);
    }

    // 4. Serve static assets (PDFs, HTML, JS, CSS, JSON, fonts)
    return env.ASSETS.fetch(request);
  }
};

async function proxySupabase(url, request, env, type) {
  const SUPABASE_URL = 'https://jjekyhaileozrslwgoei.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZWt5aGFpbGVvenJzbHdnb2VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDgwMTQsImV4cCI6MjA5NTI4NDAxNH0.urz5cnfpbakiiChjo4orgux9KNboKCmgGERvf3kUxQc';

  const targetUrl = SUPABASE_URL + url.pathname + url.search;

  // Clone headers from original request, but use our anon key as base
  const headers = new Headers(request.headers);
  headers.set('apikey', SUPABASE_KEY);
  // If no Authorization header from client, add anonymous Bearer
  if (!headers.has('Authorization') || headers.get('Authorization') === 'Bearer undefined') {
    headers.set('Authorization', 'Bearer ' + SUPABASE_KEY);
  }
  // Remove host header to avoid conflicts
  headers.delete('host');

  const resp = await fetch(targetUrl, {
    method: request.method,
    headers: headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  const respHeaders = new Headers(resp.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  respHeaders.set('Access-Control-Allow-Headers', '*');
  // Ensure inline display for PDFs
  if (url.pathname.includes('.pdf')) {
    respHeaders.set('Content-Disposition', 'inline');
  }

  return new Response(resp.body, {
    status: resp.status,
    headers: respHeaders,
  });
}

async function proxyAI(url, request, env) {
  const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY || '';

  // Replace /ai/ prefix with /v1/ for DeepSeek API
  const deepseekUrl = 'https://api.deepseek.com' + url.pathname.replace('/ai', '/v1') + url.search;

  const headers = new Headers();
  headers.set('Authorization', 'Bearer ' + DEEPSEEK_KEY);
  headers.set('Content-Type', 'application/json');

  let body = request.body;
  if (request.method === 'POST' && request.body) {
    // Pass through the body as-is (it's already JSON)
    body = request.body;
  }

  const resp = await fetch(deepseekUrl, {
    method: request.method,
    headers: headers,
    body: body,
  });

  const respHeaders = new Headers(resp.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  respHeaders.set('Access-Control-Allow-Headers', '*');

  // Handle streaming responses
  if (resp.headers.get('content-type')?.includes('text/event-stream')) {
    respHeaders.set('Content-Type', 'text/event-stream');
    respHeaders.set('Cache-Control', 'no-cache');
    respHeaders.set('Connection', 'keep-alive');
  }

  return new Response(resp.body, {
    status: resp.status,
    headers: respHeaders,
  });
}
