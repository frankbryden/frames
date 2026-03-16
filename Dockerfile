FROM oven/bun:1
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy application code
COPY . .

# Build frontend assets
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
