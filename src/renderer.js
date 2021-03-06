const electron = require('electron');
const ipc = electron.ipcRenderer;
const dialog = electron.remote.dialog;
const XLSX = require('xlsx');

const Vue = require('./vendors/vue.js');

let app = new Vue({
    el: '#app',
    data: {
        error: false,
        errorCode: "",
        errorMessage: "",
        validated: false,
        secret: "",
        key: "",
        state: "processing",
        mode: "grid",
        pairs: [],
        orders: [],
        test: true,
        quoteAsset: "USDT",
        requiredDayQuoteVolume: 10000000,
        hidePricesForNumTicks: 0,
        buyDepth: 10,
        buyPercent: 0.5,
        sellDepth: 10,
        sellPercent: -0.5,
        orderSize: 20,
        balance: 100,
        prevBalance: 100,
        binanceBalance: [],
        profit: 0
    },

    computed: {
        getAccBalance: function () {
            if (!this.test) {
                let a = this.quoteAsset;
                let c = this.binanceBalance.filter(b => b.currency === a);
                if (c.length > 0) {
                    return c[0].balance
                } else {
                    return 0
                }
            } else {
                return 0;
            }
        }
    },

    methods: {
        pairClass: function (p) {
            if (p) {
                if (p.changes === undefined) {
                    return "bg-dark"
                } else if (p.changes == 0 && p.status == 1) {
                    return "bg-danger"
                } else if (p.changes == 0 && p.status == 2) {
                    return "bg-success"
                } else if (p.changes < 0) {
                    return "bg-danger"
                } else {
                    return "bg-success"
                }
            } else {
                return "bg-dark"
            }
        },

        pairFooterClass: function (p) {
            if (p && p.order) {
                if (p.order.type == 'buy') {
                    return "bg-warning"
                } else if (p.order.profit >= 0) {
                    return ["bg-success", "text-white"]
                } else {
                    return ["bg-danger", "text-white"]
                }
            } else {
                return "bg-light"
            }
        },

        tableClass: function (o) {
            if (o) {
                if (o.type == 'buy') {
                    return "table-warning"
                } else if (o.profit >= 0) {
                    return "table-success"
                } else {
                    return "table-danger"
                }
            } else {
                return "table-light"
            }
        },

        startMonitor: function () {
            if (this.orderSize >= this.balance) {
                this.error = true;
                this.errorMessage = "An order size should be less then the trading balance."
            } else {
                this.error = false;
                this.state = "processing";
                let options = {
                    test: this.test,
                    quoteAsset: this.quoteAsset,
                    orderSize: this.orderSize,
                    quoteBalance: this.balance,
                    requiredDayQuoteVolume: this.requiredDayQuoteVolume,
                    hidePricesForNumTicks: this.hidePricesForNumTicks,
                    ignore: [],
                    historyDepth: [this.buyDepth, this.sellDepth, 1],
                    logPricesChanges: true,
                    buySignalOptions: { percent: this.buyPercent },
                    sellSignalOptions: { percent: this.sellPercent }
                };
                this.profit = 0;
                this.prevBalance = this.balance;
                ipc.send("try-start", options);
            }
        },

        pauseMonitor: function () {
            ipc.send("try-stop");
            this.state = "processing";
        },

        connectMonitor: function () {
            this.error = false;
            if (this.secret === "" || this.key === "") {
                this.validated = true;
            } else {
                this.validated = false;
                this.state = "processing";
                ipc.send("try-connect", this.key, this.secret);
            }

        },

        disconnectMonitor: function () {
            this.state = "disconnected";
        },

        changeMode: function () {
            if (this.mode == "grid") {
                this.mode = "table"
            } else {
                this.mode = "grid"
            }
        },

        openDB: function () {
            this.state = "database"
        },

        closeDB: function () {
            this.state = "connected"
        },

        saveDB: function () {
            let DB = document.getElementById('database');
            let XTENSION = "xls|xlsx|xlsm|xlsb|xml|csv|txt|dif|sylk|slk|prn|ods|fods|htm|html".split("|")
            let wb = XLSX.utils.table_to_book(DB);
            let ts = new Date();
            let o = dialog.showSaveDialog({
                    defaultPath: this.quoteAsset + '-' + ts.toISOString().substr(0, 10) + '.xlsx',
                    title: 'Save file as',
                    filters: [{
                        name: "Spreadsheets",
                        extensions: XTENSION
                    }]
                });
            XLSX.writeFile(wb, o);
            dialog.showMessageBox({ message: "Exported data to " + o, buttons: ["OK"] });
        },

        clearDB: function () {
            this.orders = []
        }

    }
})

