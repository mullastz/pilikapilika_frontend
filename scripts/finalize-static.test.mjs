import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';

const run = promisify(execFile);
const pages = ['', 'search', 'how-it-works', 'about-us', 'contact-us', 'china-to-tanzania-cargo'];
const rendered = '<h1>Public page</h1><meta name="robots" content="index, follow">';

async function fixture(t, omittedPage) {
  const temporaryDirectory = resolve(tmpdir());
  const root = await mkdtemp(join(temporaryDirectory, 'pilikapilika-static-'));
  t.after(async () => {
    // Remove only the isolated directory created by this test.
    assert.equal(dirname(root), temporaryDirectory);
    assert.ok(basename(root).startsWith('pilikapilika-static-'));
    await rm(root, { recursive: true, force: true });
  });
  const output = join(root, 'dist/pilikapilika-frontend/browser');
  await mkdir(join(root, 'scripts'), { recursive: true });
  const script = join(root, 'scripts/finalize-static.mjs');
  await copyFile(new URL('./finalize-static.mjs', import.meta.url), script);
  for (const page of pages) {
    if (page === omittedPage) continue;
    await mkdir(join(output, page), { recursive: true });
    await writeFile(join(output, page, 'index.html'), rendered);
  }
  await writeFile(join(output, 'index.csr.html'), '<meta name="robots" content="noindex, follow">');
  return { output, build: () => run(process.execPath, [script]) };
}

test('all public pages enter the sitemap without private Cloudflare rules', async t => {
  const { output, build } = await fixture(t);
  await build();
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  const redirects = await readFile(join(output, '_redirects'), 'utf8');
  const headers = await readFile(join(output, '_headers'), 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, pages.length);
  for (const page of pages) {
    assert.ok(sitemap.includes(`<loc>https://pilikapilika.com/${page ? `${page}/` : ''}</loc>`));
    if (page) {
      assert.ok(!redirects.includes(`/${page} /index.csr`));
      assert.doesNotMatch(headers, new RegExp(`(^|\\n)/${page}/?\\n`));
    }
  }
  assert.match(redirects, /\/account\/\* \/index\.csr 200/);
  assert.match(headers, /\/messages\n  X-Robots-Tag: noindex, follow/);
});

test('failed agent pages stay out of the sitemap and successful profiles win over the app fallback', async t => {
  const { output, build } = await fixture(t);
  for (const [id, html] of [['available-agent', rendered], ['failed-agent', '<meta name="robots" content="noindex, follow">']]) {
    await mkdir(join(output, 'agent', id), { recursive: true });
    await writeFile(join(output, 'agent', id, 'index.html'), html);
  }
  await build();
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  const redirects = await readFile(join(output, '_redirects'), 'utf8');
  assert.ok(sitemap.includes('/agent/available-agent/'));
  assert.ok(!sitemap.includes('/agent/failed-agent/'));
  assert.ok(redirects.includes('/agent/available-agent /agent/available-agent/ 301'));
  const profileRule = redirects.indexOf('/agent/available-agent/ /agent/available-agent/ 200');
  assert.ok(profileRule >= 0 && profileRule < redirects.indexOf('/agent/* /index.csr 200'));
  assert.ok(!redirects.includes('/agent/failed-agent/ /agent/failed-agent/ 200'));
});

test('packaging fails if a required public page was not prerendered', async t => {
  const { build } = await fixture(t, 'contact-us');
  await assert.rejects(build, /contact-us/);
});
