const common = require('./common');
const fs = require('fs');

module.exports = {
    buySignalByChanges: function (symbol, orderSize, options, buyPrice, sellPrice, buyPrices, sellPrices, gaps) {
        if (options && options.percent) {
            let changes = Math.round((buyPrice / common.avg(buyPrices) - 1) * 10000) / 100;
            return changes > options.percent;
        } else {
            return false;
        }
    },

    sellSignalByChanges: function (symbol, orderSize, options, buyPrice, sellPrice, buyPrices, sellPrices, gaps) {
        if (options && options.percent) {
            let changes = Math.round((sellPrice / common.avg(sellPrices) - 1) * 10000) / 100;
            return changes < options.percent;
        } else {
            return false;
        }
    },

    buySignalByMedian: function (symbol, orderSize, options, buyPrice, sellPrice, buyPrices, sellPrices, gaps) {
        if (options && options.percent) {
            let medianGap = common.median(gaps);
            let changes = Math.round((buyPrice / buyPrices[0] - 1) * 10000) / 100;
            return changes > options.percent && (buyPrice - sellPrice) <= medianGap;
        } else {
            return false;
        }
    },

    logParameters(...args) {
        let ts = new Date();
        fs.appendFile(`./${args[0]}-${args[1]}.csv`, `${ts.toISOString()},${args[5].join(',')},${args[6].join(',')}\n`, 'utf8', (error) => {
            if (error) throw error;
        });
        return false;
    }
}