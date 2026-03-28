.PHONY: build dev inspect test clean

DRAGON_TOUCH_IP ?= 192.168.178.132

build:
	npm run build

dev:
	DRAGON_TOUCH_IP=$(DRAGON_TOUCH_IP) npm run dev

test: build
	DRAGON_TOUCH_IP=$(DRAGON_TOUCH_IP) bash scripts/smoke-test.sh

inspect: build
	DRAGON_TOUCH_IP=$(DRAGON_TOUCH_IP) npx @modelcontextprotocol/inspector node dist/index.js

clean:
	rm -rf dist
