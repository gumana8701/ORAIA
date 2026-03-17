#!/usr/bin/env node
/**
 * ORAIA Notion Sync
 * Syncs Notion "Tracker - Operations" DB → Supabase notion_projects + notion_tasks
 * 
 * Run: node scripts/notion-sync.js
 * Cron: every 30 min
 */

require('dotenv').config({ path: '.env.local', override: true });
const https = require('https');

const NOTION_KEY = process.env.NOTION_API_KEY;
if (!NOTION_KEY) { console.error('❌ NOTION_API_KEY not set'); process.exit(1); }
const NOTION_DS_ID = '207ca51b-74d3-8018-8c76-000be4cf2559'; // data_source_id for querying
const NOTION_VERSION = '2025-09-03';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

// ─── helpers ──────────────────────────────────────────────────────────────────

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body === null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = https.request({
      ...options,
      headers: {
        ...options.headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function notionRequest(method, path, body = null) {
  const url = new URL(`https://api.notion.com${path}`);
  const bodyStr = body ? JSON.stringify(body) : null;
  return httpsRequest({
    hostname: 'api.notion.com',
    path: url.pathname + url.search,
    method,
    headers: {
      'Authorization': `Bearer ${NOTION_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    }
  }, bodyStr);
}

async function supabase(method, path, body = null, extra = {}) {
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
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      ...extra
    }
  }, bodyStr);
  return res;
}

// ─── Notion fetchers ───────────────────────────────────────────────────────────

async function fetchAllNotionProjects() {
  const all = [];
  let cursor = null;
  
  while (true) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    
    const res = await notionRequest('POST', `/v1/data_sources/${NOTION_DS_ID}/query`, body);
    if (res.status !== 200) {
      console.error('Notion query error:', res.status, JSON.stringify(res.body).slice(0, 200));
      break;
    }
    
    const results = res.body.results || [];
    all.push(...results);
    
    if (!res.body.has_more) break;
    cursor = res.body.next_cursor;
    await sleep(200);
  }
  
  console.log(`📥 Fetched ${all.length} projects from Notion`);
  return all;
}

async function fetchPageTasks(pageId) {
  const tasks = [];
  
  try {
    const res = await notionRequest('GET', `/v1/blocks/${pageId}/children?page_size=50`);
    if (res.status !== 200) return tasks;
    
    const blocks = res.body.results || [];
    let currentSection = 'General';
    
    for (const block of blocks) {
      const btype = block.type;
      const content = block[btype] || {};
      
      // Track section headings
      if (btype === 'heading_1' || btype === 'heading_2' || btype === 'heading_3') {
        const rich = content.rich_text || [];
        currentSection = rich.map(r => r.plain_text).join('').trim();
      }
      
      // Direct to_do blocks
      if (btype === 'to_do') {
        const rich = content.rich_text || [];
        const text = rich.map(r => r.plain_text).join('').trim();
        if (text) {
          tasks.push({
            id: block.id,
            task_text: text,
            checked: content.checked || false,
            section: currentSection,
            position: tasks.length,
            created_time: block.created_time || null,
            last_edited_time: block.last_edited_time || null,
          });
        }
      }
      
      // Headings with children (e.g. "Checklist - Secuencia Operaciones")
      if (block.has_children && (btype === 'heading_2' || btype === 'heading_3')) {
        await sleep(150);
        const childRes = await notionRequest('GET', `/v1/blocks/${block.id}/children?page_size=50`);
        if (childRes.status === 200) {
          const children = childRes.body.results || [];
          for (const child of children) {
            if (child.type === 'to_do') {
              const childContent = child.to_do || {};
              const rich = childContent.rich_text || [];
              const text = rich.map(r => r.plain_text).join('').trim();
              if (text) {
                tasks.push({
                  id: child.id,
                  task_text: text,
                  checked: childContent.checked || false,
                  section: currentSection,
                  position: tasks.length,
                  created_time: child.created_time || null,
                  last_edited_time: child.last_edited_time || null,
                });
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(`Error fetching tasks for ${pageId}:`, e.message);
  }
  
  return tasks;
}

// ─── Property extractors ───────────────────────────────────────────────────────

function extractProps(page) {
  const props = page.properties || {};
  
  const getTitle = (key) => {
    const p = props[key] || {};
    const items = p.title || [];
    return items.map(i => i.plain_text).join('').trim();
  };
  
  const getText = (key) => {
    const p = props[key] || {};
    const items = p.rich_text || [];
    return items.map(i => i.plain_text).join('').trim();
  };
  
  const getStatus = (key) => {
    const p = props[key] || {};
    const s = p.status;
    return s ? s.name : null;
  };
  
  const getSelect = (key) => {
    const p = props[key] || {};
    const s = p.select;
    return s ? s.name : null;
  };
  
  const getMultiSelect = (key) => {
    const p = props[key] || {};
    return (p.multi_select || []).map(o => o.name);
  };
  
  const getPeople = (key) => {
    const p = props[key] || {};
    return (p.people || []).map(o => o.name || '').filter(Boolean);
  };
  
  const getDate = (key) => {
    const p = props[key] || {};
    const d = p.date;
    return d ? d.start : null;
  };
  
  const getCheckbox = (key) => {
    const p = props[key] || {};
    return p.checkbox || false;
  };
  
  const getNumber = (key) => {
    const p = props[key] || {};
    return p.number ?? null;
  };
  
  const getEmail = (key) => {
    const p = props[key] || {};
    return p.email || null;
  };
  
  const getPhone = (key) => {
    const p = props[key] || {};
    return p.phone_number || null;
  };

  return {
    id: page.id,
    created_time: page.created_time || null,
    last_edited_time: page.last_edited_time || null,
    nombre: getTitle('Nombre de la empresa / nombre del representante'),
    estado: getStatus('Estado'),
    etapas: getMultiSelect('Etapa de implementación'),
    responsable: getPeople('Responsable'),
    resp_chatbot: getPeople('Resp. Chatbot'),
    resp_voz: getPeople('Resp. Agente de voz'),
    whatsapp_group_id: getText('WhatsApp Group ID') || null,
    lanzamiento_real: getDate('Lanzamiento REAL'),
    testeo_inicia: getDate('TESTEO inicia'),
    kick_off_date: getDate('1ra call de kick off'),
    es_chatbot: getCheckbox('Chatbot? '),
    plan_type: getSelect('Plan Type'),
    plan_pagos: getSelect('Plan Pagos'),
    cantidad_contratada: getNumber('Cantidad contratada'),
    saldo_pendiente: getNumber('Saldo pendiente'),
    contact_email: getEmail('Contact Email (cliente)'),
    contact_phone: getPhone('Contact Phone (cliente)'),
    info_util: getText('Info util que debería ser considerada') || null,
    notion_url: page.url || null,
    synced_at: new Date().toISOString(),
    raw_properties: props
  };
}

// ─── Project matching ──────────────────────────────────────────────────────────

async function buildWaGroupIndex() {
  // Get all projects that have messages with chat_ids
  const res = await supabase('GET',
    '/rest/v1/messages?select=project_id,chat_id&chat_id=not.is.null&project_id=not.is.null&limit=10000',
    null, { 'Prefer': 'return=minimal' }
  );
  
  const index = {}; // wa_group_id -> project_id
  if (res.status === 200 && Array.isArray(res.body)) {
    for (const row of res.body) {
      if (row.chat_id && row.project_id) {
        // chat_id format: "120363420988226398@g.us"
        index[row.chat_id] = row.project_id;
      }
    }
  }
  console.log(`📋 WA group index built: ${Object.keys(index).length} entries`);
  return index;
}

// ─── Main sync ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 ORAIA Notion Sync starting...');
  console.log(new Date().toISOString());

  // 1. Fetch all Notion projects
  const notionPages = await fetchAllNotionProjects();
  
  // 2. Build WA group → Supabase project_id index
  const waIndex = await buildWaGroupIndex();
  
  // 3. Process each project
  let syncedProjects = 0;
  let syncedTasks = 0;
  let withTasks = 0;
  
  for (let i = 0; i < notionPages.length; i++) {
    const page = notionPages[i];
    const extracted = extractProps(page);
    
    // Try to match to existing Supabase project
    let projectId = null;
    if (extracted.whatsapp_group_id && waIndex[extracted.whatsapp_group_id]) {
      projectId = waIndex[extracted.whatsapp_group_id];
    }
    extracted.project_id = projectId;
    
    // Remove raw_properties to avoid huge payloads (save only key info)
    const { raw_properties, ...projectRow } = extracted;
    
    // Upsert notion_project
    const upsertRes = await supabase('POST', '/rest/v1/notion_projects?on_conflict=id', [projectRow]);
    if (upsertRes.status >= 300) {
      console.error(`❌ Failed to upsert project ${extracted.nombre}:`, upsertRes.status, JSON.stringify(upsertRes.body).slice(0, 200));
    } else {
      syncedProjects++;
    }
    
    // Fetch and upsert tasks (only if page might have content)
    await sleep(200);
    const tasks = await fetchPageTasks(page.id);
    
    if (tasks.length > 0) {
      withTasks++;
      const taskRows = tasks.map(t => ({
        ...t,
        notion_project_id: page.id,
        project_id: projectId,
        synced_at: new Date().toISOString()
      }));
      
      const taskRes = await supabase('POST', '/rest/v1/notion_tasks?on_conflict=id', taskRows);
      if (taskRes.status >= 300) {
        console.error(`❌ Failed to upsert tasks for ${extracted.nombre}:`, JSON.stringify(taskRes.body).slice(0, 200));
      } else {
        syncedTasks += tasks.length;
      }
    }
    
    // Progress log every 50
    if ((i + 1) % 50 === 0) {
      console.log(`  ⏳ ${i + 1}/${notionPages.length} projects processed...`);
      await sleep(500); // pause to avoid rate limits
    }
  }
  
  console.log('\n✅ Notion sync complete!');
  console.log(`   Projects synced: ${syncedProjects}/${notionPages.length}`);
  console.log(`   Projects with WA match: ${Object.values(notionPages).filter((_, i) => {
    const e = extractProps(notionPages[i]);
    return e.whatsapp_group_id && waIndex[e.whatsapp_group_id];
  }).length}`);
  console.log(`   Projects with tasks: ${withTasks}`);
  console.log(`   Tasks synced: ${syncedTasks}`);
}

main().catch(e => {
  console.error('💥 Fatal error:', e);
  process.exit(1);
});
