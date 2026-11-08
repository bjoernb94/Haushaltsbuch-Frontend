# Build-Stufe: Angular-Produktions-Build
FROM docker.io/library/node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Commit und Build-Zeit fürs Impressum; ohne Angabe fehlen sie dort.
ARG COMMIT=""
ARG BUILD_ZEIT=""
RUN npx ng build --define "HAUSHALTSBUCH_COMMIT='${COMMIT}'" --define "HAUSHALTSBUCH_BUILD_ZEIT='${BUILD_ZEIT}'"

# Laufzeit: nginx liefert die SPA aus und leitet Backend-Pfade weiter (gleicher Origin für BFF-Cookies)
FROM docker.io/nginxinc/nginx-unprivileged:1.31-alpine
ENV BACKEND_URL=http://backend:8080 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/sicherheits-header.conf /etc/nginx/snippets/sicherheits-header.conf
COPY --from=build /app/dist/Haushaltsbuch-Frontend/browser /usr/share/nginx/html
EXPOSE 8080
