FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea
RUN apt-get update && apt-get install -y --no-install-recommends xz-utils git && rm -rf /var/lib/apt/lists/*
COPY node.tar.xz /trusted/node.tar.xz
RUN echo '48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75  /trusted/node.tar.xz' | sha256sum --check && mkdir -p /opt/node24 && tar -xJf /trusted/node.tar.xz --strip-components=1 -C /opt/node24 && rm /trusted/node.tar.xz
ENV PATH=/opt/node24/bin:/usr/local/bin:/usr/bin:/bin
WORKDIR /deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN node --version && npm install --prefix /manager --ignore-scripts --no-audit --no-fund --save-exact pnpm@11.25.0 && node /manager/node_modules/pnpm/bin/pnpm.cjs install --frozen-lockfile --ignore-scripts
USER 1000:1000
