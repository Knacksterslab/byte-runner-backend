FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json ./

# Install ALL dependencies (needed for build)
RUN npm install && npm list

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Verify build succeeded (NestJS outputs to dist/src/main.js)
RUN ls -la dist/ && ls -la dist/src/ && test -f dist/src/main.js

FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN npm install --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# Start the application (NestJS outputs to dist/src/main.js)
CMD ["node", "dist/src/main"]
