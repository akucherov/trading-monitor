const common = require('./common');
const fs = require('fs');

module.exports = {
    buySignalByChanges: function(symbol, orderSize, buyPrice, sellPrice, buyPrices, sellPrices, gaps) {
        let changes = Math.round((buyPrice / common.avg(buyPrices) - 1) * 10000)/100;
        return changes > 1;
    },

    sellSignalByChanges: function(symbol, orderSize, buyPrice, sellPrice, buyPrices, sellPrices, gaps) {
        let changes = Math.round((sellPrice / common.avg(sellPrices) - 1) * 10000)/100;
        return changes < -0.5;
    },

    buySignalByMedian: function(symbol, orderSize, buyPrice, sellPrice, buyPrices, sellPrices, gaps) {
        let medianGap = common.median(gaps);
        let changes = Math.round((buyPrice / buyPrices[0] - 1) * 10000)/100;
        return changes > 1 && (buyPrice - sellPrice) <= medianGap;
    },

    logParameters(...args) {
        let ts = new Date();
        fs.appendFile(`./${args[0]}-${args[1]}.csv`, `${ts.toISOString()},${args[4].join(',')},${args[5].join(',')}\n`, 'utf8', (error) => {
            if (error) throw error;
        });
        return false;
    }
}