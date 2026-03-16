#!/usr/bin/env node
/**
 * Match Notion projects to Supabase projects by name similarity
 */
require('dotenv').config({ path: '.env.local', override: true });
const https = require('https');

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

function httpsReq(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function normalize(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function matchScore(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1.0;
  const aw = new Set(na.split(' ').filter(w => w.length > 2));
  const bw = new Set(nb.split(' ').filter(w => w.length > 2));
  let overlap = 0;
  for (const w of aw) if (bw.has(w)) overlap++;
  const total = Math.max(aw.size, bw.size);
  return total === 0 ? 0 : overlap / total;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const projects = await httpsReq('GET', `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/projects?select=id,nombre&limit=200`);
  const notion = await httpsReq('GET', `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notion_projects?select=id,nombre&limit=500`);
  
  // Deduplicate: for each Supabase project, find the best Notion match
  // But we want it the other way: for each Notion project, find best Supabase match
  // Use threshold 0.4
  const matches = [];
  const usedSupa = new Set(); // avoid multiple notion→same supa if poor match
  
  for (const np of notion) {
    let best = null, bestScore = 0;
    for (const sp of projects) {
      const score = matchScore(np.nombre, sp.nombre);
      if (score > bestScore) { bestScore = score; best = sp; }
    }
    if (bestScore >= 0.4 && best) {
      matches.push({ notion_id: np.id, project_id: best.id, score: bestScore, nn: np.nombre, sn: best.nombre });
    }
  }
  
  console.log(`Found ${matches.length} matches`);
  
  // Apply in batches using individual PATCHes
  let ok = 0, fail = 0;
  for (const m of matches) {
    try {
      await httpsReq('PATCH',
        `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notion_projects?id=eq.${encodeURIComponent(m.notion_id)}`,
        { project_id: m.project_id }
      );
      ok++;
    } catch (e) {
      fail++;
    }
    await sleep(50);
  }
  console.log(`Updated ${ok} notion_projects (${fail} failures)`);
  
  // Now update tasks
  let taskOk = 0;
  for (const m of matches) {
    try {
      await httpsReq('PATCH',
        `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notion_tasks?notion_project_id=eq.${encodeURIComponent(m.notion_id)}`,
        { project_id: m.project_id }
      );
      taskOk++;
    } catch (e) {}
    await sleep(50);
  }
  console.log(`Updated tasks for ${taskOk} notion projects`);
  
  // Verify
  const linked = await httpsReq('GET', `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notion_projects?select=id&project_id=not.is.null&limit=500`);
  console.log(`Total linked notion_projects: ${Array.isArray(linked) ? linked.length : '?'}`);
})();
