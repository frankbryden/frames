FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy application code
COPY . .

# Build frontend assets
RUN bun run build

# Expose port
EXPOSE 3000

# Run the application
CMD ["bun", "run", "src/index.ts"]
