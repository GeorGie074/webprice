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

# Start Xvfb virtual display, then wait until it is actually ready before
# launching the app.  We poll the X11 lock file (/tmp/.X99-lock) which Xvfb
# creates only after the display socket is listening — far more reliable than
# a fixed sleep that can race on slow container starts.
# -ac disables X access control so Chrome can connect without a cookie file.
# Timeout guard (15 s) prevents the container from hanging forever if Xvfb
# fails to start at all; the app's headless fallback in browser.ts handles that.
CMD ["/bin/sh", "-c", "Xvfb :99 -screen 0 1366x768x24 -ac & timeout 15 sh -c 'until [ -f /tmp/.X99-lock ]; do sleep 0.1; done' && echo 'Xvfb ready' && DISPLAY=:99 exec npm run start"]
