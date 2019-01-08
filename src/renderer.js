const electron = require('electron')
const ipc = electron.ipcRenderer

const Vue = require('./vendors/vue.js');

let app = new Vue({
    el: '#app',
    data: {
        validated: false,
        secret: "",
        key: "",
        state: "processing",
        pairs: [],
        test: true,
        quoteАsset: "USDT",
        hidePricesForNumTicks: 10,
        buyDepth: 100,
        buyPercent: 1,
        sellDepth: 100,
        sellPercent: 0.5,
        orderSize: 12,
        balance: 100
    },

    methods: {
        pairClass: function (p) {
            if (p) {
                if (p.changes === undefined) {
                    return "bg-dark"
                } else if (p.changes < 0) {
                    return "bg-danger"
                } else {
                    return "bg-success"
                }
            } else {
                return "bg-dark"
            }
        },

        startMonitor: function () {
            this.state = "started";
        },

        pauseMonitor: function () {
            this.state = "connected";
        },

        connectMonitor: function() {
            if (this.secret === "" || this.key === "") {
                this.validated = true;
            } else {
                this.validated = false;
                this.state = "processing";
                ipc.send("try-connect", this.secret, this.key);
            }
            
        },

        disconnectMonitor: function() {
            this.state = "disconnected";
        }
    }
})

ipc.on("trading-pairs", (evt, symbols) => {
    if (symbols) {
        symbols.forEach(element => {
            app.pairs.push({symbol: element, price: undefined, changes: undefined})       
        });
    }
})

ipc.on("price-changes", (evt, data) => {
    if (data) {
        let index = app.pairs.findIndex(e => e.symbol === data.symbol);
        if (index >= 0) app.$set(app.pairs, index, data);
    }
})

ipc.on("initial-start", (evt) => {
    app.state = "disconnected";
})