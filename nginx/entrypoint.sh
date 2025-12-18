#!/bin/sh
set -e

CERT_PATH="${SSL_CERT_PATH:-/etc/ssl/private/fullchain.pem}"
KEY_PATH="${SSL_KEY_PATH:-/etc/ssl/private/privkey.pem}"

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
  echo "No TLS certificate found at $CERT_PATH/$KEY_PATH. Generating a self-signed cert for localhost."
  mkdir -p "$(dirname "$CERT_PATH")"
  mkdir -p "$(dirname "$KEY_PATH")"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$KEY_PATH" -out "$CERT_PATH" \
    -subj "/CN=localhost"
fi

exec nginx -g "daemon off;"
