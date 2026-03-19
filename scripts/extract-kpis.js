#!/usr/bin/env node
/**
 * ORAIA KPI Extractor
 * Finds "Sesión de Bienvenida" meeting briefs → extracts KPIs → stores in project_kpis
 * 
 * Run: node scripts/extract-kpis.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
  GEMINI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

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
      'Prefer': method === 'POST' ? 'return=representation' : '',
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
  const res = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
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

// ─── Is a welcome/onboarding session? ─────────────────────────────────────────

function isWelcomeSession(title) {
  const t = title.toLowerCase();
  return t.includes('bienvenida') || t.includes('onboarding') || t.includes('welcome') || t.includes('sesion inicial') || t.includes('sesión inicial');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[${new Date().toISOString()}] Starting KPI extraction...`);

  const accessToken = await getAccessToken();
  console.log('✅ Google auth OK');

  // Get all welcome session briefs that have a project_id
  const briefs = await supabase('GET', '/rest/v1/meeting_briefs?select=id,title,drive_file_id,project_id&project_id=not.is.null&order=meeting_date.asc');
  const welcomeBriefs = (briefs.body || []).filter((b) => isWelcomeSession(b.title));
  console.log(`📋 Found ${welcomeBriefs.length} welcome session briefs with project assignments`);

  // Get projects that already have KPIs (skip them)
  const existingKpis = await supabase('GET', '/rest/v1/project_kpis?select=project_id');
  const projectsWithKpis = new Set((existingKpis.body || []).map((k) => k.project_id));

  const toProcess = welcomeBriefs.filter(b => !projectsWithKpis.has(b.project_id));
  console.log(`🆕 ${toProcess.length} projects need KPI extraction`);

  if (toProcess.length === 0) {
    console.log('All projects with welcome sessions already have KPIs. Nothing to do.');
    return;
  }

  for (const brief of toProcess) {
    console.log(`\n📄 ${brief.title}`);

    let content = '';
    try {
      content = await readDocContent(brief.drive_file_id, accessToken);
    } catch (e) {
      console.log(`  ⚠️ Can't read doc: ${e.message}`);
    }

    const result = await gemini(`Eres un analista de proyectos de una agencia de desarrollo.

Analiza esta transcripción de una sesión de bienvenida/onboarding con un cliente y extrae los KPIs o métricas de éxito que se discutieron. Estos son los indicadores que determinarán si el proyecto fue exitoso.

Transcripción:
${(content || brief.title).substring(0, 8000)}

Responde SOLO con JSON válido:
{
  "kpis": [
    {
      "kpi_text": "descripción clara del KPI",
      "categoria": "ventas|satisfaccion|tiempo|crecimiento|retencion|general",
      "meta": "valor objetivo si se mencionó, o null"
    }
  ]
}

Si no se mencionaron KPIs explícitos, devuelve {"kpis": []}`);

    if (result?.kpis?.length > 0) {
      const records = result.kpis.map((k) => ({
        project_id: brief.project_id,
        kpi_text: k.kpi_text,
        categoria: k.categoria || 'general',
        meta: k.meta || null,
        source_brief_id: brief.id,
        confirmado: false
      }));

      for (const record of records) {
        await supabase('POST', '/rest/v1/project_kpis', record);
      }

      console.log(`  ✅ Extracted ${result.kpis.length} KPIs`);
      result.kpis.forEach((k) => console.log(`     • ${k.kpi_text}${k.meta ? ' → ' + k.meta : ''}`));
    } else {
      console.log('  ⚠️ No KPIs found in this session');
    }

    await new Promise(r => setTimeout(r, 4200));
  }

  console.log('\n✅ KPI extraction complete.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
