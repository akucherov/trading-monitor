const electron = require('electron')
const config = require('./config')
const common = require('./common/common');
const signals = require('./common/signals');
const Bot = require("./bots/binance-bot");

const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipc = electron.ipcMain

let mainWindow

const bot = new Bot().options({ quoteAsset: "USDT" });

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
        let p = 10 ** data.prec;
        data.avg = Math.round(common.avg(data.prices) * p) / p;
        data.size = data.prices.length;
        mainWindow.webContents.send("price-changes", data);
    })

    bot.on("asset-isbought", data => {
        mainWindow.webContents.send("asset-isbought", data);
    })

    bot.on("asset-issold", data => {
        mainWindow.webContents.send("asset-issold", data);
    })

    mainWindow.webContents.on('dom-ready', _ => {
        let binance = config.getBinanceSettings();
        let options = config.getOptions();

        if (binance.apikey === "" && binance.apisecret === "") {
            mainWindow.webContents.send("initial-start", options);
        } else {
            bot.connect(binance.apikey, binance.apisecret);
            bot.balance()
                .then(b => {
                    mainWindow.webContents.send("connected", b, binance.apikey, binance.apisecret, options);
                })
                .catch(e => {
                    console.log(e);
                    mainWindow.webContents.send("connection-error", JSON.parse(e.body), binance.apikey, binance.apisecret);
                })
        }
    })
})

app.on('window-all-closed', () => {
    app.quit()
})

ipc.on("try-connect", (evt, apikey, apisecret) => {
    bot.connect(apikey, apisecret);
    bot.balance()
        .then(b => {
            config.setBinanceSettings(apikey, apisecret);
            mainWindow.webContents.send("connected", b, apikey, apisecret);
        })
        .catch(e => {
            console.log(e);
            mainWindow.webContents.send("connection-error", JSON.parse(e.body), apikey, apisecret);
        })
})

ipc.on("try-start", (evt, options) => {
    bot.start(Object.assign(options, 
        {
            buySignal: signals.buySignalByChanges,
            sellSignal: signals.sellSignalByChanges
        }));
        
    config.setOptions(options);
})

ipc.on("try-stop", _ => {
    bot.stop();
    mainWindow.webContents.send("stopped");
})