#!/bin/zsh
set -euo pipefail

: "${REGISTRY:?Set REGISTRY, for example ghcr.io/AndrePrimeLabs}"
: "${IMAGE_NAME:=primeodontologia-wordpress}"
: "${IMAGE_TAG:=$(git rev-parse --short HEAD)}"
: "${WP_HOME:?Set WP_HOME to the staging URL}"
: "${WP_SITEURL:?Set WP_SITEURL to the staging URL}"

expected_domain='staging-564a-primeodontologiacloud.wpcomstaging.com'
case "$WP_HOME" in
  "https://${expected_domain}"|"https://${expected_domain}/") ;;
  *) print -u2 "Refusing deployment: WP_HOME must be https://${expected_domain}"; exit 1 ;;
esac

case "$WP_SITEURL" in
  "https://${expected_domain}"|"https://${expected_domain}/") ;;
  *) print -u2 "Refusing deployment: WP_SITEURL must be https://${expected_domain}"; exit 1 ;;
esac

image="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
export WORDPRESS_IMAGE="$image"
export WP_ENVIRONMENT_TYPE="${WP_ENVIRONMENT_TYPE:-staging}"
export WORDPRESS_DEBUG="${WORDPRESS_DEBUG:-0}"

print "Building ${image}"
docker build --pull -f Dockerfile.prod -t "$image" .

if [[ "${PUSH_IMAGE:-0}" == '1' ]]; then
  print "Pushing ${image}"
  docker push "$image"
fi

if [[ "${DEPLOY_LOCAL:-0}" == '1' ]]; then
  : "${DB_NAME:?Set DB_NAME when DEPLOY_LOCAL=1}"
  : "${DB_USER:?Set DB_USER when DEPLOY_LOCAL=1}"
  : "${DB_PASSWORD:?Set DB_PASSWORD when DEPLOY_LOCAL=1}"
  : "${DB_ROOT_PASSWORD:?Set DB_ROOT_PASSWORD when DEPLOY_LOCAL=1}"
  print "Starting staging Compose services"
  docker compose -f compose.prod.yml up -d --no-build --pull always
  docker compose -f compose.prod.yml ps
else
  print "Image ready. Set DEPLOY_LOCAL=1 on the staging Docker host to start Compose."
fi
