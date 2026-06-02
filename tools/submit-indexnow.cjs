const fs = require('fs');
const https = require('https');
const path = require('path');

const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://quiz-sigma-eight-92.vercel.app').replace(/\/+$/, '');
const host = new URL(siteUrl).host;
const key = process.env.INDEXNOW_KEY || 'd13bff71-f5cc-4fd2-bb41-31a03e3df7ef';
const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
const sitemap = fs.readFileSync(sitemapPath, 'utf8');
const urlList = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

if (!urlList.length) {
  throw new Error(`No URLs found in ${sitemapPath}`);
}

const payload = JSON.stringify({
  host,
  key,
  keyLocation: `${siteUrl}/${key}.txt`,
  urlList,
});

const request = https.request(
  'https://api.indexnow.org/indexnow',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      body += chunk;
    });
    response.on('end', () => {
      console.log(`IndexNow status: ${response.statusCode}`);
      if (body.trim()) console.log(body.trim());

      if (![200, 202].includes(response.statusCode)) {
        process.exitCode = 1;
      }
    });
  }
);

request.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

request.write(payload);
request.end();
