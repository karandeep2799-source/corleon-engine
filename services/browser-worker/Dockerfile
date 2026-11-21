FROM node:24-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    CHROME_BIN=/usr/bin/chromium \
    CHROME_DEVTOOLS_MCP_NO_CONFIG_DISCOVERY=1 \
    NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && npm install --global --omit=dev chrome-devtools-mcp@1.12.0 \
 && npm cache clean --force

RUN install -d -o node -g node /tmp/chrome-devtools /home/node/.cache

COPY --chown=root:root config/mcp/chrome-devtools-worker.json /etc/corleon/chrome-devtools.json
RUN chmod 0444 /etc/corleon/chrome-devtools.json

USER node
WORKDIR /home/node
ENTRYPOINT ["/usr/bin/tini", "--", "chrome-devtools-mcp"]
CMD ["--config=/etc/corleon/chrome-devtools.json", "--headless=true", "--isolated=true", "--page-id-routing=true", "--no-javascript-evaluation", "--no-usage-statistics", "--no-update-checks", "--no-performance-crux"]
