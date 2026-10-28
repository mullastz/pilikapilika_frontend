import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const output = fileURLToPath(new URL('../dist/pilikapilika-frontend/browser/', import.meta.url));
const read = path => readFile(join(output, path), 'utf8');
const publicPages = ['/', '/search/', '/how-it-works/', '/about-us/', '/contact-us/'];

test('public pages contain indexable HTML and unique production metadata', async () => {
  const titles = new Set();
  for (const url of publicPages) {
    const html = await read(`${url.slice(1)}index.html`);
    const { document } = new JSDOM(html).window;
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.ok(document.querySelector('h1').textContent.trim());
    assert.equal(document.querySelector('meta[name="robots"]').content, 'index, follow');
    assert.equal(document.querySelector('link[rel="canonical"]').href, `https://pilikapilika.com${url}`);
    assert.ok(document.querySelector('meta[name="description"]').content);
    assert.equal(document.querySelector('meta[property="og:url"]').content, `https://pilikapilika.com${url}`);
    assert.ok(JSON.parse(document.getElementById('site-schema').textContent)['@graph']);
    assert.doesNotMatch(html, /192\.168\.100\.124|localhost:8000/);
    for (const path of publicPages.filter(path => path !== '/')) {
      assert.ok(document.querySelector(`footer a[href="${path.slice(0, -1)}"]`), `Missing footer link: ${path}`);
    }
    titles.add(document.title);
  }
  assert.equal(titles.size, publicPages.length);
});

test('app shell and not-found response stay out of indexing', async () => {
  for (const path of ['index.csr.html', '404.html']) {
    const { document } = new JSDOM(await read(path)).window;
    assert.equal(document.querySelector('meta[name="robots"]').content, 'noindex, follow');
    assert.equal(document.querySelector('link[rel="canonical"]'), null);
  }
});

test('browser bundles use the production API and secure WebSocket origin', async () => {
  const files = (await readdir(output)).filter(path => path.endsWith('.js'));
  const bundles = (await Promise.all(files.map(read))).join('\n');
  assert.match(bundles, /https:\/\/api\.pilikapilika\.com\/api\/v1/);
  assert.match(bundles, /wss:\/\/api\.pilikapilika\.com/);
  assert.doesNotMatch(bundles, /192\.168\.100\.124|http:\/\/localhost:8000\/api\/v1/);
});

test('sitemap lists only successfully rendered public pages', async () => {
  const sitemap = new JSDOM(await read('sitemap.xml'), { contentType: 'text/xml' }).window.document;
  const urls = [...sitemap.querySelectorAll('loc')].map(node => new URL(node.textContent));
  for (const path of publicPages) assert.ok(urls.some(url => url.pathname === path));
  for (const url of urls) {
    assert.equal(url.origin, 'https://pilikapilika.com');
    assert.ok(publicPages.includes(url.pathname) || /^\/agent\/[a-zA-Z0-9-]+\/$/.test(url.pathname));
    const html = await read(`${url.pathname.slice(1)}index.html`);
    assert.match(html, /content="index, follow"/);
  }
  assert.match(await read('robots.txt'), /Sitemap: https:\/\/pilikapilika\.com\/sitemap.xml/);
});

test('Cloudflare rules preserve public agent HTML before app fallbacks', async () => {
  const rules = (await read('_redirects')).split('\n');
  assert.ok(rules.includes('/sign-in /index.csr.html 200'));
  assert.ok(rules.includes('/account/* /index.csr.html 200'));
  assert.ok(!rules.some(rule => rule.startsWith('/* ')));
  for (const path of publicPages.filter(path => path !== '/')) {
    assert.ok(!rules.some(rule => rule.startsWith(`${path.slice(0, -1)} /index.csr.html`)));
    assert.doesNotMatch(await read('_headers'), new RegExp(`(^|\\n)${path.slice(0, -1)}/?\\n`));
  }
  assert.match(await read('_headers'), /\/messages\n  X-Robots-Tag: noindex, follow/);
  let entries = [];
  try { entries = await readdir(join(output, 'agent')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const id of entries) {
    const index = rules.indexOf(`/agent/${id}/ /agent/${id}/index.html 200`);
    if (index !== -1) assert.ok(index < rules.indexOf('/agent/* /index.csr.html 200'));
  }
});
