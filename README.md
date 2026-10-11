# Prime Odontologia — WordPress Theme & Notion CMS Sync

Official website and content engine for **Prime Odontologia** (Belo Horizonte, MG).

Built with **WordPress Studio**, featuring a custom **Block Theme (Full Site Editing)** adhering to [DESIGN.md](file:///Users/primeoshub/Studio/primeodontologia-wordpress/DESIGN.md) and an automated Notion-to-WordPress publishing pipeline via [prime-notion-bridge](file:///Users/primeoshub/Studio/primeodontologia-wordpress/prime-notion-bridge).

---

## ⚠️ Important Deployment & Safety Rules

> **WARNING:** Never deploy the raw git repository root directly to production (`/srv/htdocs`).

### Forbidden on Production Server:
- `wp-config.php` (Managed by WordPress.com hosting; contains production MySQL credentials)
- `wp-content/db.php` (Local Studio SQLite drop-in; hijacking production MySQL)
- `wp-content/mu-plugins/sqlite-database-integration/` (Local SQLite engine)
- `wp-content/database/` (Local SQLite database)
- Studio internal files and tooling (`__wp__`, `prime-import-source/`, `prime-notion-bridge/`, markdown docs)

### Correct Deployment Strategy:
- **Production Content & Theme Sync:** Deploy using WordPress Studio's built-in **Push** (`studio site push` or via Studio UI). This safely deploys themes, plugins, uploads, and content without touching `wp-config.php` or copying SQLite into production.
- **Selective Sync:** Alternatively, sync only `wp-content/themes/prime-odontologia/` via SFTP or SSH.

---

## 🛠️ Local Development (WordPress Studio)

1. Start WordPress Studio and verify the site is online:
   ```bash
   studio status
   ```
2. Run WP-CLI commands locally (prefix with `studio`):
   ```bash
   studio wp theme list
   studio wp post list
   ```
3. Test or run the Notion CMS bridge:
   ```bash
   npm run sync:dry-run
   npm run sync
   ```

---

## 🌐 Production Environment Specs

- **Production URL:** `https://primeodontologia.com.br`
- **Hosting:** WordPress.com Atomic / Pressable
- **Server Path:** `/srv/htdocs`
- **Core Path:** `/wordpress/core`
- **WP-CLI on Server:** `wp --path=/srv/htdocs <command>`
- **Active Theme:** `prime-odontologia`
- **Google AdSense:** Root `ads.txt` with publisher `pub-3413556435934115`
- **Google Ads Account:** `519-933-5510`
