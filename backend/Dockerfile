# Stage 1: Build dependencies
FROM node:18-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# Stage 2: Final running image
FROM node:18-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .

# Security: run under non-root permissions
RUN addgroup -g 10001 appgroup && \
    adduser -u 10001 -G appgroup -h /home/appuser -D appuser && \
    chown -R appuser:appgroup /usr/src/app

USER appuser

EXPOSE 5000
EXPOSE 5001

CMD ["node", "src/index.js"]
