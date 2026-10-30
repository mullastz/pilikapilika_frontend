import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const output = fileURLToPath(new URL('../dist/pilikapilika-frontend/browser/', import.meta.url));
const origin = 'https://pilikapilika.com';
const publicPaths = ['/', '/search/', '/how-it-works/', '/about-us/', '/contact-us/', '/china-to-tanzania-cargo/'];
const rewrites = [];
for (const path of publicPaths) {
  const html = await readFile(join(output, path.slice(1), 'index.html'), 'utf8');
  if (!html.includes('content="index, follow"') || !html.includes('<h1')) {
    throw new Error(`Public page ${path} was not rendered with indexable content.`);
  }
}
const agentRoot = join(output, 'agent');
let agentEntries = [];
try {
  agentEntries = await readdir(agentRoot, { withFileTypes: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

for (const entry of agentEntries) {
  if (!entry.isDirectory() || !/^[a-zA-Z0-9-]+$/.test(entry.name)) continue;
  const html = await readFile(join(agentRoot, entry.name, 'index.html'), 'utf8');
  // Failed profile requests must never enter the sitemap.
  if (!html.includes('content="index, follow"')) continue;
  const path = `/agent/${entry.name}`;
  publicPaths.push(`${path}/`);
  // Match public profiles before the app fallback, using the canonical
  // directory URL to avoid Workers redirecting an index.html rewrite.
  rewrites.push(`${path} ${path}/ 301`, `${path}/ ${path}/ 200`);
}

// Cloudflare Pages allows 2,000 static and 100 dynamic rules.
if (rewrites.length > 1900) throw new Error('Too many agent rewrites for Pages. Move agent routes to a Worker before publishing this build.');

// Explicit app routes keep deep links working without turning unknown URLs into 200 pages.
const appRoutes = [
  '/sign-up', '/sign-in', '/forgot-password', '/home', '/profile-management',
  '/account/*', '/admin', '/admin/*', '/messages', '/qr-generator',
  '/package-generator', '/scan-qr', '/verify-email/*', '/reset-password/*',
  '/track-shipping/*', '/qr/*', '/package/*', '/book-shipment/*', '/agent/*',
];

for (const path of appRoutes) {
  // Use the canonical asset URL so Workers does not redirect the browser
  // from the requested app route to /index.csr when normalizing .html URLs.
  rewrites.push(`${path} /index.csr 200`);
  if (!path.includes('*')) rewrites.push(`${path}/ /index.csr 200`);
}

await readFile(join(output, 'index.csr.html')); // Fail if Angular's app shell is missing.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.sort().map(path => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(join(output, 'sitemap.xml'), sitemap);
await writeFile(join(output, '_redirects'), `${rewrites.join('\n')}\n`);

// Apply noindex before JavaScript runs on private/auth/tool routes.
// Agent fallbacks inherit noindex from index.csr.html until the next prerender build.
const privateRoutes = appRoutes.filter(path => path !== '/agent/*');
await writeFile(join(output, '_headers'), `${privateRoutes.map(path => `${path}\n  X-Robots-Tag: noindex, follow\n${!path.includes('*') ? `${path}/\n  X-Robots-Tag: noindex, follow\n` : ''}`).join('\n')}\n/index.csr\n  X-Robots-Tag: noindex, follow\n/index.csr.html\n  X-Robots-Tag: noindex, follow\n`);
console.log(`Prepared Cloudflare static output: ${publicPaths.length} public URLs in sitemap.xml.`);
