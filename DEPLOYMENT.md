# Deployment Guardrails — Prime Odontologia (local project)

These rules are mandatory for every deploy / push in this project. Follow them
in every session.

## Target & origin
- This local project (site dir `primeodontologia-wordpress`) deploys **only** to
  **`primeodontologia.blog`**.
- **NEVER deploy, push, or otherwise touch `primeodontologia.com.br`.** That
  domain is a separate project with its own repo and its own backup process.
  It must never be selected as a push target from this project.

## Live wp-admin & plugins — DO NOT alter
- **Never replace, install/uninstall, update, or otherwise change the plugins**
  on the live `primeodontologia.blog` site's wp-admin.
- **Never alter the live `primeodontologia.blog` wp-admin** settings,
  configurations, plugin options, users, or theme selections as part of a deploy.
  The client configures plugins on that site themselves.
- **The live site owns its own content and media.** The user edits pages and
  uploads images directly in WordPress on the live site. NEVER push `contents`
  or `uploads` in a routine deploy, or it overwrites those direct edits and
  replaces the live media library.
- **Default Studio push to `primeodontologia.blog` is `themes` only** (the design
  system this project owns). `contents`, `uploads`, `sqls`, or `plugins` are
  pushed ONLY on explicit, deliberate request with confirmation.
- **Never push `uploads`.** The live media library (managed directly on the site)
  is authoritative; pushing it replaces their media.
- **Never push `sqls` or `plugins`.** The database carries the local
  `active_plugins` option and plugin configuration; importing it overwrites the
  live plugin activation list and deactivates every plugin that exists only on
  the live site.

## Push confirmation
- Always confirm the exact target (`primeodontologia.blog`) before any
  `site_push`. Never push without explicit confirmation of the target.

## Future production migration (ON HOLD — for later)
- This site stays on **staging** (`primeodontologia.blog`, a staging/development
  environment) while we continue coding. No production deploy now.
- Plan: buy another WordPress (annual) plan/domain and move the site to a true
  production environment there. We will migrate to that new site for the full
  production launch.
- Until that new production site exists: remain on staging, do NOT push `sqls`
  or `plugins`, and page/plugin edits are made directly in the live WordPress
  admin (as the user has decided).
- Heads-up to revisit before buying: if the production site must run plugins,
  the chosen plan needs a plugin-capable tier (plugins require at least the
  Business plan). No action now — just noted for later.
