ARG  NODE_VERSION=22
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY package*.json ./ /app/
RUN npm install
COPY . .
RUN npm run build

#FROM nginxinc/nginx-unprivileged:stable-alpine
#COPY --from=builder /app/dist /usr/share/nginx/html

FROM joseluisq/static-web-server:latest
COPY --from=builder /app/dist /public
