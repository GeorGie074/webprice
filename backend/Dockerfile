FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files first (layer cache)
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Install Playwright Chromium + all system dependencies automatically
RUN npx playwright install chromium --with-deps

# Install Xvfb — provides a virtual X display so Chrome can run with
# headless:false (better bot-detection evasion) on a headless Linux server.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Build TypeScript → dist/
RUN npm run build

EXPOSE 5000

# xvfb-run starts a temporary virtual display (:99, 1366x768, 24-bit colour)
# and makes $DISPLAY available to child processes.  Chrome then launches in
# "headed" mode against this virtual screen — indistinguishable from a real
# desktop to Cloudflare / anti-bot checks — while the container stays headless.
# Start Xvfb virtual display as a background process, then launch the app.
# Using Xvfb directly (instead of xvfb-run) avoids the xauth dependency.
# -ac disables X access control so Chrome can connect without a cookie file.
CMD ["/bin/sh", "-c", "Xvfb :99 -screen 0 1366x768x24 -ac & sleep 1 && DISPLAY=:99 exec npm run start"]
