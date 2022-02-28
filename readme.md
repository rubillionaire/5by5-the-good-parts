# [5by5][5by5] the good parts

**update:** 5by5.tv no longer hosts these podcasts, so this interface is no longer useful.

a podcast player web app that interleaves 5 podcast feeds into a unified list. state of the list is persisted in localStorage and secondarily in a remote [hyperbee](https://github.com/hypercore-protocol/hyperbee) when it is available.

### background

[5by5][5by5] is a podcast network that had 4 shows that i listened to from 2010 to 2012. back to work, build and analyze, hypercritical & the talk show. there was often discussion in each of these shows that referenced what happened on the most recent episode of another of show. to recreate the experience of listening to these shows as they aired, i have produced this interface.


### usage

- `npm install` dependencies
- `npm start` to bundle the browser javascript and start the http & websocket server.

intended for use on a local network, sharing state between connected devices.

[5by5]:https://5by5.tv/
