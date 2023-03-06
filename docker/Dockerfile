ARG IMAGE=node:16.16.0-alpine
FROM $IMAGE as storyteller

WORKDIR /app
RUN apk add --no-cache bash curl git py-pip make && \
  curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | sh && \
  npm cache clean --force

FROM storyteller
COPY docker ./docker
COPY package.json package-lock.json ./
RUN npm install npm@8.19.3 -g
RUN npm clean-install && npm cache clean --force && \
  npm dedupe
COPY . .
EXPOSE 3000