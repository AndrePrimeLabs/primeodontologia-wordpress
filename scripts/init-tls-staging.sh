#!/bin/zsh
set -euo pipefail

: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL to the certificate administrator email}"
: "${WP_HOME:=https://staging-564a-primeodontologiacloud.wpcomstaging.com}"
: "${WP_SITEURL:=https://staging-564a-primeodontologiacloud.wpcomstaging.com}"
: "${WORDPRESS_IMAGE:?Set WORDPRESS_IMAGE to the published production image}"
: "${DB_NAME:?Set DB_NAME}"
: "${DB_USER:?Set DB_USER}"
: "${DB_PASSWORD:?Set DB_PASSWORD}"
: "${DB_ROOT_PASSWORD:?Set DB_ROOT_PASSWORD}"

host='primeos.primeodontologia.com.br'

print 'Starting WordPress and the temporary ACME challenge endpoint'
docker compose -f compose.prod.yml -f compose.tls.yml up -d wordpress

print 'Checking temporary Nginx configuration'
docker compose -f compose.prod.yml -f compose.tls.yml run --rm --no-deps \
  --volume "$PWD/deploy/nginx/primeos-bootstrap.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx nginx -t

print 'Starting temporary Nginx challenge server'
docker compose -f compose.prod.yml -f compose.tls.yml run --rm --no-deps --service-ports \
  --volume "$PWD/deploy/nginx/primeos-bootstrap.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx nginx -g 'daemon off;' &
bootstrap_pid=$!
cleanup() {
  kill "$bootstrap_pid" >/dev/null 2>&1 || true
  wait "$bootstrap_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT
sleep 3

print "Requesting certificate for ${host}"
docker compose -f compose.prod.yml -f compose.tls.yml run --rm --no-deps certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --domain "$host" --email "$CERTBOT_EMAIL" \
  --agree-tos --no-eff-email --non-interactive

cleanup
trap - EXIT
print 'Starting TLS-enabled reverse proxy'
docker compose -f compose.prod.yml -f compose.tls.yml up -d nginx

docker compose -f compose.prod.yml -f compose.tls.yml ps
