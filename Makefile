.PHONY: infra-up infra-down infra-logs infra-reset infra-status dev

infra-up:
	docker compose up -d

infra-down:
	docker compose down -v

infra-reset:
	docker compose down -v
	docker compose up -d

infra-logs:
	docker compose logs -f

infra-status:
	docker compose ps

dev: infra-up
	pnpm dev