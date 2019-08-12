const {FeedClient} = require('./src/net/client'),
      {App} = require('./src/ui/ui');



function main_chat() {
    var c1 = new FeedClient();

    App.start().attach(c1);

    window.addEventListener('beforeunload', () => {
        c1.close();
    });
    Object.assign(window, {c1});  // for debugging
}



if (typeof process !== 'undefined' && process.versions.nw)
    global.console = window.console;  // for debugging in nwjs

if (typeof window !== 'undefined') {
    Object.assign(window, {main_chat});
}
else {
    var c1 = new FeedClient();
    c1.join('lobby', false); // listen only
    c1.on('append', ev => console.log(ev.data));
}
