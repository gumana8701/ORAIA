#!/usr/bin/env node
// One-time setup script to get Google OAuth refresh token
// Requires: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local
// Run: node scripts/get-google-token.js

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env.local');
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;

console.log('\n=== ORAIA Google Drive OAuth Setup ===\n');
console.log('1. Open this URL in your browser:\n\n' + authUrl + '\n');
console.log('2. Sign in and authorize\n3. Paste the code below\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Authorization code: ', (code) => {
  rl.close();
  const postData = new URLSearchParams({ code: code.trim(), client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }).toString();
  const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } }, res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => {
      const t = JSON.parse(d);
      if (t.refresh_token) console.log('\n✅ Refresh token:\n\n' + t.refresh_token + '\n\nAdd to .env.local as GOOGLE_OAUTH_REFRESH_TOKEN');
      else console.log('Error:', JSON.stringify(t));
    });
  });
  req.write(postData); req.end();
});
