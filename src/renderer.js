const electron = require('electron')
const ipc = electron.ipcRenderer

const Vue = require('./vendors/vue.js');

let app = new Vue({
    el: '#app',
    data: {
        secret: "",
        key: "",
        state: "paused",
        pairs: []
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
            this.state = "paused";
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