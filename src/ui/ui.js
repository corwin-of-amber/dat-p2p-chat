const Vue = require('vue/dist/vue'),
      moment = require('moment'),
      bidiText = typeof detectTextDir !== 'undefined' ? {detectTextDir} : require('./bidi-text');



Vue.component('plain-list', {
    data: () => ({ items: [] }),
    template: `
        <ul class="plain-list">
            <li v-for="item in items">
                <slot v-bind:item="item">{{item}}</slot>
            </li>
        </ul>
    `
});


Vue.component('p2p.source-peers', {
    data: () => ({ peers: [] }),
    template: `<span></span>`,
    mounted() {
        this.$root.$watch('clientState', (state) => {
            this.unregister(); if (state) this.register(state.client);
        }, {immediate: true});
    },
    methods: {
        updatePeers(client) {
            this.peers.splice(0, Infinity, ...client.peers.keys());
        },
        register(client) {
            client.deferred.init.then(() => {
                var cb = () => this.updatePeers(client);
                client.on('peer-connect', cb);
                client.on('peer-disconnect', cb);
                cb();
                this._registered = {client, cb};
            })
        },
        unregister() {
            if (this._registered) {
                var {client, cb} = this._registered;
                client.removeListener('peer-connect', cb);
                client.removeListener('peer-disconnect', cb);
            }
        }
    }
});

Vue.component('p2p.list-of-peers', {
    template: `
        <div>
            <p2p.source-peers ref="source"/>
            <plain-list ref="list"/>
        </div>
    `,
    mounted() {
        this.$refs.list.items = this.$refs.source.peers;
    }
});

Vue.component('p2p.source-messages', {
    data: () => ({ messages: [], messagesSorted: [] }),
    template: `<span/>`,
    watch: {
        messages() {
            var sl = this.messages.concat()
                         .sort((x,y) => x.timestamp - y.timestamp);
            this.messagesSorted.splice(0, Infinity, ...sl);
        }
    },
    mounted() {
        this.$root.$watch('clientState', (state) => {
            this.unregister(); if (state) this.register(state.client);
        }, {immediate: true});
    },
    methods: {
        register(client) {
            var cb = ev => { this.messages.push(ev.data); };
            client.on('append', cb);
            this._registered = {client, cb};
        },
        unregister() {
            if (this._registered) {
                var {client, cb} = this._registered;
                client.removeListener('append', cb);
            }
        }
    }
});

Vue.component('p2p.list-of-messages', {
    data: () => ({ messages: [] }),
    template: `
        <div>
            <p2p.source-messages ref="source"/>
            <p v-if="messages.length == 0">(Welcome)</p>
            <plain-list ref="list" v-slot="{item}">
                <template v-if="typeof item === 'object'">
                    <message :message="item" v-if="item.message"/>
                    <record-object :object="item" v-else/>
                </template>
                <template v-else>{{item}}</template>
            </plain-list>
        </div>
    `,
    mounted() {
        this.messages = this.$refs.list.items =
            this.$refs.source.messagesSorted;
    },
    components: {
        'message': {
            props: ['message'],
            template: `
                <div>
                    <span class="time" v-if="message.timestamp">{{time}}</span>
                    <span class="message" :dir="dir">{{message.message}}</span>
                </div>
            `,
            computed: {
                time() {
                    return moment(this.message.timestamp).format('HH:mm');
                },
                dir() {
                    return bidiText.detectTextDir(this.message.message || '');
                }
            }
        }
    }
});


Vue.component('p2p.button-join', {
    props: ['channel'],
    data: () => ({ pending: false, clientChannels: undefined }),
    template: `
        <span class="p2p-button-join" :class="status">
            <button @click="onClick()" :disabled="disabled">
                <slot>Join</slot>
            </button>
            <label>{{status}}</label>
        </span>`,
    computed: {
        status() {
            return this.joined ? "connected" :
                (this.pending ? "connecting" : "disconnected");
        },
        joined() {
            return this.clientChannels && !!this.clientChannels.has(this._channel);
        },
        disabled() { return !this._client || this.status != 'disconnected'; },
        _channel() { return this.channel || 'lobby'; },
        _client() { return this.$root.clientState && 
                           this.$root.clientState.client; }
    },
    mounted() {
        this.$root.$watch('clientState', (state) => {
            this.unregister(); if (state) this.register(state.client);
        }, {immediate: true});
    },
    methods: {
        async register(client) {
            await client.deferred.init;
            var update = () => this.clientChannels =
                new Set(client.swarm.channels);
            update();
            client.swarm.webrtc.on('connection', update);
            client.swarm.webrtc.on('close', update);
        },
        unregister() {
            this.clientChannels = null;
        },
        async onClick() {
            var c = this._client;
            if (c) {
                if (c.hub && !c.hub.opened) await c.reconnect();
                c.join(this._channel, false);
                this.pending = true;
                setTimeout(() => this.pending = false, 5000);
            }
        }
    }
});


Vue.component('p2p.message-input-box', {
    data: () => ({ message: '' }),
    template: `
        <form action="#" @submit="send">
            <input v-model="message">
            <input type="submit" value="Send">
        </form>
    `,
    computed: {
        _client() { return this.$root.clientState && 
                           this.$root.clientState.client; }
    },
    methods: {
        async send(ev) {
            if (ev) ev.preventDefault();

            if (!this.message.match(/^\s*$/)) {
                var msg = {timestamp: Date.now(), message: this.message};

                var c = this._client;
                if (c) {
                    if (!c.feed) await c.create();
                    c.feed.append(msg);
                    c.feed.once('append', () => this.message = '');
                }
            }
        }
    }
});

/* generic display of objects (mainly for debugging) */
Vue.component('record-object', {
    props: ['object'],
    template: `
        <span class="record" :class="kind">
            <template if="kind === 'object'">
                <span v-for="(v,k) in object">
                    {{k}}: <record-object :object="v"
                                          @select="$emit('select', $event)"/>
                    <br/>
                </span>
            </template>
            <template v-else>{{object}}</template>
        </span>
    `,
    computed: {
        kind() {
            var o = this.object;
            if (typeof(o) === 'object') return 'object';
            else return 'value';
        }
    }
});


class App {
    constructor(dom) {
        this.vue = new Vue({
            el: dom,
            data: {clientState: undefined}
        });
    }
    attach(client) {
        this.vue.client = client;  // non-reactive
        var update = () =>
            this.vue.clientState = { 
                get client() { return client; }
            };
        update(); client.on('init', update);
        return this;
    }
}

App.start = function (root) {
    window.app = new App(root || document.querySelector('#app'));
    return window.app;
}



if (typeof module !== 'undefined') {
    module.exports = {App};
}
