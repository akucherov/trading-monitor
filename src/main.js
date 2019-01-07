const electron = require('electron')
const config = require('./config')
const common = require('./common/common');
const signals = require('./common/signals');
const Bot = require("./bots/binance-bot");

const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipc = electron.ipcMain

let mainWindow

const bot = new Bot().options({
    BINANCE_API_KEY: process.env.BINANCE_API_KEY,
    BINANCE_API_SECRET: process.env.BINANCE_API_SECRET,
    test: true,
    quoteAsset: "USDT",
    orderSize: 12,
    quoteBalance: 100 ,
    requiredDayQuoteVolume: 1000000,
    hidePricesForNumTicks: 5,
    ignore: [],
    historyDepth: [300, 300, 1],
    buySignal: signals.buySignalByChanges,
    sellSignal: signals.sellSignalByChanges,
    logPricesChanges: true
});

app.on('ready', _ => {
    mainWindow = new BrowserWindow(config.getWindowSize())

    mainWindow.loadURL(`file://${__dirname}/main.html`)

    mainWindow.on('closed', _ => {
        mainWindow = null
    })

    mainWindow.on('resize', _ => {
        let size = mainWindow.getSize();
        config.setWindowSize(size[0], size[1]);
    })

    bot.on("trading-pairs", pairs => {
        mainWindow.webContents.send("trading-pairs", pairs);
    })

    bot.on("price-changes", data => {
        let p = 10**data.prec;
        data.avg = Math.round(common.avg(data.prices)*p)/p;
        data.size = data.prices.length;
        mainWindow.webContents.send("price-changes", data);
    })

    mainWindow.webContents.on('dom-ready', _ => {
        bot.start()
    })
})