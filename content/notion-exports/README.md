# Notion Content Import Directory

Drop your exported Notion files into this folder:

- **Markdown / ZIP Exports**: Markdown files (`.md`) with companion image folders.
- **HTML Exports**: Notion HTML exports (`.html`) with embedded styles/media.
- **CSV / Database Exports**: CSV tables exported from Notion databases.

---

## How Notion Content Maps to WordPress & Custom Domain

| Notion Property | Type           | Destination Field  | Example                             |
| --------------- | -------------- | ------------------ | ----------------------------------- |
| **Title**       | Title          | `post_title`       | `2 - Como o Invisalign funciona?`   |
| **Slug**        | Text / Formula | `post_name`        | `como-o-invisalign-funciona`        |
| **Type**        | Select         | `post_type`        | `page` or `post`                    |
| **Status**      | Status / Select| `post_status`      | `publish` or `draft`                |
| **Excerpt**     | Text           | `post_excerpt`     | Short summary for cards & meta tags |
| **Category**    | Select / Multi | `category`         | `Blog do Dentista`, `Tratamentos`   |

---

## Direct Deployment Paths to `primeodontologia.com.br`

1. **Notion as CMS -> WordPress Block Theme (Current Setup via `prime-notion-bridge/`)**:
   - Write and edit in Notion.
   - The bridge script converts Notion blocks to native WordPress Gutenberg blocks with Prime Odontologia design tokens.
   - Pushes automatically to `primeodontologia.com.br` via WP REST API.

2. **Direct Notion Sites Custom Domain**:
   - Notion Sites natively allows assigning a custom domain directly to a public Notion page or workspace database.
   - Alternatively, a Cloudflare Worker proxy maps `primeodontologia.com.br` directly to your live Notion public page with custom SEO headers and caching.
