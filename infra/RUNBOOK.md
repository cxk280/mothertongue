# Deploy runbook — real pipeline on a Vultr GPU (São Paulo)

The app runs fully on the CPU fallback with no GPU (see the root README). This runbook
is for standing up the **real** models on an in-region Vultr GPU. It is hourly-billed —
**tear it down when you're done.**

## Prerequisites

- A Vultr account + API key → `export VULTR_API_KEY=…`
- `curl` and `jq` locally
- An SSH key registered with the box (or add one after provisioning)
- The box needs Docker + the NVIDIA container runtime (recent Vultr GPU marketplace
  images include these; otherwise install `nvidia-container-toolkit`)

## 1. Provision the GPU

```bash
./infra/provision.sh          # creates a Cloud GPU in region "sao", prints the IP
# override the plan/OS if you like:
# MT_VULTR_PLAN=vcg-a16-2c-8g-2vram ./infra/provision.sh
```

The IP is written to `infra/.instance-id` (id) and echoed (ip).

## 2. Deploy the service

```bash
MT_HOST=<box-ip> ./infra/deploy.sh
curl http://<box-ip>:8000/healthz     # {"status":"ok", "device":"cuda", ...}
```

First start downloads the models (MMS-ASR ~1 GB, NLLB-600M ~2.4 GB, MMS-TTS small) into
the `/opt/mothertongue/models` volume; subsequent restarts reuse them.

## 3. Point the web app at it

```bash
# web/.env.local
NEXT_PUBLIC_WS_URL=ws://<box-ip>:8000/ws
```

Then `make web` (or deploy the web app to any cheap host). The Landing ping and the Call
HUD will now show the **real** São Paulo round-trip.

> For anything public, put TLS in front (a reverse proxy) and use `wss://`. The demo
> service allows all origins; tighten `CORSMiddleware` before exposing it broadly.

## 4. Tear it down (stops billing)

```bash
./infra/teardown.sh           # uses infra/.instance-id, or pass the id explicitly
```

## Cost

A ~4-hour demo session on a lean Cloud GPU plan is roughly a few dollars (see the cost
table in the root README). The GPU is stateless cattle — destroy it between sessions.
