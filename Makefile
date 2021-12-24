.PHONY: dl-shows clean

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

clean:
	rm b2w
