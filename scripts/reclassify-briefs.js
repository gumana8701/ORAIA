#!/usr/bin/env node
/**
 * Re-classify existing meeting_briefs that have no project_id or summary
 * Run: node scripts/reclassify-briefs.js
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

async function classifyWithGemini(briefContent, briefName, projects, retries = 5) {
  const projectList = projects.map(p => `- ID: ${p.id} | Nombre: ${p.nombre}`).join('\n');
  const prompt = `Eres un clasificador de reuniones para una agencia de IA.

Analiza este brief de reunión de Google Meet y extrae:
1. A qué proyecto pertenece (o null si no se puede determinar)
2. Resumen ejecutivo en 2-3 oraciones
3. Decisiones clave tomadas (lista)
4. Pendientes o tareas mencionadas (lista)
5. Participantes mencionados (lista de nombres)

Proyectos disponibles:
${projectList}

Nombre de la reunión: ${briefName}

Contenido del brief:
${(briefContent || briefName).substring(0, 8000)}

Responde SOLO con JSON válido:
{
  "project_id": "uuid-del-proyecto-o-null",
  "summary": "resumen ejecutivo",
  "decisions": ["decisión 1"],
  "action_items": ["tarea 1"],
  "participants": ["nombre 1"],
  "confidence": 0.0
}`;

  const res = await httpsRequest({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } });

  if (res.status === 429 && retries > 0) {
    console.log('  ⏳ Rate limit, waiting 60s...');
    await new Promise(r => setTimeout(r, 60000));
    return classifyWithGemini(briefContent, briefName, projects, retries - 1);
  }

  if (res.status !== 200) {
    console.log(`  ⚠️ Gemini error ${res.status}:`, JSON.stringify(res.body).substring(0, 200));
    return null;
  }

  try {
    const text = res.body.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('  Gemini parse error:', e.message);
    return null;
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting re-classification...`);

  const accessToken = await getAccessToken();
  console.log('✅ Google auth OK');

  // Get unclassified briefs: no summary OR no project_id
  const noSummary = await supabase('GET', '/rest/v1/meeting_briefs?select=id,title,drive_file_id&summary=is.null&order=meeting_date.desc');
  const noProject = await supabase('GET', '/rest/v1/meeting_briefs?select=id,title,drive_file_id&project_id=is.null&order=meeting_date.desc');
  // Merge deduped by id
  const seen = new Set();
  const merged = [...(noSummary.body || []), ...(noProject.body || [])].filter(b => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
  console.log(`📋 ${merged.length} briefs to classify (${noSummary.body.length} no-summary, ${noProject.body.length} no-project)`);

  const projects = (await supabase('GET', '/rest/v1/projects?select=id,nombre&order=ultima_actividad.desc&limit=200')).body;
  console.log(`📁 ${projects.length} projects loaded`);

  let classified = 0;
  for (const brief of merged) {
    console.log(`\n📄 ${brief.title}`);

    const content = await readDocContent(brief.drive_file_id, accessToken);

    const classification = await classifyWithGemini(content, brief.title, projects);

    if (classification) {
      const matchedProject = projects.find(p => p.id === classification.project_id);
      console.log(`  → ${matchedProject?.nombre || 'No match'} (${(classification.confidence * 100).toFixed(0)}%)`);

      await supabase('PATCH', `/rest/v1/meeting_briefs?id=eq.${brief.id}`, {
        project_id: classification.project_id || null,
        summary: classification.summary || null,
        decisions: classification.decisions || [],
        action_items: classification.action_items || [],
        participants: classification.participants || [],
        ai_confidence: classification.confidence || 0
      });
      if (classification.project_id) classified++;
    } else {
      console.log('  ⚠️ Could not classify');
    }

    await new Promise(r => setTimeout(r, 4200));
  }

  console.log(`\n✅ Done. Assigned to project: ${classified}/${merged.length} briefs.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
