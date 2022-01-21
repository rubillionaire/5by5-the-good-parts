.PHONY: clean dev-server

build: clean-javascript-bundle dl-feeds public/shows.json
	npm run bundle

dev-server:
	npm start

dev-browser:
	npm run watch

deploy: build
	npm run deploy

public/shows.json:
	./feeds/make-shows-feed

dl-feeds: feeds/talkshow feeds/hypercritical feeds/buildanalyze feeds/afterdark feeds/b2w

feeds/talkshow:
	curl https://feeds.5by5.tv/talkshow -o feeds/talkshow

feeds/hypercritical:
	curl http://feeds.5by5.tv/hypercritical -o feeds/hypercritical

feeds/buildanalyze:
	curl http://feeds.5by5.tv/buildanalyze -o feeds/buildanalyze

feeds/afterdark:
	curl https://feeds.5by5.tv/afterdark -o feeds/afterdark

feeds/b2w:
	curl https://feeds.5by5.tv/b2w -o feeds/b2w

clean-source-feeds:
	rm feeds/*

clean-shows-feed:
	rm public/shows.json

clean-javascript-bundle:
	rm public/bundle.js

clean: clean-source-feeds clean-merged-feed clean-javascript-bundle
