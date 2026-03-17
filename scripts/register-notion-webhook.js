#!/usr/bin/env node
/**
 * Register Notion webhook (run once)
 * node scripts/register-notion-webhook.js
 *
 * This tells Notion to POST to our /api/notion/webhook endpoint
 * whenever a page in the Tracker - Operations DB changes.
 */
require('dotenv').config({ path: '.env.local', override: true });
const https = require('https');

const NOTION_KEY = process.env.NOTION_API_KEY;
if (!NOTION_KEY) { console.error('❌ NOTION_API_KEY not set'); process.exit(1); }

// Notion data source ID for "Tracker - Operations"
const DATA_SOURCE_ID = '207ca51b-74d3-8018-8c76-000be4cf2559';
// Your Vercel app URL
const WEBHOOK_URL = 'https://oraia-five.vercel.app/api/notion/webhook';

const body = JSON.stringify({
  url: WEBHOOK_URL,
  event_types: [
    'page.updated',
    'page.properties_updated',
    'page.created',
  ],
  data_sources: [
    { type: 'data_source', id: DATA_SOURCE_ID }
  ]
});

const options = {
  hostname: 'api.notion.com',
  path: '/v1/webhooks',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${NOTION_KEY}`,
    'Notion-Version': '2025-09-03',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Notion webhook registered!');
      console.log('   Webhook ID:', json.id);
      console.log('   URL:', json.url);
      console.log('   Status:', json.status);
    } else {
      console.error('❌ Registration failed:', res.statusCode);
      console.error(JSON.stringify(json, null, 2));
      console.log('\n⚠️  Notion webhooks may require special access.');
      console.log('   If you get a 404, the webhook API is not available for your account yet.');
      console.log('   Alternative: increase sync frequency in oraia-notion-sync.timer');
    }
  });
});

req.on('error', e => console.error('Request error:', e.message));
req.write(body);
req.end();
