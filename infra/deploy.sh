#!/usr/bin/env bash
# Build and run the inference image on the GPU box over SSH.
# Requires: MT_HOST (the box IP, from provision.sh), SSH access, Docker + the
# NVIDIA container runtime installed on the box.
set -euo pipefail

: "${MT_HOST:?Set MT_HOST to the GPU box IP (see infra/provision.sh output)}"
SSH_USER="${MT_SSH_USER:-root}"
REMOTE="$SSH_USER@$MT_HOST"

echo "Syncing server/ to $REMOTE…"
rsync -az --delete --exclude '.venv' --exclude '__pycache__' \
  ./server/ "$REMOTE:/opt/mothertongue/server/"
scp infra/Dockerfile "$REMOTE:/opt/mothertongue/Dockerfile"

echo "Building image + (re)starting the service on the box…"
ssh "$REMOTE" bash -s <<'REMOTE_SH'
set -euo pipefail
cd /opt/mothertongue
docker build -f Dockerfile -t mothertongue-server ./server
docker rm -f mothertongue >/dev/null 2>&1 || true
docker run -d --name mothertongue --restart unless-stopped \
  --gpus all -p 8000:8000 \
  -v /opt/mothertongue/models:/models \
  mothertongue-server
docker ps --filter name=mothertongue
REMOTE_SH

echo "Deployed. Health: curl http://$MT_HOST:8000/healthz"
echo "Point the web app at it:  NEXT_PUBLIC_WS_URL=ws://$MT_HOST:8000/ws"
