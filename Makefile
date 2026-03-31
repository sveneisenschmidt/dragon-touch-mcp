.PHONY: build dev inspect test clean kiosk-install kiosk-open kiosk-close kiosk-provision kiosk-demo

KIOSK_APP_SRC  ?=
KIOSK_APP_DEST ?= /sdcard/kiosk-app

# macOS (Homebrew) defaults — override via env vars on Linux
UNAME := $(shell uname)
ifeq ($(UNAME), Darwin)
  ANDROID_HOME ?= /opt/homebrew/share/android-commandlinetools
  JAVA_HOME    ?= /opt/homebrew/opt/openjdk
else
  ANDROID_HOME ?= $(HOME)/Android/Sdk
  JAVA_HOME    ?= /usr/lib/jvm/java-17-openjdk-amd64
endif
KIOSK_URL    ?= https://sven.eisenschmidt.website

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

kiosk-install:
	@command -v java >/dev/null 2>&1 || (echo "Error: Java not found. Install OpenJDK (brew install openjdk / apt install default-jdk)" && exit 1)
	@command -v gradle >/dev/null 2>&1 || (echo "Error: Gradle not found. Install Gradle (brew install gradle / apt install gradle)" && exit 1)
	@test -d "$(ANDROID_HOME)/platforms" || (echo "Error: Android SDK not found at $(ANDROID_HOME). Set ANDROID_HOME or install Android command line tools." && exit 1)
	cd android && JAVA_HOME=$(JAVA_HOME) ANDROID_HOME=$(ANDROID_HOME) gradle assembleDebug
	adb -s $(DRAGON_TOUCH_IP):5555 install -r android/app/build/outputs/apk/debug/app-debug.apk

kiosk-provision: build
	@test -n "$(KIOSK_APP_SRC)" || (echo "Error: KIOSK_APP_SRC is required. Usage: make kiosk-provision KIOSK_APP_SRC=./dist" && exit 1)
	adb -s $(DRAGON_TOUCH_IP):5555 shell rm -rf $(KIOSK_APP_DEST)
	adb -s $(DRAGON_TOUCH_IP):5555 push $(KIOSK_APP_SRC)/. $(KIOSK_APP_DEST)
	DRAGON_TOUCH_IP=$(DRAGON_TOUCH_IP) node dist/index.js open_url '{"url":"file://$(KIOSK_APP_DEST)/index.html"}'

kiosk-demo: build
	adb -s $(DRAGON_TOUCH_IP):5555 shell rm -rf /sdcard/kiosk-demo
	adb -s $(DRAGON_TOUCH_IP):5555 push demo/kiosk/. /sdcard/kiosk-demo
	DRAGON_TOUCH_IP=$(DRAGON_TOUCH_IP) node dist/index.js open_url '{"url":"file:///sdcard/kiosk-demo/index.html"}'

kiosk-open: build
	DRAGON_TOUCH_IP=$(DRAGON_TOUCH_IP) node dist/index.js open_url '{"url":"$(KIOSK_URL)"}'

kiosk-close: build
	DRAGON_TOUCH_IP=$(DRAGON_TOUCH_IP) node dist/index.js close_browser
