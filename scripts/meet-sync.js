#!/usr/bin/env node
/**
 * ORAIA Meet Sync
 * Scans Google Drive for Gemini Meet briefs → finds recording + transcript → classifies → stores in Supabase
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

// ─── helpers ──────────────────────────────────────────────────────────────────

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
  const res = await httpsRequest({
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
  return res;
}

// ─── Step 1: Get Google access token ──────────────────────────────────────────

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  }).toString();

  const res = await httpsRequest({
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, body);

  if (!res.body.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(res.body));
  return res.body.access_token;
}

// ─── Step 2: List Meet briefs from Drive ──────────────────────────────────────

async function listMeetBriefs(accessToken) {
  const query = encodeURIComponent(
    "(name contains 'Notas de Gemini' or name contains 'Gemini Notes' or name contains 'Notes by Gemini') and mimeType='application/vnd.google-apps.document' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,createdTime,modifiedTime,webViewLink,parents)');
  const orderBy = encodeURIComponent('createdTime desc');

  const res = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files?q=${query}&fields=${fields}&orderBy=${orderBy}&pageSize=50`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  return res.body.files || [];
}

// ─── Step 3: Find sibling files (recording + transcript) in same folder ───────

async function findSiblingFiles(parentFolderId, meetingTitle, accessToken) {
  if (!parentFolderId) return { recordingUrl: null, transcriptText: null };

  // Get all files in the same folder
  const query = encodeURIComponent(`'${parentFolderId}' in parents and trashed=false`);
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,webContentLink)');

  const res = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files?q=${query}&fields=${fields}&pageSize=50`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const files = res.body.files || [];
  console.log(`  📁 Folder has ${files.length} files`);

  let recordingUrl = null;
  let transcriptText = null;

  for (const file of files) {
    const nameLower = file.name.toLowerCase();

    // Recording: video/mp4 or file with "grabacion" / "recording" in name
    if (
      file.mimeType === 'video/mp4' ||
      nameLower.includes('recording') ||
      nameLower.includes('grabaci')
    ) {
      // Use webViewLink for Drive viewer, or direct link
      recordingUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
      console.log(`  🎬 Recording found: ${file.name}`);
    }

    // Transcript: Google Doc with "transcript" or "transcripci" in name
    if (
      file.mimeType === 'application/vnd.google-apps.document' &&
      (nameLower.includes('transcript') || nameLower.includes('transcripci'))
    ) {
      try {
        const textRes = await httpsRequest({
          hostname: 'www.googleapis.com',
          path: `/drive/v3/files/${file.id}/export?mimeType=text/plain`,
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        transcriptText = typeof textRes.body === 'string' ? textRes.body : JSON.stringify(textRes.body);
        console.log(`  📝 Transcript found: ${file.name} (${transcriptText.length} chars)`);
      } catch (e) {
        console.log(`  ⚠️ Could not read transcript: ${e.message}`);
      }
    }
  }

  return { recordingUrl, transcriptText };
}

// ─── Step 4: Read brief content ───────────────────────────────────────────────

async function readDocContent(fileId, accessToken) {
  const res = await httpsRequest({
    hostname: 'www.googleapis.com',
    path: `/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
}

// ─── Step 5: Classify with Gemini ─────────────────────────────────────────────

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
  "decisions": ["decisión 1", "decisión 2"],
  "action_items": ["tarea 1", "tarea 2"],
  "participants": ["nombre 1", "nombre 2"],
  "confidence": 0.0-1.0
}`;

  const res = await httpsRequest({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1 }
  });

  try {
    const text = res.body.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    console.error('Gemini parse error:', e.message);
    return null;
  }
}

// ─── Step 6: Store in Supabase ────────────────────────────────────────────────

async function storeBrief(briefName, classification, driveFileId, driveLink, meetingDate, rawContent, recordingUrl, transcriptText) {
  const record = {
    drive_file_id: driveFileId,
    title: briefName,
    meeting_date: meetingDate,
    drive_link: driveLink,
    project_id: classification?.project_id || null,
    summary: classification?.summary || null,
    decisions: classification?.decisions || [],
    action_items: classification?.action_items || [],
    participants: classification?.participants || [],
    ai_confidence: classification?.confidence || 0,
    transcript_raw: rawContent ? rawContent.substring(0, 50000) : null,
    recording_url: recordingUrl || null,
    ...(transcriptText ? { transcript_text: transcriptText.substring(0, 100000) } : {})
  };

  const res = await supabase('POST', '/rest/v1/meeting_briefs', record);
  return res;
}

// ─── Step 7: Update existing brief with recording/transcript ──────────────────

async function updateBriefMedia(briefId, recordingUrl, transcriptText) {
  const patch = {};
  if (recordingUrl) patch.recording_url = recordingUrl;
  if (transcriptText) patch.transcript_text = transcriptText.substring(0, 100000);
  if (Object.keys(patch).length === 0) return;

  await supabase('PATCH', `/rest/v1/meeting_briefs?id=eq.${briefId}`, patch);
}

// ─── Step 8: Get already-processed briefs ─────────────────────────────────────

async function getProcessedBriefs() {
  const res = await supabase('GET', '/rest/v1/meeting_briefs?select=id,drive_file_id,recording_url');
  if (Array.isArray(res.body)) {
    return res.body;
  }
  return [];
}

// ─── Step 9: Get projects for classification ──────────────────────────────────

async function getProjects() {
  const res = await supabase('GET', '/rest/v1/projects?select=id,nombre&order=ultima_actividad.desc&limit=100');
  return Array.isArray(res.body) ? res.body : [];
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[${new Date().toISOString()}] Starting Meet brief sync...`);

  try {
    const accessToken = await getAccessToken();
    console.log('✅ Google auth OK');

    const briefs = await listMeetBriefs(accessToken);
    console.log(`📋 Found ${briefs.length} Meet briefs in Drive`);

    if (briefs.length === 0) {
      console.log('No briefs found. Check Drive search query or meeting names.');
      return;
    }

    const processedBriefs = await getProcessedBriefs();
    const processedIds = new Set(processedBriefs.map(b => b.drive_file_id));

    // Also find existing briefs missing recording_url to backfill
    const missingRecording = processedBriefs.filter(b => !b.recording_url);
    const newBriefs = briefs.filter(b => !processedIds.has(b.id));

    console.log(`🆕 ${newBriefs.length} new briefs to process`);
    console.log(`🔄 ${missingRecording.length} existing briefs missing recording URL`);

    const projects = await getProjects();
    console.log(`📁 Loaded ${projects.length} projects for classification`);

    // Process new briefs
    for (const brief of newBriefs) {
      console.log(`\n📄 Processing: ${brief.name}`);

      const content = await readDocContent(brief.id, accessToken);

      // Find recording + transcript in same folder
      const parentFolderId = brief.parents?.[0] || null;
      const { recordingUrl, transcriptText } = await findSiblingFiles(parentFolderId, brief.name, accessToken);

      const classification = await classifyWithGemini(content, brief.name, projects);

      if (classification) {
        const matchedProject = projects.find(p => p.id === classification.project_id);
        console.log(`  → Project: ${matchedProject?.nombre || 'No match'} (confidence: ${(classification.confidence * 100).toFixed(0)}%)`);
      }

      if (recordingUrl) console.log(`  → Recording: ${recordingUrl}`);
      if (transcriptText) console.log(`  → Transcript: ${transcriptText.length} chars`);

      const storeRes = await storeBrief(
        brief.name, classification, brief.id, brief.webViewLink,
        brief.createdTime, content, recordingUrl, transcriptText
      );

      if (storeRes.status >= 200 && storeRes.status < 300) {
        console.log(`  ✅ Stored`);
      } else {
        console.log(`  ❌ Store failed (${storeRes.status}):`, JSON.stringify(storeRes.body));
      }

      await new Promise(r => setTimeout(r, 4200));
    }

    // Backfill recording URLs for existing briefs (check the first 10 missing ones)
    const toBackfill = missingRecording.slice(0, 10);
    if (toBackfill.length > 0) {
      console.log(`\n🔄 Backfilling recording URLs for ${toBackfill.length} briefs...`);
      for (const existing of toBackfill) {
        const driveFile = briefs.find(b => b.id === existing.drive_file_id);
        if (!driveFile?.parents?.[0]) continue;
        const { recordingUrl, transcriptText } = await findSiblingFiles(driveFile.parents[0], driveFile.name, accessToken);
        if (recordingUrl || transcriptText) {
          await updateBriefMedia(existing.id, recordingUrl, transcriptText);
          console.log(`  ✅ Updated: ${driveFile.name}`);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`\n✅ Sync complete.`);

  } catch (err) {
    console.error('❌ Sync error:', err.message);
    process.exit(1);
  }
}

main();
