rm -rf node_modules \
    && npm i \
    && npm run test-types \
    && npm run build \
    && cd .dist \
    && npm install --package-lock-only \
    && cd ..