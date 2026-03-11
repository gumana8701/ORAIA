#!/usr/bin/env node
/**
 * Re-classify existing meeting_briefs that have no project_id or summary
 * Run: node scripts/reclassify-briefs.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

const VERTEX_PROJECT = 'genial-shuttle-489816-d4';
const VERTEX_LOCATION = 'us-central1';
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'google-service-account.json');

// Shared Google auth client for Vertex AI
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
      'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : '',
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

async function classifyWithGemini(briefContent, briefName, projects) {
  const projectList = projects.map(p => `- ID: ${p.id} | Nombre: ${p.nombre}`).join('\n');
  const prompt = `Eres un clasificador de reuniones para una agencia de desarrollo.

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
${briefContent.substring(0, 8000)}

Responde SOLO con JSON válido con esta estructura exacta:
{
  "project_id": "uuid-del-proyecto-o-null",
  "summary": "resumen ejecutivo",
  "decisions": ["decisión 1"],
  "action_items": ["tarea 1"],
  "participants": ["nombre 1"],
  "confidence": 0.0
}`;

  const token = await vertexAuth.getAccessToken();
  const res = await httpsRequest({
    hostname: `${VERTEX_LOCATION}-aiplatform.googleapis.com`,
    path: `/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/gemini-2.0-flash-001:generateContent`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, { contents: [{ parts: [{ text: prompt }], role: 'user' }], generationConfig: { temperature: 0.1 } });

  if (res.status === 429) {
    console.log('  ⏳ Rate limit, waiting 10s...');
    await new Promise(r => setTimeout(r, 10000));
    return classifyWithGemini(briefContent, briefName, projects);
  }

  try {
    const text = res.body.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('  Gemini parse error:', e.message, 'status:', res.status);
    return null;
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting re-classification...`);

  const accessToken = await getAccessToken();
  console.log('✅ Google auth OK');

  // Get unclassified briefs
  const briefs = await supabase('GET', '/rest/v1/meeting_briefs?select=id,title,drive_file_id&summary=is.null&order=meeting_date.desc');
  console.log(`📋 ${briefs.body.length} briefs to classify`);

  const projects = (await supabase('GET', '/rest/v1/projects?select=id,nombre&order=ultima_actividad.desc&limit=100')).body;
  console.log(`📁 ${projects.length} projects loaded`);

  let classified = 0;
  for (const brief of briefs.body) {
    console.log(`\n📄 ${brief.title}`);

    let content = '';
    try {
      content = await readDocContent(brief.drive_file_id, accessToken);
    } catch (e) {
      console.log(`  ⚠️ Can't read doc: ${e.message}`);
    }

    const classification = await classifyWithGemini(content || brief.title, brief.title, projects);
    
    if (classification) {
      const matchedProject = projects.find(p => p.id === classification.project_id);
      console.log(`  → ${matchedProject?.nombre || 'No match'} (${(classification.confidence * 100).toFixed(0)}%)`);

      await supabase('PATCH', `/rest/v1/meeting_briefs?id=eq.${brief.id}`, {
        project_id: classification.project_id,
        summary: classification.summary,
        decisions: classification.decisions || [],
        action_items: classification.action_items || [],
        participants: classification.participants || [],
        ai_confidence: classification.confidence || 0
      });
      classified++;
    } else {
      console.log('  ⚠️ Could not classify');
    }

    await new Promise(r => setTimeout(r, 4200));
  }

  console.log(`\n✅ Done. Classified ${classified}/${briefs.body.length} briefs.`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
