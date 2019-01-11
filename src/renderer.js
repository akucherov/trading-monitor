const electron = require('electron')
const ipc = electron.ipcRenderer

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
        pairs: [],
        test: true,
        quoteAsset: "USDT",
        requiredDayQuoteVolume: 10000000,
        hidePricesForNumTicks: 0,
        buyDepth: 100,
        buyPercent: 1,
        sellDepth: 100,
        sellPercent: 0.5,
        orderSize: 12,
        balance: 100,
        prevBalance: 100,
        binanceBalance: [],
        profit: 0
    },

    computed: {
        getAccBalance: function() {
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
                    buySignalOptions: {percent: this.buyPercent},
                    sellSignalOptions: {percent: this.sellPercent}
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

        connectMonitor: function() {
            this.error = false;
            if (this.secret === "" || this.key === "") {
                this.validated = true;
            } else {
                this.validated = false;
                this.state = "processing";
                ipc.send("try-connect", this.key, this.secret);
            }
            
        },

        disconnectMonitor: function() {
            this.state = "disconnected";
        }
    }
})

ipc.on("trading-pairs", (evt, symbols) => {
    if (symbols && symbols.length > 0) {
        app.pairs = [];
        symbols.forEach(element => {
            app.pairs.push({symbol: element, price: undefined, changes: undefined})       
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
            info.price = data.price;
            info.changes = data.changes;
            info.avg = data.avg;
            info.size = data.size; 
            info.prec = data.prec;
            if (info.order && info.order.type == "buy") {
                let p = 10 ** data.prec;
                info.order.quote = Math.round(info.order.value * info.price * p) / p;
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
            let order = {
                type: "buy",
                value: data.value,
                price: data.price,
                asset: data.baseAsset,
                quote: data.spentQuote
            }
            info.order = order;
            app.$set(app.pairs, index, info);
            let p = 10 ** info.prec;
            app.balance = Math.round(data.balance * p)/p;
        }
    }
})

ipc.on("asset-issold", (evt, data) => {
    if (data) {
        let index = app.pairs.findIndex(e => e.symbol === data.symbol);
        if (index >= 0) {
            let info = app.pairs[index];
            let order = {
                type: "sell",
                value: data.value,
                price: data.price,
                asset: data.quoteAsset,
                profit: data.profit
            }
            info.order = order;
            app.$set(app.pairs, index, info);
            let p = 10 ** info.prec;
            app.balance = Math.round(data.balance * p)/p;
            app.profit = Math.round((app.profit + data.profit) * p)/p;
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