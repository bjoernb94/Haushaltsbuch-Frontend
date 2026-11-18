# Build-Stufe: Angular-Produktions-Build; Node-Version wie in .nvmrc
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
# Version aus der package.json, Commit und Build-Zeit wie oben; npm run image gibt alle drei mit.
# Beschreibung, URL und Lizenz überschreiben die geerbten Angaben des nginx-Images.
ARG VERSION=""
ARG COMMIT=""
ARG BUILD_ZEIT=""
LABEL org.opencontainers.image.title="Haushaltsbuch Frontend" \
      org.opencontainers.image.description="Haushaltsbuch: Angular-SPA, ausgeliefert mit nginx" \
      org.opencontainers.image.url="https://github.com/bjoernb94/Haushaltsbuch-Frontend" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.source="https://github.com/bjoernb94/Haushaltsbuch-Frontend" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${BUILD_ZEIT}"
