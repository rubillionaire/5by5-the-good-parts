.PHONY: clean

build: clean-built-javascript dl-shows public/shows.json
	npm run bundle-javascript

dev:
	npm run dev

deploy: build
	npm run deploy

public/shows.json:
	node make-shows-feed.js

dl-shows: talkshow hypercritical buildanalyze afterdark b2w

talkshow:
	curl -O https://feeds.5by5.tv/talkshow

hypercritical:
	curl -O http://feeds.5by5.tv/hypercritical

buildanalyze:
	curl -O http://feeds.5by5.tv/buildanalyze

afterdark:
	curl -O https://feeds.5by5.tv/afterdark

b2w:
	curl -O https://feeds.5by5.tv/b2w

clean-source-feeds:
	rm b2w
	rm talkshow
	rm hypercritical
	rm buildanalyze
	rm afterdark

clean-merged-feed:
	rm public/shows.json

clean-built-javascript:
	rm public/bundle.js

clean: clean-source-feeds clean-merged-feed clean-built-javascript
