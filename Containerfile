# Build-Stufe: Angular-Produktions-Build
FROM docker.io/library/node:25-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

# Laufzeit: nginx liefert die SPA aus und leitet Backend-Pfade weiter (gleicher Origin für BFF-Cookies)
FROM docker.io/library/nginx:1.29-alpine
ENV BACKEND_URL=http://backend:8080 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/Haushaltsbuch-Frontend/browser /usr/share/nginx/html
EXPOSE 80
