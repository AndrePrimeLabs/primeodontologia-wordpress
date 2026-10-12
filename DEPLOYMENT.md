# Deployment Instructions for primeodontologia.com.br

## Standing policy — MUST be followed on every push/deploy to the live site
This file is a permanent instruction. Treat it as binding for any future
`site_push`, deploy, or sync to **https://primeodontologia.com.br** (remote 255038635).

### 1. Never replace, remove, or overwrite plugins
- Do **NOT** change the installed/active **plugins** on the live site when deploying.
- Do **NOT** deactivate, delete, replace, or upgrade plugins on production.
- A push must **not** sync `plugins` in a way that alters the live plugin set/state.
  (i.e. avoid `options=all` / the `plugins` sync option; exclude plugin changes.)

### 2. Never alter the live wp-admin
- Do **NOT** modify wp-admin settings, site configuration, options, users,
  roles, or admin-side state on the production site.
- Do **NOT** change the admin user, passwords, or any wp-admin-managed setting
  as part of a deploy.
- Site configuration and admin preferences are managed manually and must remain
  untouched by automated deploys.

### 3. Content and theme only
- Pushes to primeodontologia.com.br should be limited to the intended **content**
  and **theme** changes for this webpage.
- Preserve the live plugins, wp-admin configuration, and CMS settings.

### 4. Confirm before pushing
- Always confirm the exact target (https://primeodontologia.com.br / 255038635)
  and the exact sync options with the user before any push.
- Never use a full "all" push that would overwrite plugins or wp-admin state.

---

## Project context
- This local site (`primeodontologia-wordpress`) and the local backup
  (`prime-production-backup`) both correspond to **https://primeodontologia.com.br**
  (remote 255038635). The same deployment policy above applies to both.
