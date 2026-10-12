// Adds an approval gate to notion_cms_sync.mjs: only rows whose "Review status"
// is in SYNC_ALLOWED_STATUSES (default: Approved) are sent to WordPress.
// Everything else is left untouched in WordPress. Makes a .bak backup first.
import fs from 'node:fs';

const file = process.argv[2] || 'notion_cms_sync.mjs';
let src = fs.readFileSync(file, 'utf8');
if (src.includes('SYNC_ALLOWED_STATUSES')) {
  console.log('Already patched — nothing to do.');
  process.exit(0);
}

function replaceOnce(label, find, replacement) {
  const hits = typeof find === 'string' ? src.split(find).length - 1 : (src.match(new RegExp(find.source, 'g')) || []).length;
  if (hits !== 1) {
    console.error(`❌ Anchor "${label}" found ${hits} times (expected 1). No changes written.`);
    process.exit(1);
  }
  src = src.replace(find, replacement);
}

// 1. Config: which property and which values allow a sync.
replaceOnce(
  'constructor',
  'this.force = Boolean(options.force);',
  `this.force = Boolean(options.force);
    this.reviewProperty = env.SYNC_REVIEW_PROPERTY || 'Review status';
    this.allowedStatuses = (env.SYNC_ALLOWED_STATUSES || 'Approved')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);`
);

// 2. Counter for rows held back.
replaceOnce(
  'results',
  'const results = { synced: 0, skipped: 0, errors: 0 };',
  `const results = { synced: 0, skipped: 0, errors: 0, notApproved: 0 };
    console.log(\`🔒 Approval gate: only "\${this.reviewProperty}" = \${this.allowedStatuses.join(' / ')} is sent to WordPress.\`);`
);

// 3. Gate before any WordPress call. Fails closed if the property is missing.
replaceOnce(
  'syncItem call',
  'const res = await this.syncItem(meta);',
  `const reviewProp = page.properties?.[this.reviewProperty];
        const reviewValue = (reviewProp?.status?.name || reviewProp?.select?.name || '').trim();
        if (!this.allowedStatuses.includes(reviewValue.toLowerCase())) {
          results.notApproved++;
          console.log(\`⛔ [HELD] "\${meta.title}" — \${this.reviewProperty}: \${reviewValue || '(missing)'}. Not sent to WordPress.\`);
          continue;
        }
        const res = await this.syncItem(meta);`
);

// 4. Summary line.
replaceOnce(
  'summary',
  /(\n[ \t]*)(console\.log\(`\\n🎉 Sync cycle finished)/,
  `$1console.log(\`⛔ Held back (not approved): \${results.notApproved}\`);$1$2`
);

fs.copyFileSync(file, file + '.bak');
fs.writeFileSync(file, src);
console.log(`✅ Patched ${file} (backup: ${file}.bak)`);
