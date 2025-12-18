# HTTPS setup

This image now serves HTTPS on port 443. At runtime it looks for a certificate and key at:

- `/etc/ssl/private/fullchain.pem`
- `/etc/ssl/private/privkey.pem`

In `docker-compose.yml` these paths are mapped to `./nginx/certs`, so drop your real certificates there (they are ignored by git via `.gitkeep`). If the files are missing, the container generates a self-signed certificate for `localhost` so it can still start (browsers will show a warning).

Quick steps to use a real cert (Let’s Encrypt):
1. Obtain the cert on the host with certbot and copy/symlink `fullchain.pem` and `privkey.pem` into `nginx/certs/`.
2. `docker compose up -d --build nginx` to reload Nginx with HTTPS.
3. Open `https://<your-domain>` and allow microphone access.

Port 80 is kept for ACME challenges and redirects traffic to HTTPS. Port 443 serves the app and proxies `/api/` to the backend.
