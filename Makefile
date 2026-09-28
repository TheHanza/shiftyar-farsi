.PHONY: help setup dev-backend dev-frontend demo test lint build docker deploy

help: ## Show this help
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[35m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies
	cd backend && go mod download
	cd frontend && npm ci

dev-backend: ## Run the API on :8080 (reads .env)
	cd backend && set -a && . ../.env && set +a && go run ./cmd/server

dev-frontend: ## Run the Vite dev server on :5173 (proxies /api to :8080)
	cd frontend && npm run dev

demo: ## Run the API with sample employees and shifts (password demo1234)
	cd backend && set -a && . ../.env && set +a && go run ./cmd/server --demo

test: ## Run all tests and type checks
	cd backend && go vet ./... && go test ./...
	cd frontend && npm run lint

lint: ## Check formatting
	@test -z "$$(gofmt -l backend)" || (gofmt -l backend && exit 1)
	cd frontend && npm run lint

build: ## Build the frontend and a single backend binary into backend/bin
	cd frontend && npm run build
	cd backend && CGO_ENABLED=0 go build -o bin/shiftyar ./cmd/server

docker: ## Build the Docker image
	docker build -t shiftyar:local .

deploy: ## Deploy to the server (see deploy/deploy.sh help)
	./deploy/deploy.sh deploy
