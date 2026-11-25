'use strict';
// Submits every URL to IndexNow (api.indexnow.org) after a production build.
// Runs only when the commit message contains "[indexnow]"; never fails the build.
const fs = require('fs');
const path = require('path');

const KEY = '1a540d826730ef2f96d510284c2cdaf8';
const HOST = 'blackjackchart.app';

(async () => {
  const msg = process.env.VERCEL_GIT_COMMIT_MESSAGE || '';
  if (process.env.VERCEL_ENV !== 'production' || !msg.includes('[indexnow]')) return console.log('indexnow: skipped');
  const urlList = fs.readFileSync(path.join(__dirname, '..', 'dist', 'urls.txt'), 'utf8').split('\n').filter((u) => u.startsWith(`https://${HOST}/`));
  for (const endpoint of ['https://api.indexnow.org/indexnow']) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
      });
      console.log(`indexnow: ${endpoint} -> ${res.status} for ${urlList.length} urls ${(await res.text()).slice(0, 200)}`);
    } catch (e) {
      console.log(`indexnow: ${endpoint} failed: ${e.message}`);
    }
  }
})();
