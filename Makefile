.PHONY: build dev inspect test clean kiosk-install kiosk-open kiosk-close

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

kiosk-open:
	adb -s $(DRAGON_TOUCH_IP):5555 shell am force-stop com.dragontouch.kioskbrowser
	adb -s $(DRAGON_TOUCH_IP):5555 shell am start -n com.dragontouch.kioskbrowser/.MainActivity --es url "$(KIOSK_URL)"

kiosk-close:
	adb -s $(DRAGON_TOUCH_IP):5555 shell am force-stop com.dragontouch.kioskbrowser
