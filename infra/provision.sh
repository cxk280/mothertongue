#!/usr/bin/env bash
# Provision a Vultr Cloud GPU instance in São Paulo for the inference server.
# Hourly-billed — remember to run infra/teardown.sh when you're done.
#
# Requires: VULTR_API_KEY, and jq + curl. Optional overrides via env (see below).
set -euo pipefail

: "${VULTR_API_KEY:?Set VULTR_API_KEY (https://my.vultr.com/settings/#settingsapi)}"

REGION="${MT_VULTR_REGION:-sao}"                 # São Paulo
PLAN="${MT_VULTR_PLAN:-vcg-a16-2c-8g-2vram}"     # a lean Cloud GPU plan; see `plans` API
OS_ID="${MT_VULTR_OS_ID:-1743}"                  # Ubuntu 22.04 x64
LABEL="${MT_VULTR_LABEL:-mothertongue-sao}"
TAG="mothertongue"
API="https://api.vultr.com/v2"

echo "Provisioning $PLAN in region '$REGION' (label: $LABEL)…"

body=$(cat <<JSON
{"region":"$REGION","plan":"$PLAN","os_id":$OS_ID,"label":"$LABEL","tags":["$TAG"],"backups":"disabled"}
JSON
)

resp=$(curl -sf -X POST "$API/instances" \
  -H "Authorization: Bearer $VULTR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$body")

id=$(echo "$resp" | jq -r '.instance.id')
echo "Instance created: $id — waiting for it to become active…"

for _ in $(seq 1 60); do
  info=$(curl -sf "$API/instances/$id" -H "Authorization: Bearer $VULTR_API_KEY")
  status=$(echo "$info" | jq -r '.instance.server_status // .instance.status')
  ip=$(echo "$info" | jq -r '.instance.main_ip')
  if [ "$ip" != "0.0.0.0" ] && [ "$status" = "ok" ]; then
    echo "READY  id=$id  ip=$ip"
    echo "Next: MT_HOST=$ip ./infra/deploy.sh"
    echo "$id" > infra/.instance-id
    exit 0
  fi
  sleep 10
done

echo "Timed out waiting for instance $id to become active." >&2
exit 1
