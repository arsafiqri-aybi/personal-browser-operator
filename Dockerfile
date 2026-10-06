FROM mcr.microsoft.com/playwright:v1.63.0-noble

USER root

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
     xvfb \
     fluxbox \
     x11vnc \
     novnc \
     websockify \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY packages/operator-runtime/package.json ./packages/operator-runtime/package.json

RUN npm install --ignore-scripts

COPY packages/operator-runtime ./packages/operator-runtime
COPY container ./container

RUN npm -w @pbo/operator-runtime run build \
  && chmod +x /app/container/start-runtime.sh \
  && mkdir -p /data \
  && chown -R pwuser:pwuser /app /data

ENV PBO_DATA_DIR=/data
ENV PBO_HOST=0.0.0.0
ENV PBO_PORT=8787
ENV PBO_CONSOLE_HOST=0.0.0.0
ENV PBO_CONSOLE_PORT=8790
ENV PBO_HEADLESS=false
ENV DISPLAY=:99

VOLUME ["/data"]

EXPOSE 8787 8790 6080

USER pwuser

CMD ["/app/container/start-runtime.sh"]
