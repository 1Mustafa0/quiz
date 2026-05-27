const fs = require('fs');
const path = require('path');

const siteUrl = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://quiz-sigma-eight-92.vercel.app').replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

fs.mkdirSync(path.join(process.cwd(), 'public'), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), 'public', 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(process.cwd(), 'public', 'robots.txt'), robots);
