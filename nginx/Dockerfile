FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./

# Override Vite API settings for production build so that all requests go through nginx over HTTP.
ARG VITE_API_URL=/api
ARG VITE_API_PATH=/api
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_PATH=${VITE_API_PATH}

RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache openssl
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY nginx/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV SSL_CERT_PATH=/etc/ssl/private/fullchain.pem
ENV SSL_KEY_PATH=/etc/ssl/private/privkey.pem

ENTRYPOINT ["/entrypoint.sh"]
