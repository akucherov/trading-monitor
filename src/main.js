const electron = require('electron')
const config = require('./config')

const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipc = electron.ipcMain

let mainWindow

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

})