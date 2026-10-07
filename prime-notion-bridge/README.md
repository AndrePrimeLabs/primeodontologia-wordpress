# Prime Notion CMS Sync & Bridge

Easily manage and update your WordPress website directly from Notion.

Supports:
- **Direct Publishing**: Set status to `Published` in Notion to update your live WordPress pages and articles immediately.
- **Both Pages & Posts**: Manage core static landing pages (`Meu Sorriso`, `Como o Invisalign Funciona`, `Equipe`, `Dúvidas`) as well as dynamic blog articles.
- **Gutenberg Block Conversion**: Converts Notion paragraphs, headings, quotes, lists, callout boxes, and tables into clean WordPress block theme markup styled with Prime Odontologia design tokens.
- **Automatic Media Sideloading**: Downloads images from Notion, uploads them to your WordPress Media Library, and embeds responsive blocks.
- **Incremental Caching**: Skips unchanged pages based on `last_edited_time` and SHA-256 hashes.
- **Watcher / Daemon Mode**: Polls Notion periodically for live hands-off syncing.

---

## 1. Quick Setup Guide

### Step 1: Create a Notion Internal Integration
1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Click **"+ New integration"**.
3. Name it **"Prime Odontologia CMS"** and select your workspace.
4. Set Capabilities to **Read content** (and optionally Update content).
5. Copy your **Internal Integration Secret** (`secret_...`).

### Step 2: Create Your Notion CMS Database
Create a database in Notion with the following columns:

| Property Name | Property Type | Description | Example Values |
|---|---|---|---|
| **Title** | Title | Name of the page or article | `Meu Sorriso`, `Dúvidas Frequentes` |
| **Slug** | Text | The URL permalink path | `meu-sorriso`, `como-o-invisalign-funciona` |
| **Type** | Select | Page (static) or Post (blog) | `Page`, `Post` |
| **Status** | Status / Select | Publication state | `Published`, `Draft`, `Archived` |
| **Excerpt** | Text | Short summary (SEO & cards) | `Conheça os alinhadores transparentes...` |

> **Important**: Click the `...` menu on the top right of your Notion Database page -> **"Connections"** (or "Add connections") -> Select **"Prime Odontologia CMS"**. This grants the integration access to the database.

Copy your **Database ID** from the URL:
`https://www.notion.so/myworkspace/{DATABASE_ID}?v=...`

### Step 3: Get WordPress Application Password
1. Log in to your WordPress Admin (`/wp-admin/`).
2. Go to **Users -> Profile** (or your user account).
3. Scroll down to **Application Passwords**.
4. Enter an application name (e.g. `Notion Bridge`) and click **Add New Application Password**.
5. Copy the generated password (e.g. `abcd efgh ijkl mnop`).

### Step 4: Configure Local `.env`
In this directory, copy `.env.example` to `.env`:
```bash
cp prime-notion-bridge/.env.example prime-notion-bridge/.env
```
Fill in your credentials:
```env
NOTION_TOKEN="secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
NOTION_DATABASE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
WP_BASE_URL="http://localhost:8882" # Or your live site URL
WP_USER="admin"
WP_APP_PASSWORD="xxxx xxxx xxxx xxxx"
SYNC_PUBLISH_MODE="direct"
```

---

## 2. Sync Commands

Run these from the repository root:

### One-Time Sync
Sync all pages/posts from Notion to WordPress:
```bash
npm run sync
```

### Continuous Watcher (Auto-Sync)
Polls Notion every 60 seconds (or custom interval) and immediately publishes changes:
```bash
npm run sync:watch
```
To set a custom interval (e.g., 30 seconds):
```bash
node prime-notion-bridge/notion_cms_sync.mjs --watch --interval=30
```

### Force Sync
Re-sync and update all pages even if `last_edited_time` has not changed:
```bash
npm run sync:force
```

### Dry Run (Preview Changes)
Inspect what would be synced without touching WordPress:
```bash
npm run sync:dry-run
```

---

## 3. Running Unit Tests

Run the full offline test suite:
```bash
npm test
```
All Notion block conversions, sanitizations, Gutenberg output, and upsert logic are verified automatically.
