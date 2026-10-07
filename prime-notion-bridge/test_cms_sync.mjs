import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  cleanUuid,
  slugify,
  richTextToHtml,
  convertNotionBlocks,
  NotionCmsSync
} from './notion_cms_sync.mjs';

console.log('🧪 Starting Prime Notion CMS Sync test suite...');

// 1. cleanUuid
assert.equal(
  cleanUuid('https://www.notion.so/prime/My-Database-12345678123412341234123456789abc?v=123'),
  '12345678-1234-1234-1234-123456789abc'
);
assert.equal(
  cleanUuid('12345678123412341234123456789abc'),
  '12345678-1234-1234-1234-123456789abc'
);

// 2. slugify
assert.equal(slugify('Como o Invisalign Funciona?'), 'como-o-invisalign-funciona');
assert.equal(slugify('Conheça a Nossa Equipe — Dra. Rebeca & Dr. André'), 'conheca-a-nossa-equipe-dra-rebeca-dr-andre');

// 3. richTextToHtml
const r = (text, annotations = {}, link = null) => [
  { type: 'text', plain_text: text, annotations, text: { content: text, link: link ? { url: link } : null } }
];
assert.equal(
  richTextToHtml(r('Texto Seguro & Formatado', { bold: true })),
  '<strong>Texto Seguro &amp; Formatado</strong>'
);
assert.equal(
  richTextToHtml(r('Clique Aqui', {}, 'https://wa.me/5531992893060')),
  '<a href="https://wa.me/5531992893060">Clique Aqui</a>'
);

// 4. convertNotionBlocks
const blocks = [
  { id: '1', type: 'heading_2', heading_2: { rich_text: r('Título da Seção') } },
  { id: '2', type: 'paragraph', paragraph: { rich_text: r('Parágrafo explicativo.') } },
  { id: '3', type: 'quote', quote: { rich_text: r('Citação de destaque.') } },
  { id: '4', type: 'callout', callout: { icon: { emoji: '💡' }, rich_text: r('Dica importante.') } },
  { id: '5', type: 'bulleted_list_item', bulleted_list_item: { rich_text: r('Item A') } },
  { id: '6', type: 'bulleted_list_item', bulleted_list_item: { rich_text: r('Item B') } },
  { id: '7', type: 'divider', divider: {} },
  {
    id: '8',
    type: 'image',
    image: {
      type: 'external',
      external: { url: 'https://primeodontologia.com.br/foto.jpg' },
      caption: r('Legenda da foto')
    }
  }
];

const mockUpload = async (id, url, caption) => ({ id: 101, url: 'https://example.test/wp-content/foto.jpg' });
const html = await convertNotionBlocks(blocks, async () => [], mockUpload);

assert.match(html, /wp:heading \{"level":2,"textColor":"primary"\}/);
assert.match(html, /wp:paragraph/);
assert.match(html, /wp:quote/);
assert.match(html, /wp:list/);
assert.match(html, /wp:image/);
assert.match(html, /wp-image-101/);
assert.match(html, /💡/);

// 5. Test Full Sync Workflow with Mocked APIs
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-sync-test-'));
const stateFile = path.join(tmpDir, 'test-state.json');

const testEnv = {
  NOTION_TOKEN: 'secret_test_notion_key',
  NOTION_DATABASE_ID: '12345678-1234-1234-1234-123456789abc',
  WP_BASE_URL: 'https://wp.example.test',
  WP_USER: 'testadmin',
  WP_APP_PASSWORD: 'app-pass-test',
  BRIDGE_STATE_FILE: stateFile
};

const syncer = new NotionCmsSync({ env: testEnv });

let wpCreates = 0;
let wpUpdates = 0;
let lastWpStatus = null;

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const json = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  // Notion Database / Data Source Query Mock
  if (u.includes('api.notion.com/v1/databases/') || u.includes('api.notion.com/v1/data_sources/')) {
    return json({
      results: [
        {
          id: 'page-aaa-111',
          last_edited_time: '2026-10-07T12:00:00.000Z',
          properties: {
            Title: { type: 'title', title: r('Meu Sorriso') },
            Slug: { type: 'rich_text', rich_text: r('meu-sorriso') },
            Type: { type: 'select', select: { name: 'Page' } },
            Status: { type: 'status', status: { name: 'Published' } },
            Excerpt: { type: 'rich_text', rich_text: r('Resumo da página Meu Sorriso') }
          }
        },
        {
          id: 'page-bbb-222',
          last_edited_time: '2026-10-07T12:00:00.000Z',
          properties: {
            Name: { type: 'title', title: r('Novidade Invisalign 2026') },
            Slug: { type: 'rich_text', rich_text: r('novidade-invisalign-2026') },
            Type: { type: 'select', select: { name: 'Post' } },
            Status: { type: 'status', status: { name: 'Draft' } }
          }
        }
      ]
    });
  }

  // Notion Children Blocks Query Mock
  if (u.includes('api.notion.com/v1/blocks/')) {
    return json({
      results: [
        { id: 'b1', type: 'paragraph', paragraph: { rich_text: r('Conteúdo sincronizado do Notion.') } }
      ],
      has_more: false
    });
  }

  // WordPress REST API Mock
  if (u.includes('/wp-json/wp/v2/')) {
    // Search existing
    if (init.method === 'GET' && u.includes('?slug=')) {
      if (u.includes('meu-sorriso')) {
        return json([{ id: 5, slug: 'meu-sorriso', status: 'publish' }]);
      }
      return json([]); // Not found for novidade-invisalign-2026
    }

    // Update existing page
    if (init.method === 'POST' && u.includes('/pages/5')) {
      wpUpdates++;
      const body = JSON.parse(init.body);
      lastWpStatus = body.status;
      assert.equal(body.status, 'publish');
      return json({ id: 5, link: 'https://wp.example.test/meu-sorriso/', status: 'publish' });
    }

    // Create new post
    if (init.method === 'POST' && u.endsWith('/posts')) {
      wpCreates++;
      const body = JSON.parse(init.body);
      assert.equal(body.status, 'draft');
      assert.equal(body.slug, 'novidade-invisalign-2026');
      return json({ id: 88, link: 'https://wp.example.test/novidade-invisalign-2026/', status: 'draft' });
    }
  }

  throw new Error(`Unhandled mock URL: ${u}`);
};

try {
  // First run: should update 1 page, create 1 post
  const res1 = await syncer.runOnce();
  assert.equal(res1.synced, 2);
  assert.equal(res1.skipped, 0);
  assert.equal(wpUpdates, 1);
  assert.equal(wpCreates, 1);
  assert.equal(lastWpStatus, 'publish');

  // Verify state file persisted correctly
  const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.equal(savedState.items['page:meu-sorriso'].wpId, 5);
  assert.equal(savedState.items['post:novidade-invisalign-2026'].wpId, 88);

  // Second run without edits: should skip both!
  const res2 = await syncer.runOnce();
  assert.equal(res2.synced, 0);
  assert.equal(res2.skipped, 2);
  assert.equal(wpUpdates, 1); // No new network writes
  assert.equal(wpCreates, 1);

  console.log('✅ ALL TESTS PASSED: Uuids, Slugs, Formatting, Gutenberg conversion, Upserting, Direct Publish, State Tracking and Incremental Skip.');
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
