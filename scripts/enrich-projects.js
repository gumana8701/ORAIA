#!/usr/bin/env node
/**
 * ORAIA Project Enricher
 * For each project: reads all its meeting briefs → fills missing nicho + KPIs via Gemini
 * Run: node scripts/enrich-projects.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
  GEMINI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

const VERTEX_PROJECT = 'genial-shuttle-489816-d4';
const VERTEX_LOCATION = 'us-central1';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'google-service-account.json');

const vertexAuth = new GoogleAuth({
  keyFile: SERVICE_ACCOUNT_PATH,
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body === null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    if (bodyStr && !options.headers['Content-Length']) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function supabase(method, path, body = null) {
  const url = new URL(NEXT_PUBLIC_SUPABASE_URL + path);
  const bodyStr = body ? JSON.stringify(body) : null;
  return httpsRequest({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': (method === 'POST' || method === 'PATCH') ? 'return=representation' : '',
      ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
    }
  }, bodyStr);
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }).toString();
  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  return res.body.access_token;
}

async function readDocContent(fileId, accessToken) {
  try {
    const res = await httpsRequest({
      hostname: 'www.googleapis.com',
      path: `/drive/v3/files/${fileId}/export?mimeType=text/plain`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
  } catch (e) {
    return '';
  }
}

async function gemini(prompt, retries = 5) {
  const res = await httpsRequest({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } });

  if (res.status === 429 && retries > 0) {
    console.log('  ⏳ Rate limit, waiting 60s...');
    await new Promise(r => setTimeout(r, 60000));
    return gemini(prompt, retries - 1);
  }

  const text = res.body.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  try { return match ? JSON.parse(match[0]) : null; }
  catch { return null; }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting project enrichment...`);

  const accessToken = await getAccessToken();
  console.log('✅ Google auth OK');

  // Load all projects
  const projectsRes = await supabase('GET', '/rest/v1/projects?select=id,nombre,nicho&order=ultima_actividad.desc&limit=200');
  const projects = projectsRes.body || [];
  console.log(`📁 ${projects.length} projects loaded`);

  // Load existing KPIs (project_ids that already have at least one)
  const kpisRes = await supabase('GET', '/rest/v1/project_kpis?select=project_id');
  const projectsWithKpis = new Set((kpisRes.body || []).map(k => k.project_id));

  // Load all briefs with project_id assigned
  const briefsRes = await supabase('GET', '/rest/v1/meeting_briefs?select=id,title,drive_file_id,project_id,summary&project_id=not.is.null&order=meeting_date.asc');
  const allBriefs = briefsRes.body || [];
  console.log(`📋 ${allBriefs.length} assigned briefs available`);

  // Group briefs by project
  const briefsByProject = {};
  for (const b of allBriefs) {
    if (!briefsByProject[b.project_id]) briefsByProject[b.project_id] = [];
    briefsByProject[b.project_id].push(b);
  }

  let enrichedCount = 0;
  let kpiCount = 0;
  let nichoCount = 0;

  for (const project of projects) {
    const briefs = briefsByProject[project.id] || [];
    if (briefs.length === 0) continue;

    const needsNicho = !project.nicho;
    const needsKpis = !projectsWithKpis.has(project.id);

    if (!needsNicho && !needsKpis) continue;

    console.log(`\n🏢 ${project.nombre} (${briefs.length} briefs)`);
    if (needsNicho) console.log('   ⚠️  Missing: nicho');
    if (needsKpis)  console.log('   ⚠️  Missing: KPIs');

    // Build context from briefs (use summaries if available, else read docs)
    let context = '';
    for (const b of briefs.slice(0, 5)) {
      if (b.summary) {
        context += `\n--- ${b.title} ---\n${b.summary}\n`;
      } else if (b.drive_file_id) {
        const content = await readDocContent(b.drive_file_id, accessToken);
        context += `\n--- ${b.title} ---\n${content.substring(0, 2000)}\n`;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    if (!context.trim()) {
      console.log('   ⚠️  No usable content, skipping');
      continue;
    }

    const prompt = `Eres un analista de proyectos para una agencia de agentes de IA y automatización.

Analiza el siguiente contexto de reuniones de un cliente llamado "${project.nombre}" y extrae:

${needsNicho ? '1. nicho: el sector o industria del cliente (ej: "Automotriz", "Educación", "Salud", "Bienes Raíces", "Fintech", etc.)' : ''}
${needsKpis ? `${needsNicho ? '2' : '1'}. kpis: lista de KPIs o métricas de éxito discutidas con el cliente` : ''}

Contexto de reuniones:
${context.substring(0, 6000)}

Responde SOLO con JSON válido:
{
  ${needsNicho ? '"nicho": "sector del cliente en 1-3 palabras",' : ''}
  ${needsKpis ? `"kpis": [
    {
      "kpi_text": "descripción del KPI",
      "categoria": "ventas|satisfaccion|tiempo|crecimiento|retencion|general",
      "meta": "valor objetivo o null"
    }
  ]` : '"kpis": []'}
}`;

    const result = await gemini(prompt);

    if (!result) {
      console.log('   ⚠️  Gemini returned null');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // Update nicho if needed
    if (needsNicho && result.nicho) {
      await supabase('PATCH', `/rest/v1/projects?id=eq.${project.id}`, { nicho: result.nicho });
      console.log(`   ✅ nicho → "${result.nicho}"`);
      nichoCount++;
    }

    // Insert KPIs if needed
    if (needsKpis && result.kpis?.length > 0) {
      // Use the most recent brief as source
      const sourceBrief = briefs[briefs.length - 1];
      for (const k of result.kpis) {
        await supabase('POST', '/rest/v1/project_kpis', {
          project_id: project.id,
          kpi_text: k.kpi_text,
          categoria: k.categoria || 'general',
          meta: k.meta || null,
          source_brief_id: sourceBrief.id,
          confirmado: false
        });
      }
      console.log(`   ✅ KPIs → ${result.kpis.length} extracted`);
      result.kpis.forEach(k => console.log(`      • ${k.kpi_text}${k.meta ? ' → ' + k.meta : ''}`));
      kpiCount += result.kpis.length;
      projectsWithKpis.add(project.id); // mark as done
    } else if (needsKpis) {
      console.log('   ⚠️  No KPIs found in meetings for this project');
    }

    enrichedCount++;
    await new Promise(r => setTimeout(r, 4200));
  }

  console.log(`\n✅ Enrichment complete.`);
  console.log(`   Projects processed: ${enrichedCount}`);
  console.log(`   Nicho filled: ${nichoCount}`);
  console.log(`   KPIs added: ${kpiCount}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
