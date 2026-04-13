#!/usr/bin/env node
/**
 * ORAIA Notion Smart Match v2 — algorithmic (no AI needed)
 * Handles mismatched naming conventions between Notion and Supabase
 * 
 * Usage:
 *   node scripts/notion-match-v2.js          # dry run
 *   node scripts/notion-match-v2.js --apply  # apply to Supabase
 */

require('dotenv').config({ path: '.env.local', override: true });
const https = require('https');

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const APPLY = process.argv.includes('--apply');
const MIN_SCORE = 0.5;

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

function sbReq(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(NEXT_PUBLIC_SUPABASE_URL + path);
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Normalization ─────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '')
    // Remove emojis
    .replace(/[\u{1F300}-\u{1FFFF}]|\u{FE0F}/gu, '')
    // Lowercase + remove accents
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Remove common noise words/prefixes
    .replace(/\b(dfy|dwy|poc|prueba de concepto|partnership|ora\s*ia|ora-ia|x\s*ora\s*ia|chatbot|chat|bt|voz|agente de voz|sesion\s*\d+|sesión\s*\d+)\b/g, '')
    // Remove "- X ORA IA" type suffixes
    .replace(/[xX]\s*ora\s*[ia]+/g, '')
    // Remove separators
    .replace(/[\/\\|+\-&]/g, ' ')
    // Remove parentheses content (short abbreviations like "(ISI)" often don't match)
    // Keep content if it's long (company name), remove if short (abbreviation)
    .replace(/\(([^)]{1,5})\)/g, ' $1 ')
    .replace(/\(([^)]{6,})\)/g, ' $1 ')
    // Remove special chars except alphanumeric and space
    .replace(/[^a-z0-9 ]/g, ' ')
    // Collapse spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract meaningful tokens (words > 2 chars, skip noise)
const STOPWORDS = new Set(['the', 'and', 'for', 'con', 'los', 'las', 'del', 'der', 'von', 'inc', 'llc', 'sas', 'srl', 'ltd', 'corp']);
function tokens(s) {
  return normalize(s).split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
}

// Score: token overlap + substring bonus
function score(notionName, supaName) {
  const nt = tokens(notionName);
  const st = tokens(supaName);
  if (nt.length === 0 || st.length === 0) return 0;

  // Token overlap
  let overlap = 0;
  for (const w of nt) {
    if (st.some(sw => sw === w || sw.startsWith(w) || w.startsWith(sw))) overlap++;
  }
  const tokenScore = overlap / Math.max(nt.length, st.length);

  // Substring match bonus: if any long token from one appears in the other's raw normalized string
  const nn = normalize(notionName);
  const sn = normalize(supaName);
  let subBonus = 0;
  for (const w of nt) {
    if (w.length >= 4 && sn.includes(w)) subBonus += 0.15;
  }
  for (const w of st) {
    if (w.length >= 4 && nn.includes(w)) subBonus += 0.15;
  }

  return Math.min(1.0, tokenScore + subBonus);
}

