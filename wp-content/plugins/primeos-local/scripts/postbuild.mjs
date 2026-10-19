import fs from 'fs';
import path from 'path';

try {
  // Ensure distribution directory exists
  if (!fs.existsSync('dist')) fs.mkdirSync('dist');

  // Copy manifest configurations safely
  if (fs.existsSync('public/manifest.webmanifest')) {
    fs.copyFileSync('public/manifest.webmanifest', 'dist/manifest.webmanifest');
    fs.copyFileSync('public/manifest.webmanifest', 'dist/manifest.json');
    console.log('✅ Manifest files synchronized.');
  }

  if (fs.existsSync('login.html')) {
    fs.copyFileSync('login.html', 'dist/login.html');
    console.log('Login page copied.');
  }

  if (fs.existsSync('src/assets/prime-logo.svg')) {
    fs.copyFileSync('src/assets/prime-logo.svg', 'dist/prime-logo.svg');
    console.log('PrimeOS logo copied.');
  }

  // Generate hardened .htaccess for Hostinger Apache (/primeos/ subpath)
  const htaccess = `# ==============================================================================
# PrimeOS Production Apache Configuration for Hostinger (/primeos/ subpath)
# ==============================================================================

Options -Indexes -MultiViews

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set X-XSS-Protection "1; mode=block"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

<FilesMatch "^\\\\.">
  Order allow,deny
  Deny from all
</FilesMatch>

<FilesMatch "\\\\.(env|sql|log|sh|yml|yaml|config|lock|jsonc)$">
  Order allow,deny
  Deny from all
</FilesMatch>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresDefault "access plus 1 hour"
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 month"
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/jpeg "access plus 1 month"
  ExpiresByType image/webp "access plus 1 month"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /primeos/
  RewriteRule ^index\\\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /primeos/index.html [L]
</IfModule>
`;
  fs.writeFileSync('dist/.htaccess', htaccess);
  console.log('✅ Hardened .htaccess created in dist/.');

  // Never copy server api/ or secrets into dist/
  if (fs.existsSync('dist/api')) {
    fs.rmSync('dist/api', { recursive: true, force: true });
    console.log('🧹 Cleaned up old dist/api directory.');
  }
} catch (error) {
  console.log('Post-build notice:', error.message);
}
