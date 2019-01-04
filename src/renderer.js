const electron = require('electron')
const ipc = electron.ipcRenderer

const Vue = require('./vendors/vue.js');

let app = new Vue({
    el: '#app',
    data: {
    }
})