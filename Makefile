# MotherTongue — dev + deploy shortcuts.
# The whole app runs with NO GPU via the CPU fallback: `make server` + `make web`.

.PHONY: help install server web dev test lint build provision deploy teardown

help:
	@echo "install    install web + server (fallback) deps"
	@echo "server     run the inference server on :8000 (fallback unless MT_DEVICE=cuda)"
	@echo "web        run the Next.js app on :3000"
	@echo "test       run server + web tests"
	@echo "lint       ruff + eslint"
	@echo "build      production build of the web app"
	@echo "provision  create the Vultr GPU box (infra/provision.sh)"
	@echo "deploy     build + push the GPU image and start the service (infra/deploy.sh)"
	@echo "teardown   destroy the Vultr GPU box to stop billing (infra/teardown.sh)"

install:
	cd server && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
	cd web && npm install

server:
	cd server && . .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

web:
	cd web && npm run dev

test:
	cd server && . .venv/bin/activate && pytest
	cd web && npm run typecheck && npm test --if-present

lint:
	cd server && . .venv/bin/activate && ruff check .
	cd web && npm run lint

build:
	cd web && npm run build

provision:
	./infra/provision.sh

deploy:
	./infra/deploy.sh

teardown:
	./infra/teardown.sh
