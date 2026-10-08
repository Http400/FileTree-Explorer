FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build
ARG APP_SHA
RUN printf '%s' "$APP_SHA" | grep -Eq '^[0-9a-f]{40}$' \
    && printf '%s\n' "$APP_SHA" > dist/version.txt

FROM nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94
RUN rm /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=6 \
    CMD wget -q -O - http://127.0.0.1/healthz | grep -qx ok
