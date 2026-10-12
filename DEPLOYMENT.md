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
- When pushing from Studio, **exclude `plugins`** from the sync options
  (e.g. `sqls,uploads,themes,contents`) so the remote plugin setup is never
  overwritten.
- **ALSO exclude `sqls` (the database) from pushes to the live site.** The
  database export carries the local `active_plugins` option and plugin
  configuration; importing it overwrites the live plugin activation list and
  deactivates every plugin that exists only on the live site. Push **only
  `contents,uploads,themes`** to `primeodontologia.blog`. Deploy content via the
  `contents` option and make plugin-related changes directly on the live site.

## Push confirmation
- Always confirm the exact target (`primeodontologia.blog`) before any
  `site_push`. Never push without explicit confirmation of the target.
