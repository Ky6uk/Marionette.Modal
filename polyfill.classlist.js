/* global DOMTokenList */
(function () {
    var testElement = document.createElement('_');

    testElement.classList.add('c1', 'c2');

    // Polyfill for IE 10/11 and Firefox <26, where classList.add and
    // classList.remove exist but support only one argument at a time.
    if (!testElement.classList.contains('c2')) {
        var createMethod = function (method) {
            var original = DOMTokenList.prototype[method];

            DOMTokenList.prototype[method] = function (token) {
                var i;
                var length = arguments.length;

                for (i = 0; i < length; i++) {
                    token = arguments[i];
                    original.call(this, token);
                }
            };
        };

        createMethod('add');
        createMethod('remove');
    }

    testElement.classList.toggle('c3', false);

    // Polyfill for IE 10 and Firefox <24, where classList.toggle does not
    // support the second argument.
    if (testElement.classList.contains('c3')) {
        var originalToggle = DOMTokenList.prototype.toggle;

        DOMTokenList.prototype.toggle = function (token, force) {
            /* jshint -W018 */
            if (1 in arguments && !this.contains(token) === !force) {
                return force;
            }
            else {
                return originalToggle.call(this, token);
            }
        };
    }

    testElement = null;
}());