/**
 * This file is part of the imboclient-js package
 *
 * (c) Espen Hovlandsdal <espen@hovlandsdal.com>
 *
 * For the full copyright and license information, please view the LICENSE file that was
 * distributed with this source code.
 */
'use strict';

var request = require('request');

module.exports = function(options) {
    // Prepare options
    options.method = options.method.toUpperCase();
    options.uri    = options.uri.toString();

    // Do we have any callback, or is this a fire-and-forgot request?
    var hasCallback = !!options.onComplete;

    // Run the request
    return request(options, hasCallback ? function(err, res, body) {
        if (err) {
            return options.onComplete(err, res, body);
        } else if (res.statusCode >= 400) {
            return options.onComplete(res.statusCode, res, body);
        }

        return options.onComplete(err, res, body);
    } : undefined);
};
