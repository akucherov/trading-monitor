function avgPriceByQVReducer(r, o) {
    if (r[0] <= 0) return r;
    let qv = o[0]*o[1];
    if (r[0] >= qv) return [r[0]-qv, r[1]+o[1]]
    else return [0, r[1]+r[0]/o[0]]
}

function avgPriceByVReducer(r, o) {
    if (r[0] <= 0) return r;
    if (r[0] >= o[1]) return [r[0]-o[1], r[1]+o[0]*o[1]]
    else return [0, r[1]+r[0]*o[0]]
}

function fillsValueReducer(v, o) {
    return v + (o.qty - o.commission);
}

function fillsCommissionReducer(v, o) {
    return v + o.commission;
}

module.exports = {
    avg: function (list) {
        return list.reduce((a,p)=>a+p,0)/list.length;
    },

    median: function median(list) {
        if (list && list.length > 0) {
            list.sort((a,b) => a - b);
            let half = Math.floor(list.length / 2);
            if (list.length % 2) return list[half]
            else return (list[half - 1] + list[half]) / 2.0;
        } else return 0;
    },

    round: function (value, precicion) {
        let p = 10**precicion;
        return Math.round(value*p)/p;
    },

    max: function(list) {
        if (list && list.length > 0)
            return list.reduce((a,b) => Math.max(a,b), list[0])
        else
            return 0;
    },

    min: function(list) {
        if (list && list.length > 0)
            return list.reduce((a,b) => Math.min(a,b), list[0])
        else 
            return 0;
    },

    zip: function(l1,l2,fun) {
        let result = new Array();
        for (let i = 0;  i < l1.length || i < l2.length; i++) {
            result.push(fun(l1[i],l2[i]));
        }
        return result;
    },
       
    avgPriceByQV: function (quoteValue, orders) {
        r = orders.reduce(avgPriceByQVReducer, [quoteValue,0]);
        return quoteValue/r[1];
    },       
    
    avgPriceByV: function (value, orders) {
        r = orders.reduce(avgPriceByVReducer, [value,0]);
        return r[1]/value;
    },
    
    valueByQuote: function (quote, price, stepSize, quotePrecision) {
        let p = 10**quotePrecision;
        return Math.round(Math.round((quote/price)/stepSize)*stepSize*p)/p;
    },
    
    quoteByValue: function (symbol, value, price, stepSize, baseAssetPrecision) {
        let p = 10**baseAssetPrecision;
        return Math.round(Math.round(value/stepSize)*stepSize*price*p)/p;
    },
    
    valueByFills: function (fills) {
        return fills.reduce(fillsValueReducer, 0);
    },
    
    commisionByFills: function (fills) {
        return fills.reduce(fillsCommissionReducer, 0);
    }
}
