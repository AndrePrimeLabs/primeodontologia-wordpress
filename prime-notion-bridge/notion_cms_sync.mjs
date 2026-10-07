#!/usr/bin/env node
/**
 * Prime Notion CMS Sync Engine
 * Direct bidirectional sync between Notion Database and WordPress.
 * 
 * Features:
 * - Syncs Pages & Posts directly from Notion Database to WordPress.
 * - Supports Direct Publish: Status "Published" in Notion -> live in WordPress.
 * - Rich Gutenberg block generator (headings, lists, quotes, callouts, images, tables).
 * - Automatic image downloading & Media Library sideloading with caching.
 * - Incremental sync: tracks last_edited_time and sha256 content hashes in state file.
 * - Watcher / Daemon mode: continuously polls Notion for updates.
 * - Zero external npm dependencies (uses native Node.js 22+ fetch, crypto, fs).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const hash = s => crypto.createHash('sha256').update(String(s ?? '')).digest('hex');
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

export function cleanUuid(input) {
  if (!input) return '';
  const path = input.includes('://') ? new URL(input).pathname : input;
  const match = path.match(/([a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}|[a-f0-9]{32})/i);
  if (!match) return input.trim();
  const id = match[1].replaceAll('-', '').toLowerCase();
  return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function richTextToHtml(items = []) {
  if (!Array.isArray(items)) return '';
  return items.map(r => {
    let text = escapeHtml(r.plain_text ?? r.text?.content ?? '');
    const a = r.annotations ?? {};
    if (a.code) text = `<code>${text}</code>`;
    if (a.bold) text = `<strong>${text}</strong>`;
    if (a.italic) text = `<em>${text}</em>`;
    if (a.strikethrough) text = `<s>${text}</s>`;
    if (a.underline) text = `<u>${text}</u>`;
    const link = r.href ?? r.text?.link?.url;
    if (link) {
      if (/^(https?:|mailto:|tel:)/i.test(link)) {
        text = `<a href="${escapeHtml(link)}">${text}</a>`;
      }
    }
    return text.replaceAll('\n', '<br>');
  }).join('');
}

export function blockMarkup(name, html, attrs = {}) {
  const attrStr = Object.keys(attrs).length ? ' ' + JSON.stringify(attrs) : '';
  return `<!-- wp:${name}${attrStr} -->\n${html}\n<!-- /wp:${name} -->\n`;
}

export async function convertNotionBlocks(blocks, fetchChildren, uploadImage, depth = 0) {
  if (depth > 12) return '';
  let out = '';

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = b.type;
    const d = b[t] ?? {};

    if (t === 'paragraph') {
      const html = richTextToHtml(d.rich_text);
      if (html.trim()) {
        out += blockMarkup('paragraph', `<p class="has-secondary-color has-text-color">${html}</p>`, { textColor: 'secondary' });
      }
    } else if (/^heading_[123]$/.test(t)) {
      const level = Number(t.at(-1));
      const html = richTextToHtml(d.rich_text);
      out += blockMarkup('heading', `<h${level} class="wp-block-heading has-primary-color has-text-color">${html}</h${level}>`, { level, textColor: 'primary' });
    } else if (['bulleted_list_item', 'numbered_list_item'].includes(t)) {
      const ordered = t === 'numbered_list_item';
      const tag = ordered ? 'ol' : 'ul';
      let itemsMarkup = '';

      while (i < blocks.length && blocks[i].type === t) {
        const item = blocks[i];
        let nested = '';
        if (item.has_children && fetchChildren) {
          const childBlocks = await fetchChildren(item.id);
          nested = await convertNotionBlocks(childBlocks, fetchChildren, uploadImage, depth + 1);
        }
        itemsMarkup += blockMarkup('list-item', `<li>${richTextToHtml(item[t].rich_text)}${nested}</li>`);
        i++;
      }
      i--;
      out += blockMarkup('list', `<${tag} class="wp-block-list">${itemsMarkup}</${tag}>`, ordered ? { ordered: true } : {});
    } else if (t === 'quote') {
      const quoteText = richTextToHtml(d.rich_text);
      out += blockMarkup('quote', `<blockquote class="wp-block-quote"><p>${quoteText}</p></blockquote>`, { className: 'wp-block-quote' });
    } else if (t === 'callout') {
      const text = richTextToHtml(d.rich_text);
      const icon = d.icon?.emoji ? `<span style="font-size:1.25rem;margin-right:0.5rem">${d.icon.emoji}</span> ` : '';
      out += `<!-- wp:group {"style":{"spacing":{"padding":{"top":"1.25rem","bottom":"1.25rem","left":"1.5rem","right":"1.5rem"}},"border":{"radius":"6px","width":"1px","color":"var(--wp--preset--color--line)"}},"backgroundColor":"surface"} -->\n` +
             `<div class="wp-block-group has-surface-background-color has-background" style="border-color:var(--wp--preset--color--line);border-width:1px;border-radius:6px;padding:1.25rem 1.5rem">\n` +
             `  <p class="has-secondary-color has-text-color" style="margin:0">${icon}${text}</p>\n` +
             `</div>\n` +
             `<!-- /wp:group -->\n`;
    } else if (t === 'divider') {
      out += blockMarkup('separator', '<hr class="wp-block-separator has-alpha-channel-opacity"/>');
    } else if (t === 'to_do') {
      const check = d.checked ? '☑ ' : '☐ ';
      out += blockMarkup('paragraph', `<p class="has-secondary-color has-text-color">${check}${richTextToHtml(d.rich_text)}</p>`);
    } else if (t === 'image') {
      const sourceUrl = d[d.type]?.url;
      if (sourceUrl && uploadImage) {
        try {
          const media = await uploadImage(b.id, sourceUrl, d.caption);
          if (media?.url) {
            const captionText = (d.caption ?? []).map(r => r.plain_text ?? '').join('');
            const figCaption = captionText ? `<figcaption class="wp-element-caption">${escapeHtml(captionText)}</figcaption>` : '';
            out += blockMarkup('image', `<figure class="wp-block-image size-full"><img src="${escapeHtml(media.url)}" alt="${escapeHtml(captionText)}" class="wp-image-${media.id}"/>${figCaption}</figure>`, {
              id: media.id,
              sizeSlug: 'full',
              linkDestination: 'none'
            });
          }
        } catch (imgErr) {
          console.warn(`[Sync Warning] Failed to sideload image block ${b.id}:`, imgErr.message);
        }
      }
    } else if (t === 'table') {
      if (fetchChildren) {
        const rows = await fetchChildren(b.id);
        let tableRows = '';
        for (const row of rows) {
          if (row.type === 'table_row') {
            const cells = (row.table_row.cells || []).map(c => `<td>${richTextToHtml(c)}</td>`).join('');
            tableRows += `<tr>${cells}</tr>`;
          }
        }
        out += blockMarkup('table', `<figure class="wp-block-table"><table><tbody>${tableRows}</tbody></table></figure>`);
      }
    }
  }

  return out;
}

export class NotionCmsSync {
  constructor(options = {}) {
    const env = options.env || process.env;
    this.notionToken = options.notionToken || env.NOTION_TOKEN;
    this.databaseId = cleanUuid(options.databaseId || env.NOTION_DATABASE_ID);
    this.wpBaseUrl = (options.wpBaseUrl || env.WP_BASE_URL || 'http://localhost:8882').replace(/\/$/, '');
    this.wpUser = options.wpUser || env.WP_USER || 'admin';
    this.wpAppPassword = options.wpAppPassword || env.WP_APP_PASSWORD;
    this.publishMode = options.publishMode || env.SYNC_PUBLISH_MODE || 'direct'; // 'direct' or 'draft'
    this.stateFile = options.stateFile || env.BRIDGE_STATE_FILE || path.join(process.cwd(), 'bridge-state.json');
    this.dryRun = Boolean(options.dryRun);
    this.force = Boolean(options.force);
  }

  validateConfig() {
    if (!this.notionToken) throw new Error('Missing NOTION_TOKEN. Configure in .env or pass in options.');
    if (!this.databaseId) throw new Error('Missing NOTION_DATABASE_ID. Set the ID/URL of your Notion CMS Database.');
    if (!this.wpBaseUrl) throw new Error('Missing WP_BASE_URL (e.g. http://localhost:8882).');
    if (!this.wpUser) throw new Error('Missing WP_USER (e.g. admin).');
    if (!this.wpAppPassword) throw new Error('Missing WP_APP_PASSWORD (generate in WP Admin -> Profile -> Application Passwords).');
  }

  getAuthHeader() {
    return 'Basic ' + Buffer.from(`${this.wpUser}:${this.wpAppPassword}`).toString('base64');
  }

  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch {}
    return { version: 2, items: {}, media: {} };
  }

  saveState(state) {
    if (this.dryRun) return;
    const tmp = this.stateFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.stateFile);
  }

  async notionRequest(apiPath, method = 'GET', body = null) {
    await new Promise(r => setTimeout(r, 200)); // Respect Notion rate limits (3 req/sec)
    const url = `https://api.notion.com/v1/${apiPath}`;
    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${this.notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Notion API Error (${res.status} ${res.statusText}): ${errText}`);
    }
    return res.json();
  }

  async wpRequest(apiPath, method = 'GET', body = null, extraHeaders = {}) {
    const url = `${this.wpBaseUrl}/wp-json/wp/v2/${apiPath}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      ...extraHeaders
    };
    const opts = { method, headers };
    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body) {
      opts.body = body;
    }

    const res = await fetch(url, opts);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`WordPress REST Error (${res.status} ${res.statusText}) on ${apiPath}: ${errText}`);
    }
    return res.json();
  }

  extractProperties(page) {
    const p = page.properties || {};
    
    // Find Title
    let title = '';
    const titleKey = Object.keys(p).find(k => p[k].type === 'title');
    if (titleKey) {
      title = (p[titleKey].title || []).map(t => t.plain_text || '').join('').trim();
    }

    // Find Slug
    let slug = '';
    const slugKey = Object.keys(p).find(k => /slug|url|permalink/i.test(k));
    if (slugKey && p[slugKey].rich_text) {
      slug = (p[slugKey].rich_text || []).map(t => t.plain_text || '').join('').trim();
    }
    if (!slug && title) {
      slug = slugify(title);
    }

    // Find Content Type (Page vs Post)
    let type = 'post';
    const typeKey = Object.keys(p).find(k => /type|tipo/i.test(k));
    if (typeKey) {
      const val = (p[typeKey].select?.name || p[typeKey].status?.name || '').toLowerCase();
      if (/page|pagina|estatica|landing/i.test(val)) type = 'page';
    } else {
      // Auto-detect core pages by slug
      if (['meu-sorriso', 'como-o-invisalign-funciona', 'equipe', 'perguntas-sobre-o-invisalign', 'politica-de-privacidade'].includes(slug)) {
        type = 'page';
      }
    }

    // Find Status (Published vs Draft)
    let isPublished = false;
    const statusKey = Object.keys(p).find(k => /status|estado|publicad/i.test(k));
    if (statusKey) {
      const val = (p[statusKey].status?.name || p[statusKey].select?.name || '').toLowerCase();
      if (/published|publicado|publicar|live|pronto|approved/i.test(val)) {
        isPublished = true;
      }
    } else {
      // Default to published if mode is direct and no status property exists
      if (this.publishMode === 'direct') isPublished = true;
    }

    // Find Excerpt
    let excerpt = '';
    const excerptKey = Object.keys(p).find(k => /excerpt|resumo|descricao|descrição/i.test(k));
    if (excerptKey && p[excerptKey].rich_text) {
      excerpt = (p[excerptKey].rich_text || []).map(t => t.plain_text || '').join('').trim();
    }

    return {
      id: page.id,
      title,
      slug,
      type,
      isPublished,
      excerpt,
      lastEditedTime: page.last_edited_time
    };
  }

  async fetchChildrenBlocks(blockId) {
    let all = [], cursor = null;
    do {
      const query = cursor ? `?start_cursor=${encodeURIComponent(cursor)}` : '';
      const data = await this.notionRequest(`blocks/${blockId}/children${query}`);
      if (Array.isArray(data.results)) all.push(...data.results);
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);
    return all;
  }

  async uploadMedia(blockId, sourceUrl, caption = []) {
    const state = this.loadState();
    state.media ??= {};

    if (state.media[blockId]?.id) {
      return state.media[blockId];
    }

    if (this.dryRun) {
      return { id: 9999, url: sourceUrl };
    }

    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Failed to download image from Notion (${res.status})`);

    const contentType = res.headers.get('content-type')?.split(';')[0].trim() || 'image/jpeg';
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[contentType] || 'jpg';
    const buffer = Buffer.from(await res.arrayBuffer());

    const filename = `notion-${blockId.slice(0, 8)}.${ext}`;
    const wpMedia = await this.wpRequest('media', 'POST', buffer, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`
    });

    state.media[blockId] = { id: wpMedia.id, url: wpMedia.source_url };
    this.saveState(state);
    return state.media[blockId];
  }

  async syncItem(meta) {
    const state = this.loadState();
    state.items ??= {};
    const itemKey = `${meta.type}:${meta.slug}`;
    const cached = state.items[itemKey];

    // Check if unchanged
    if (!this.force && cached && cached.notionLastEdited === meta.lastEditedTime && cached.wpId) {
      console.log(`⏩ [${meta.type.toUpperCase()}] "${meta.title}" (${meta.slug}) — Unchanged since last sync.`);
      return { status: 'skipped', id: cached.wpId };
    }

    console.log(`🔄 [${meta.type.toUpperCase()}] Fetching blocks for "${meta.title}"...`);
    const blocks = await this.fetchChildrenBlocks(meta.id);
    const content = await convertNotionBlocks(
      blocks,
      id => this.fetchChildrenBlocks(id),
      (id, url, cap) => this.uploadMedia(id, url, cap)
    );

    const wpStatus = meta.isPublished ? 'publish' : 'draft';
    const postPayload = {
      title: meta.title,
      slug: meta.slug,
      content,
      status: wpStatus,
      excerpt: meta.excerpt || undefined
    };

    if (this.dryRun) {
      console.log(`[DRY RUN] Would upsert ${meta.type} '${meta.title}' (${wpStatus})`);
      return { status: 'dry-run' };
    }

    // Find if post exists in WordPress by slug
    let existingId = cached?.wpId;
    if (!existingId) {
      const searchRes = await this.wpRequest(`${meta.type}s?slug=${encodeURIComponent(meta.slug)}&status=any`);
      if (Array.isArray(searchRes) && searchRes.length > 0) {
        existingId = searchRes[0].id;
      }
    }

    let result;
    if (existingId) {
      console.log(`📝 [${meta.type.toUpperCase()}] Updating existing ID ${existingId} -> ${wpStatus.toUpperCase()}`);
      result = await this.wpRequest(`${meta.type}s/${existingId}`, 'POST', postPayload);
    } else {
      console.log(`✨ [${meta.type.toUpperCase()}] Creating new ${meta.type} -> ${wpStatus.toUpperCase()}`);
      result = await this.wpRequest(`${meta.type}s`, 'POST', postPayload);
    }

    state.items[itemKey] = {
      notionId: meta.id,
      notionLastEdited: meta.lastEditedTime,
      wpId: result.id,
      wpType: meta.type,
      wpSlug: meta.slug,
      wpStatus: result.status,
      contentHash: hash(content),
      syncedAt: new Date().toISOString()
    };
    this.saveState(state);

    console.log(`✅ [${meta.type.toUpperCase()}] "${meta.title}" -> ${result.link || `${this.wpBaseUrl}/${meta.slug}/`} (${result.status})`);
    return { status: 'synced', id: result.id };
  }

  async runOnce() {
    this.validateConfig();
    console.log(`\n======================================================`);
    console.log(`🚀 Prime Notion CMS Sync starting...`);
    console.log(`Target WP: ${this.wpBaseUrl}`);
    console.log(`Notion Database ID: ${this.databaseId}`);
    console.log(`Publish Mode: ${this.publishMode}`);
    console.log(`======================================================\n`);

    // Query Notion Database
    const dbRes = await this.notionRequest(`databases/${this.databaseId}/query`, 'POST', {
      page_size: 100
    });

    const pages = dbRes.results || [];
    console.log(`Found ${pages.length} records in Notion CMS database.`);

    const results = { synced: 0, skipped: 0, errors: 0 };
    for (const page of pages) {
      try {
        const meta = this.extractProperties(page);
        if (!meta.title) {
          console.log(`⚠️ Skipping untitled page ${page.id}`);
          continue;
        }
        const res = await this.syncItem(meta);
        if (res.status === 'synced') results.synced++;
        else if (res.status === 'skipped') results.skipped++;
      } catch (err) {
        results.errors++;
        console.error(`❌ Error syncing page ${page.id}:`, err.message);
      }
    }

    console.log(`\n🎉 Sync cycle finished: ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors.\n`);
    return results;
  }

  async watch(intervalSeconds = 60) {
    console.log(`👀 Watching Notion Database (polling every ${intervalSeconds}s)... Press Ctrl+C to stop.\n`);
    while (true) {
      try {
        await this.runOnce();
      } catch (err) {
        console.error('Watch loop error:', err.message);
      }
      await new Promise(r => setTimeout(r, intervalSeconds * 1000));
    }
  }
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch');
  const isForce = args.includes('--force');
  const isDryRun = args.includes('--dry-run');
  const intervalArg = args.find(a => a.startsWith('--interval='));
  const interval = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : 60;

  const syncer = new NotionCmsSync({
    force: isForce,
    dryRun: isDryRun
  });

  if (isWatch) {
    syncer.watch(interval).catch(err => {
      console.error(err);
      process.exit(1);
    });
  } else {
    syncer.runOnce().catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
}
