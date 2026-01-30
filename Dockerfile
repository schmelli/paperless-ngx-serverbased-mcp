# =============================================================================
# Paperless NGX MCP Server - Dockerfile
# =============================================================================
# Multi-stage build for a minimal, secure production image.
#
# Build:   docker build -t paperless-ngx-mcp-server .
# Run:     docker run -p 3000:3000 -e PAPERLESS_URL=... -e PAPERLESS_TOKEN=... paperless-ngx-mcp-server
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
# We use the official Node.js image for building. The build stage compiles
# TypeScript and installs all dependencies including devDependencies.
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
# If these files don't change, npm install will use cached layers
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
# The production stage uses a minimal base image and only includes what's
# needed to run the compiled JavaScript code.
FROM node:20-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="Paperless NGX MCP Server"
LABEL org.opencontainers.image.description="MCP Server for Paperless NGX document management"
LABEL org.opencontainers.image.version="1.0.0"

# Create non-root user for security
# Running as non-root is a security best practice for containers
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
# --omit=dev excludes devDependencies (TypeScript, etc.)
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R mcp:nodejs /app

# Switch to non-root user
USER mcp

# Environment variables with sensible defaults
# These can be overridden at runtime via docker run -e or docker-compose
ENV NODE_ENV=production
ENV TRANSPORT=http
ENV PORT=3000
ENV HOST=0.0.0.0

# PAPERLESS_URL and PAPERLESS_TOKEN must be provided at runtime
# We don't set defaults for security reasons

# Expose the HTTP port
EXPOSE 3000

# Health check for container orchestration
# This allows Docker/Kubernetes to know when the container is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
