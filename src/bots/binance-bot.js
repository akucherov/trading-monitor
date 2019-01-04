let bot = function Bot() {
    let Bot = this;
    
    const util = require('util');
    const file = require('fs');
    const Binance = require('node-binance-api');
    const common = require('../common/common');
    const statuses = {PENDING: 0, WAIT_BUY_SIGNAL: 1, WAIT_SELL_SIGNAL: 2};
    const default_options = {
        test: true,
        ignore: [],
        orderSize: 1,
        historyDepth: [10, 10, 10],
        hidePricesForNumTicks: 10,
        logPricesChanges: true,
        log: function (...args) {
            Array.prototype.slice.call(args).forEach(e => console.log(e));
        },
        buySignal: function() {return false},
        sellSignal: function() {return false}
    };

    Bot.binance = undefined;
    Bot.exchangeInfo = undefined;
    Bot.prevDay = undefined;
    Bot.buyPriceMaxChanges = undefined;
    Bot.marketSell = undefined;
    Bot.marketBuy = undefined;
    Bot.options = default_options;
    Bot.tradingPairs = new Array();

    const monitor = function(symbol, depth) {

        //Parameters for signals
        let asksOrders = Bot.binance.array(Bot.binance.sortAsks(depth.asks));
        let bidsOrders = Bot.binance.array(Bot.binance.sortBids(depth.bids));
        let buyPrice = common.round(
            common.avgPriceByQV(Bot.options.orderSize, asksOrders), 
            Bot.tradingPairs[symbol].quotePrecision);
        let sellPrice = common.round(
            common.avgPriceByQV(Bot.options.orderSize, bidsOrders),
            Bot.tradingPairs[symbol].quotePrecision);
        let gap = buyPrice - sellPrice;
        
        if (Bot.tradingPairs[symbol].buyPrices.push(buyPrice) > Bot.options.historyDepth[0]) 
            Bot.tradingPairs[symbol].buyPrices.shift();
        if (Bot.tradingPairs[symbol].sellPrices.push(sellPrice) > Bot.options.historyDepth[1]) 
            Bot.tradingPairs[symbol].sellPrices.shift();
        if (Bot.tradingPairs[symbol].gaps.push(gap) > Bot.options.historyDepth[2]) 
            Bot.tradingPairs[symbol].gaps.shift();
        
        //Show price changes
        if (Bot.options.logPricesChanges) {
            if (Bot.tradingPairs[symbol].counter) {
                Bot.tradingPairs[symbol].counter -= 1;
            } else {
                Bot.tradingPairs[symbol].counter = Bot.options.hidePricesForNumTicks;
                if (Bot.tradingPairs[symbol].status == statuses.WAIT_BUY_SIGNAL) {
                    let changes = Math.round((buyPrice / Bot.tradingPairs[symbol].buyPrices[0] - 1) * 10000) / 100;
                    Bot.options.log(`${symbol}: ${buyPrice} ${changes}%`);
                } else if (Bot.tradingPairs[symbol].status == statuses.WAIT_SELL_SIGNAL) {
                    let changes = Math.round((sellPrice / Bot.tradingPairs[symbol].sellPrices[0] - 1) * 10000) / 100;
                    Bot.options.log(`${symbol}: ${sellPrice} ${changes}%`);
                }
            }
        }

        // Signals
        if (Bot.tradingPairs[symbol].buyPrices.length == Bot.options.historyDepth[0] &&
            Bot.tradingPairs[symbol].sellPrices.length == Bot.options.historyDepth[1] &&
            Bot.tradingPairs[symbol].gaps.length == Bot.options.historyDepth[2]) {

            if (Bot.tradingPairs[symbol].status == statuses.WAIT_BUY_SIGNAL
                && Bot.options.buySignal(
                    symbol,
                    Bot.options.orderSize,
                    buyPrice,
                    sellPrice,
                    Bot.tradingPairs[symbol].buyPrices,
                    Bot.tradingPairs[symbol].sellPrices,
                    Bot.tradingPairs[symbol].gaps))
                process.nextTick(() => buy(symbol, buyPrice).catch(Bot.options.log));

            if (Bot.tradingPairs[symbol].status == statuses.WAIT_SELL_SIGNAL
                && Bot.options.sellSignal(
                    symbol,
                    Bot.options.orderSize,
                    buyPrice,
                    sellPrice,
                    Bot.tradingPairs[symbol].buyPrices,
                    Bot.tradingPairs[symbol].sellPrices,
                    Bot.tradingPairs[symbol].gaps))
                process.nextTick(() => sell(symbol, sellPrice).catch(Bot.options.log));
        }
    };

    const buy = async function (symbol, price) {
        try {
            Bot.tradingPairs[symbol].status = statuses.PENDING;
            Bot.options.log(`Buy signal has been recieved for ${symbol}`);
            let value = common.valueByQuote(
                Bot.options.orderSize,
                price,
                Bot.tradingPairs[symbol].stepSize,
                Bot.tradingPairs[symbol].quotePrecision);
            Bot.options.log(`Try to buy ${value} ${Bot.tradingPairs[symbol].baseAsset}`);
            let response = await Bot.marketBuy(symbol, value);
            if (response.status == "FILLED") {
                value = common.valueByFills(response.fills);
                Bot.tradingPairs[symbol].spentQuote = response.cummulativeQuoteQty;
                Bot.options.quoteBalance -= response.cummulativeQuoteQty;
                Bot.tradingPairs[symbol].boughtPrice = common.round(
                    response.cummulativeQuoteQty / response.executedQty,
                    Bot.tradingPairs[symbol].quotePrecision)
            } else {
                Bot.tradingPairs[symbol].spentQuote = Bot.options.orderSize;
                Bot.options.quoteBalance -= Bot.options.orderSize;
                Bot.tradingPairs[symbol].boughtPrice = price;
            }
            Bot.tradingPairs[symbol].boughtValue = value;
            Bot.tradingPairs[symbol].status = statuses.WAIT_SELL_SIGNAL;
            Bot.options.log(`${value} ${Bot.tradingPairs[symbol].baseAsset} has been bought for ${Bot.tradingPairs[symbol].boughtPrice} ${Bot.options.quoteAsset}`);
            Bot.options.log(`${Bot.tradingPairs[symbol].spentQuote} ${Bot.options.quoteAsset} were spent`)
        } catch (e) {
            console.log(e.body);
            Bot.tradingPairs[symbol].status = statuses.WAIT_BUY_SIGNAL;
        }
        
    };

    const sell = async function (symbol, price) {
        try {
            Bot.tradingPairs[symbol].status = statuses.PENDING;
            Bot.options.log(`Sell signal has been recieved for ${symbol}`);
            let s = Bot.tradingPairs[symbol].stepSize;
            let p = 10 ** Bot.tradingPairs[symbol].baseAssetPrecision;
            let value = Math.round(Math.round(Bot.tradingPairs[symbol].boughtValue / s) * s * p) / p;
            let response = await Bot.marketSell(symbol, value);
            let sellPrice = price;
            let earnedQuote = 0;
            if (response.status == "FILLED") {
                earnedQuote = response.cummulativeQuoteQty - common.commisionByFills(response.fills);
                Bot.options.quoteBalance += earnedQuote;
                sellPrice = common.round(
                    response.cummulativeQuoteQty / response.executedQty,
                    Bot.tradingPairs[symbol].quotePrecision)
            } else {
                earnedQuote = common.round(value * price, Bot.tradingPairs[symbol].quotePrecision);
                Bot.options.quoteBalance += earnedQuote;
            }
            Bot.tradingPairs[symbol].boughtQuantity = 0;
            Bot.tradingPairs[symbol].boughtPrice = 0;
            Bot.tradingPairs[symbol].status = statuses.WAIT_BUY_SIGNAL;
            Bot.options.log(`${value} ${Bot.tradingPairs[symbol].baseAsset} has been sold for ${sellPrice} ${Bot.options.quoteAsset}`);
            Bot.options.log(`${earnedQuote} ${Bot.options.quoteAsset} were earned`);
            let profit = common.round(
                earnedQuote - Bot.tradingPairs[symbol].spentQuote,
                Bot.tradingPairs[symbol].quotePrecision);
            Bot.options.log(`Your profit is ${profit} ${Bot.options.quoteAsset}`);
        } catch (e) {
            console.log(e.body);
            Bot.tradingPairs[symbol].status = statuses.WAIT_SELL_SIGNAL;
        }
        
    };

    return {
        options: function (opt) {
            if (typeof opt === 'string') { // Pass json config filename
                Bot.options = JSON.parse(file.readFileSync(opt));
            } else Bot.options = opt;

            if (typeof Bot.options.log === 'undefined') Bot.options.log = default_options.log;
            if (typeof Bot.options.buySignal === 'undefined') Bot.options.buySignal = default_options.buySignal;
            if (typeof Bot.options.sellSignal === 'undefined') Bot.options.sellSignal = default_options.sellSignal;
            if (typeof Bot.options.test === 'undefined') Bot.options.test = default_options.test;
            if (typeof Bot.options.ignore === 'undefined') Bot.options.ignore = default_options.ignore;
            if (typeof Bot.options.orderSize === 'undefined') Bot.options.orderSize = default_options.orderSize;
            if (typeof Bot.options.historyDepth === 'undefined') Bot.options.historyDepth = default_options.historyDepth;
            if (typeof Bot.options.hidePricesForNumTicks === 'undefined') Bot.options.hidePricesForNumTicks = default_options.hidePricesForNumTicks;
            if (typeof Bot.options.logPricesChanges === 'undefined') Bot.options.logPricesChanges = default_options.logPricesChanges;

            if (!Bot.binance) {
                Bot.binance = new Binance().options({
                    APIKEY: Bot.options.BINANCE_API_KEY,
                    APISECRET: Bot.options.BINANCE_API_SECRET,
                    useServerTime: true, 
                    test: Bot.options.test, 
                    reconnect: true
                });

                Bot.exchangeInfo = util.promisify(Bot.binance.exchangeInfo);
                Bot.prevDay = util.promisify(Bot.binance.prevDay);
                Bot.marketSell = util.promisify(Bot.binance.marketSell);
                Bot.marketBuy = util.promisify(Bot.binance.marketBuy);
            }

            return this;
        },

        start: async function () {
            if (Bot.options.quoteAsset) {
                Bot.options.log(`Bot is started with ${Bot.options.quoteAsset} as a quote asset`);

                let info = await Bot.exchangeInfo();
                let ticker24h = await Bot.prevDay("");
                let symbols = info.symbols
                .filter(p => p.quoteAsset == Bot.options.quoteAsset && p.status == "TRADING")
                .map(p => {
                    return {
                        symbol: p.symbol,
                        baseAsset: p.baseAsset,
                        baseAssetPrecision: p.baseAssetPrecision,
                        quotePrecision: p.quotePrecision,
                        stepSize: p.filters.filter(t => t.filterType == "LOT_SIZE")[0].stepSize,
                        buyPrices: [],
                        sellPrices: [],
                        gaps: [],
                        status: statuses.WAIT_BUY_SIGNAL,
                        counter: Bot.options.hidePricesForNumTicks,
                        boughtValue: 0,
                        boughtPrice: 0,
                        spentQuote: 0
                    }
                })
                .filter(p => ticker24h.filter(t => t.symbol == p.symbol && t.quoteVolume > Bot.options.requiredDayQuoteVolume).length > 0)
                .filter(p => Bot.options.ignore.filter(s => s == p.baseAsset).length == 0);

                symbols.forEach(s => {
                    Bot.tradingPairs[s.symbol] = s; 
                });

                Bot.options.log("Trading pairs:", symbols.map(p => p.symbol));

                Bot.binance.websockets.depthCache(symbols.map(p => p.symbol), monitor);
            }
        }

    }
}

module.exports = bot;
