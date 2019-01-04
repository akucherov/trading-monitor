const Store = require('electron-store')
const store = new Store({encryptionKey: "zcBaPspbbE28yWcrC9kX8Czzj48Dwhur"})

const WINDOW_HEIGHT = "window.height"
const WINDOW_WIDTH = "window.width"
const BINANCE_API_SECRET = "binance.api.secret"
const BINANCE_API_KEY = "binance.api.key"

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
            secret: store.get(BINANCE_API_SECRET, ""),
            key: store.get(BINANCE_API_KEY, "")
        }
    },

    setBinanceSettings: function(secret, key) {
        store.set(BINANCE_API_SECRET, secret);
        store.set(BINANCE_API_KEY, key);
    }
}