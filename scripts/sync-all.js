#!/usr/bin/env node
/**
 * ORAIA Full Sync Pipeline
 * Runs in order:
 *   1. meet-sync.js       → Pull new Drive briefs → classify → store
 *   2. reclassify-briefs.js → Fix unassigned briefs
 *   3. enrich-projects.js  → Fill missing nicho + KPIs from meetings
 *
 * Run: node scripts/sync-all.js
 * Cron: every 30 min via oraia-meet-sync.timer
 */

const { execSync } = require('child_process');
const path = require('path');

const scripts = [
  { name: 'meet-sync.js',        label: '1/3 Meet Sync (new Drive briefs)' },
  { name: 'reclassify-briefs.js', label: '2/3 Reclassify (fix unassigned briefs)' },
  { name: 'enrich-projects.js',  label: '3/3 Enrich (fill nicho + KPIs)' }
];

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${new Date().toISOString()}] ORAIA Full Sync Pipeline`);
  console.log('='.repeat(60));

  for (const script of scripts) {
    const scriptPath = path.join(__dirname, script.name);
    console.log(`\n▶ ${script.label}`);
    console.log('-'.repeat(60));
    try {
      execSync(`node ${scriptPath}`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
      console.log(`✅ ${script.name} done`);
    } catch (e) {
      console.error(`❌ ${script.name} failed: ${e.message}`);
      // continue to next script even if one fails
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Pipeline complete at ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

main();
