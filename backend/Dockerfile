FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files first (layer cache)
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Install Playwright Chromium + all system dependencies automatically
RUN npx playwright install chromium --with-deps

# Copy source code
COPY . .

# Build TypeScript → dist/
RUN npm run build

EXPOSE 5000

CMD ["npm", "run", "start"]
