# AI & Developer Instructions

This is a local WordPress development site managed by [WordPress Studio](https://developer.wordpress.com/studio/).
For Studio operational commands, see [STUDIO.md](file:///Users/primeoshub/Studio/primeodontologia-wordpress/STUDIO.md).
For visual styling, layout, typography, and color tokens, follow [DESIGN.md](file:///Users/primeoshub/Studio/primeodontologia-wordpress/DESIGN.md).

---

## 🚨 CRITICAL RULE: Production Isolation & Deployment Safety

### 1. Never Deploy Repository Root via Git to Production
The production server (`primeodontologia.com.br`) runs on **WordPress.com Atomic / Pressable** managed hosting.
**DO NOT** configure GitHub auto-deploy to pull or dump this repository root into `/srv/htdocs/`.

### 2. Forbidden Files on Production (Never Push / Sync to Live Server)
The following files are local Studio runtime files and **must NEVER touch the production server**:
- `wp-config.php`: Local development config. Overwriting production destroys the live MySQL database credentials!
- `wp-content/db.php`: The SQLite database drop-in. If present on production, WordPress immediately bypasses MySQL and routes all queries to an empty SQLite database.
- `wp-content/mu-plugins/sqlite-database-integration/`: Studio's SQLite engine.
- `wp-content/database/`: Local SQLite database files (`*.sqlite`, `*.sqlite-wal`).
- Studio & Repository tooling: `__wp__/`, `prime-import-source/`, `prime-notion-bridge/`, markdown docs (`AGENTS.md`, `CLAUDE.md`, `STUDIO.md`, `DESIGN.md`), `.agents/`, `.vscode/`.

### 3. Safe Deployment Method
Deployments to production must follow one of these safe methods:
1. **Official Studio Push:** Use the WordPress Studio desktop app or `studio site push` (syncs content, themes, plugins, and uploads safely without touching `wp-config.php` or dropping SQLite into production).
2. **Selective Theme/Plugin Sync:** Sync ONLY `wp-content/themes/prime-odontologia/` or specific plugin folders to the server via SFTP/SSH.

---

## 🌐 Production Server Reference (WordPress.com Atomic)

- **Domain:** `https://primeodontologia.com.br`
- **SSH Web Root:** `/srv/htdocs`
- **Core Path:** `/wordpress/core`
- **Database:** Managed MySQL (never SQLite!)
- **WP-CLI on Production:** Always require the path flag: `wp --path=/srv/htdocs <command>`
- **Active Theme:** `prime-odontologia` (WordPress Full Site Editing / Block Theme)
- **Google AdSense:** Root `ads.txt` containing `google.com, pub-3413556435934115, DIRECT, f08c47fec0942fa0`
- **Google Ads Account:** `519-933-5510`
- **Notion CMS Bridge:** Managed via `prime-notion-bridge/` (runs locally, publishes blocks via WP REST API)
