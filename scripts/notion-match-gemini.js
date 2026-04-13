#!/usr/bin/env node
/**
 * ORAIA Notion Smart Match via Gemini
 * Matches unlinked Notion DFY/Partnership/PoC projects → Supabase projects
 * using AI for fuzzy name matching (handles different naming conventions)
 * 
 * Usage:
 *   node scripts/notion-match-gemini.js          # dry run (preview only)
 *   node scripts/notion-match-gemini.js --apply  # apply matches to Supabase
 */

require('dotenv').config({ path: '.env.local', override: true });
const https = require('https');

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY
} = process.env;

const APPLY = process.argv.includes('--apply');
const MIN_CONFIDENCE = 0.7; // only auto-apply high-confidence matches

function httpsReq(method, hostname, path, headers, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...headers
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function sbReq(method, path, body = null) {
  const u = new URL(NEXT_PUBLIC_SUPABASE_URL + path);
  return httpsReq(method, u.hostname, u.pathname + u.search, {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Prefer': 'return=minimal'
  }, body);
}

async function geminiMatch(notionProjects, supabaseProjects) {
  const prompt = `You are matching Notion project names to Supabase project names for an AI agency called ORA AI.

The Notion names follow patterns like:
- "Person Name / Company Name"
- "Chat - Person / Company"
- "BT - Company / Person"
- Just a company name

The Supabase names follow patterns like:
- "🟡 DFY - Company x ORA IA"
- "ORA IA - Person Name"  
- "DFY - Person - COMPANY"
- Just a name

Your task: For each Notion project, find the best matching Supabase project (if any).

SUPABASE PROJECTS (id → name):
${supabaseProjects.map(p => `${p.id}|${p.nombre}`).join('\n')}

NOTION PROJECTS TO MATCH (id → name):
${notionProjects.map(p => `${p.id}|${p.nombre}`).join('\n')}

Respond ONLY with a JSON array (no markdown, no explanation):
[
  { "notion_id": "...", "supabase_id": "...", "confidence": 0.0-1.0, "reason": "brief reason" },
  ...
]

Rules:
- Only include matches where confidence >= 0.6
- If no good match exists, omit the Notion project entirely
- confidence 1.0 = exact match, 0.8 = very likely same entity, 0.6 = possible match
- Match on company name or person name (either is valid)
- Ignore "DFY", "ORA IA", "Chat", "BT", plan prefixes, and emojis when comparing
- One Notion project can map to one Supabase project (avoid duplicates if possible)
`;

  const res = await httpsReq('POST',
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {},
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
    }
  );

  if (!res.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error('Gemini error:', JSON.stringify(res).slice(0, 300));
    return [];
  }

  const raw = res.candidates[0].content.parts[0].text.trim();
  // Strip markdown code blocks if present (handles ```json ... ``` and ``` ... ```)
  const clean = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
  
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Try to extract JSON array from the response
    const match = clean.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    console.error('Failed to parse Gemini response:', raw.slice(0, 300));
    return [];
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`🚀 ORAIA Notion Smart Match (Gemini)\n   Mode: ${APPLY ? '✍️  APPLY' : '👁️  DRY RUN (preview only)'}\n`);

  // 1. Fetch unlinked Notion projects (DFY + Partnership + PoC)
  const notionUnlinked = await sbReq('GET',
    '/rest/v1/notion_projects?select=id,nombre,plan_type&project_id=is.null&plan_type=in.(DFY,Partnership,Prueba de concepto)&limit=300&order=nombre'
  );
  
  // Deduplicate by nombre (sometimes same client appears twice)
  const seenNotion = new Set();
  const uniqueNotion = [];
  for (const np of notionUnlinked) {
    const key = np.nombre.toLowerCase().trim();
    if (!seenNotion.has(key)) {
      seenNotion.add(key);
      uniqueNotion.push(np);
    }
  }
  
  console.log(`📋 Unlinked Notion projects (DFY/Part/PoC): ${notionUnlinked.length} (${uniqueNotion.length} unique names)`);

  // 2. Fetch all Supabase projects
  const supaProjects = await sbReq('GET',
    '/rest/v1/projects?select=id,nombre&limit=300&order=nombre'
  );
  console.log(`🗄️  Supabase projects: ${supaProjects.length}\n`);

  // 3. Process in batches of 20 to stay within token limits
  const BATCH = 20;
  const allMatches = [];

  for (let i = 0; i < uniqueNotion.length; i += BATCH) {
    const batch = uniqueNotion.slice(i, i + BATCH);
    console.log(`⚡ Processing batch ${Math.floor(i/BATCH)+1}/${Math.ceil(uniqueNotion.length/BATCH)} (${batch.length} projects)...`);
    
    const matches = await geminiMatch(batch, supaProjects);
    console.log(`   → ${matches.length} matches found`);
    allMatches.push(...matches);
    
    if (i + BATCH < uniqueNotion.length) await sleep(1000); // rate limit
  }

  // 4. Filter by confidence and deduplicate Supabase targets
  const highConf = allMatches.filter(m => m.confidence >= MIN_CONFIDENCE);
  const usedSupa = new Set();
  const finalMatches = [];
  
  // Sort by confidence desc, take highest for each supabase target
  highConf.sort((a, b) => b.confidence - a.confidence);
  for (const m of highConf) {
    if (!usedSupa.has(m.supabase_id)) {
      usedSupa.add(m.supabase_id);
      finalMatches.push(m);
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Total Gemini suggestions: ${allMatches.length}`);
  console.log(`   High confidence (≥${MIN_CONFIDENCE}): ${highConf.length}`);
  console.log(`   After dedup: ${finalMatches.length}\n`);

  // 5. Build lookup maps for display
  const notionMap = Object.fromEntries(notionUnlinked.map(p => [p.id, p.nombre]));
  const supaMap = Object.fromEntries(supaProjects.map(p => [p.id, p.nombre]));

  // 6. Show preview
  console.log('='.repeat(70));
  console.log('PROPOSED MATCHES:');
  console.log('='.repeat(70));
  for (const m of finalMatches.sort((a, b) => b.confidence - a.confidence)) {
    const conf = Math.round(m.confidence * 100);
    const icon = conf >= 90 ? '✅' : conf >= 75 ? '🟡' : '🔶';
    console.log(`${icon} [${conf}%] ${notionMap[m.notion_id] || m.notion_id}`);
    console.log(`        → ${supaMap[m.supabase_id] || m.supabase_id}`);
    console.log(`        (${m.reason})`);
    console.log();
  }

  if (!APPLY) {
    console.log('='.repeat(70));
    console.log('ℹ️  DRY RUN — nothing was changed.');
    console.log('   Run with --apply to save matches to Supabase.\n');
    return;
  }

  // 7. Apply matches
  console.log('='.repeat(70));
  console.log('Applying matches...\n');
  
  let ok = 0, fail = 0;
  for (const m of finalMatches) {
    // Find all Notion entries with same name (duplicates) and link them all
    const notionName = notionMap[m.notion_id];
    const sameNameIds = notionUnlinked
      .filter(np => np.nombre.toLowerCase().trim() === notionName?.toLowerCase().trim())
      .map(np => np.id);
    
    for (const nid of sameNameIds) {
      try {
        await sbReq('PATCH',
          `/rest/v1/notion_projects?id=eq.${encodeURIComponent(nid)}`,
          { project_id: m.supabase_id }
        );
        // Also update tasks
        await sbReq('PATCH',
          `/rest/v1/notion_tasks?notion_project_id=eq.${encodeURIComponent(nid)}`,
          { project_id: m.supabase_id }
        );
        ok++;
      } catch (e) {
        fail++;
        console.error(`Failed for ${nid}:`, e.message);
      }
      await sleep(50);
    }
  }

  console.log(`\n✅ Applied ${ok} links (${fail} failures)`);
  
  // Final count
  const linkedNow = await sbReq('GET',
    '/rest/v1/notion_projects?select=id&project_id=not.is.null&limit=1000'
  );
  console.log(`\n📈 Total linked notion_projects now: ${Array.isArray(linkedNow) ? linkedNow.length : '?'}`);
}

main().catch(e => {
  console.error('💥 Fatal:', e);
  process.exit(1);
});
