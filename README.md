# dat-p2p-chat

A simple chat application that runs in the browser and in NWjs.
Uses a signalling server ([signalhubws](https://github.com/soyuka/signalhubws)) to set up a
[WebRTC swarm](https://github.com/mafintosh/webrtc-swarm), where each peer sets up their own
[hypercore](https://github.com/mafintosh/hypercore) feed and listens to all the others'.

The UI is implemented with [Vue.js](https://vuejs.org).

To build:
```
npm i
npm run build
```

To run:

Either start `nw` in the project root directory or open `index.html` in a browser.

Works well on Chrome and Firefox. Safari has trouble with data-only connections
(see [this issue](https://github.com/feross/simple-peer/issues/502)).