// For Notion names like "Person / Company" — try both parts
function scoreNotion(notionName, supaName) {
  const parts = notionName.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
  let best = score(notionName, supaName);
  for (const part of parts) {
    best = Math.max(best, score(part, supaName));
  }
  return best;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🚀 ORAIA Notion Smart Match v2\n   Mode: ${APPLY ? '✍️  APPLY' : '👁️  DRY RUN'}\n`);

  // Fetch all unlinked Notion DFY/Partnership/PoC
  const notionUnlinked = await sbReq('GET',
    '/rest/v1/notion_projects?select=id,nombre,plan_type&project_id=is.null&plan_type=in.(DFY,Partnership,Prueba de concepto)&limit=300&order=nombre'
  );

  // Fetch all Supabase projects (unlinked to Notion)
  const supaAll = await sbReq('GET', '/rest/v1/projects?select=id,nombre&limit=300&order=nombre');

  // Also fetch already-linked notion_projects to know which supabase projects are taken
  const alreadyLinked = await sbReq('GET',
    '/rest/v1/notion_projects?select=project_id&project_id=not.is.null&limit=300'
  );
  const linkedSupa = new Set(alreadyLinked.map(r => r.project_id).filter(Boolean));

  console.log(`📋 Unlinked Notion (DFY/Part/PoC): ${notionUnlinked.length}`);
  console.log(`🗄️  Supabase projects: ${supaAll.length} (${linkedSupa.size} already have a Notion link)\n`);

  // Deduplicate Notion by name (keep first occurrence)
  const seenNames = new Map();
  const uniqueNotion = [];
  for (const np of notionUnlinked) {
    const key = np.nombre.toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.set(key, np.id);
      uniqueNotion.push(np);
    }
  }

  // Score all pairs
  const candidates = [];
  for (const np of uniqueNotion) {
    let best = null, bestScore = 0;
    for (const sp of supaAll) {
      const s = scoreNotion(np.nombre, sp.nombre);
      if (s > bestScore) { bestScore = s; best = sp; }
    }
    if (bestScore >= MIN_SCORE && best) {
      candidates.push({ notionId: np.id, notionName: np.nombre, supaId: best.id, supaName: best.nombre, score: bestScore });
    }
  }

  // Sort by score desc
  candidates.sort((a, b) => b.score - a.score);

  // Deduplicate: one supabase project per match (highest score wins)
  const usedSupa = new Set();
  const finalMatches = [];
  for (const c of candidates) {
    if (!usedSupa.has(c.supaId)) {
      usedSupa.add(c.supaId);
      finalMatches.push(c);
    }
  }

  // Print results
  console.log('='.repeat(72));
  console.log('PROPOSED MATCHES:');
  console.log('='.repeat(72));
  let highConf = 0, medConf = 0;
  for (const m of finalMatches) {
    const pct = Math.round(m.score * 100);
    const icon = pct >= 80 ? '✅' : pct >= 65 ? '🟡' : '🔶';
    if (pct >= 80) highConf++; else medConf++;
    const alreadyTag = linkedSupa.has(m.supaId) ? ' [⚠️ supabase already linked]' : '';
    console.log(`${icon} [${pct}%] "${m.notionName}"`);
    console.log(`       → "${m.supaName}"${alreadyTag}`);
  }

  console.log(`\n📊 Summary: ${finalMatches.length} matches found`);
  console.log(`   ✅ High conf (≥80%): ${highConf}`);
  console.log(`   🟡 Medium conf (65-79%): ${medConf}`);
  console.log(`   🔶 Low conf (<65%): ${finalMatches.length - highConf - medConf}`);

  if (!APPLY) {
    console.log('\nℹ️  DRY RUN — run with --apply to save.\n');
    return;
  }

  // Apply — for each match, update all duplicate Notion entries with same name
  console.log('\nApplying matches...');
  let ok = 0, fail = 0;
  for (const m of finalMatches) {
    // Only skip if supabase already has a DIFFERENT notion link
    if (linkedSupa.has(m.supaId)) {
      console.log(`  ⏭️  Skipping "${m.notionName}" — Supabase project already linked`);
      continue;
    }

    // Find all Notion entries with same name (duplicates)
    const sameNameIds = notionUnlinked
      .filter(np => np.nombre.toLowerCase().trim() === m.notionName.toLowerCase().trim())
      .map(np => np.id);

    for (const nid of sameNameIds) {
      try {
        await sbReq('PATCH', `/rest/v1/notion_projects?id=eq.${encodeURIComponent(nid)}`, { project_id: m.supaId });
        await sbReq('PATCH', `/rest/v1/notion_tasks?notion_project_id=eq.${encodeURIComponent(nid)}`, { project_id: m.supaId });
        ok++;
      } catch (e) {
        fail++;
        console.error(`  ❌ Failed ${nid}:`, e.message);
      }
      await sleep(50);
    }
  }

  console.log(`\n✅ Applied ${ok} links (${fail} failures)`);

  const linkedNow = await sbReq('GET', '/rest/v1/notion_projects?select=id&project_id=not.is.null&limit=500');
  console.log(`📈 Total linked notion_projects: ${Array.isArray(linkedNow) ? linkedNow.length : '?'}`);
}

main().catch(e => { console.error('💥 Fatal:', e); process.exit(1); });
