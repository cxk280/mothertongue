#!/usr/bin/env bash
# Destroy the Vultr GPU instance to stop billing. This is the whole point of
# hourly billing — never leave the GPU running idle.
set -euo pipefail

: "${VULTR_API_KEY:?Set VULTR_API_KEY}"
API="https://api.vultr.com/v2"

id="${1:-}"
if [ -z "$id" ] && [ -f infra/.instance-id ]; then
  id=$(cat infra/.instance-id)
fi
: "${id:?Pass the instance id, or run provision.sh first (writes infra/.instance-id)}"

echo "Destroying instance $id…"
curl -sf -X DELETE "$API/instances/$id" -H "Authorization: Bearer $VULTR_API_KEY"
rm -f infra/.instance-id
echo "Done. Billing stopped."
