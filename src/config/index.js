const Store = require('electron-store')
const store = new Store({encryptionKey: "zcBaPspbbE28yWcrC9kX8Czzj48Dwhur"})

const WINDOW_HEIGHT = "window.height"
const WINDOW_WIDTH = "window.width"
const BINANCE_API_SECRET = "binance.api.secret"
const BINANCE_API_KEY = "binance.api.key"
const OPTIONS = "options"

const defaultOpt = {
    test: true,
    quoteAsset: "USDT",
    orderSize: 20,
    quoteBalance: 100, 
    requiredDayQuoteVolume: 1000000,
    hidePricesForNumTicks: 0,
    ignore: [],
    historyDepth: [300, 300, 1],
    logPricesChanges: true,
    buySignalOptions: {percent: 1},
    sellSignalOptions: {percent: 0.5}
}

module.exports = {
    getWindowSize: function() {
        return {
            height: store.get(WINDOW_HEIGHT, 768),
            width: store.get(WINDOW_WIDTH, 1024)
        }
    },

    setWindowSize: function(width, height) {
        store.set(WINDOW_WIDTH, width);
        store.set(WINDOW_HEIGHT, height);
    },

    getBinanceSettings: function() {
        return {
            apisecret: store.get(BINANCE_API_SECRET, ""),
            apikey: store.get(BINANCE_API_KEY, "")
        }
    },

    setBinanceSettings: function(apikey, apisecret) {
        store.set(BINANCE_API_KEY, apikey);
        store.set(BINANCE_API_SECRET, apisecret);
    },

    getOptions: function() {        
        return store.get(OPTIONS, defaultOpt);
    },

    setOptions: function(opt) {
        store.set(OPTIONS, opt)
    }
}