ipc.on("trading-pairs", (evt, symbols) => {
    if (symbols && symbols.length > 0) {
        app.pairs = [];
        symbols.forEach(element => {
            app.pairs.push({ symbol: element, price: undefined, changes: undefined })
        });
        app.state = "started";
    } else {
        app.error = true;
        app.errorMessage = "No pairs are found.";
        app.state = "connected";
    }
})

ipc.on("price-changes", (evt, data) => {
    if (data) {
        let index = app.pairs.findIndex(e => e.symbol === data.symbol);
        if (index >= 0) {
            let info = app.pairs[index];
            info.status = data.status;
            info.price = data.price;
            info.avg = data.avg;
            info.min = data.min;
            info.max = data.max;
            info.changes = data.changes;
            info.prec = data.prec;
            info.size = data.size;
            if (info.order && info.order.type == "buy") {
                let p = 10 ** data.prec;
                info.order.hope = Math.round((info.order.buyValue * info.price - info.order.spentQuote) * p) / p;
            }
            app.$set(app.pairs, index, info);
        }
    }
})

ipc.on("asset-isbought", (evt, data) => {
    if (data) {
        let index = app.pairs.findIndex(e => e.symbol === data.symbol);
        if (index >= 0) {
            let info = app.pairs[index];
            let p = 10 ** info.prec;
            let h = Math.round((data.value * data.price - data.spentQuote) * p) / p;
            let ts = new Date();
            let order = {
                bts: ts,
                type: "buy",
                buyValue: data.value,
                buyPrice: data.price,
                baseAsset: data.baseAsset,
                spentQuote: data.spentQuote,
                quoteAsset: data.quoteAsset,
                hope: h
            }
            app.orders.unshift(order);
            info.order = order;
            info.status = data.status;
            app.$set(app.pairs, index, info);
            app.balance = Math.round(data.balance * p) / p;
        }
    }
})

ipc.on("asset-issold", (evt, data) => {
    if (data) {
        let index = app.pairs.findIndex(e => e.symbol === data.symbol);
        if (index >= 0) {
            let ts = new Date();
            let info = app.pairs[index];
            Object.assign(info.order, {
                sts: ts,
                type: "sell",
                soldValue: data.value,
                soldPrice: data.price,
                earnedQuote: data.earnedQuote,
                profit: data.profit
            });
            app.$set(app.pairs, index, info);
            let p = 10 ** info.prec;
            app.balance = Math.round(data.balance * p) / p;
            app.profit = Math.round((app.profit + data.profit) * p) / p;
        }
    }
})

ipc.on("initial-start", (evt) => {
    app.state = "disconnected";
})

ipc.on("connected", (evt, balance, apikey, apisecret, options) => {
    app.binanceBalance = balance;
    app.key = apikey;
    app.secret = apisecret;

    if (options) {
        app.test = options.test;
        app.quoteAsset = options.quoteAsset;
        app.orderSize = options.orderSize;
        app.balance = options.quoteBalance;
        app.requiredDayQuoteVolume = options.requiredDayQuoteVolume;
        app.hidePricesForNumTicks = options.hidePricesForNumTicks;
        app.buyDepth = options.historyDepth[0];
        app.sellDepth = options.historyDepth[1];
        app.buyPercent = options.buySignalOptions.percent;
        app.sellPercent = options.sellSignalOptions.percent;
    }

    app.state = "connected";
})

ipc.on("stopped", evt => {
    app.balance = app.prevBalance;
    app.state = "connected";
})

ipc.on("connection-error", (evt, error, apikey, apisecret) => {
    app.error = true;
    app.errorCode = error.code;
    app.errorMessage = error.msg;
    app.key = apikey;
    app.secret = apisecret;
    app.state = "disconnected";
})