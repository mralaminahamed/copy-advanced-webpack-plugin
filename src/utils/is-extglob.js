/*!
 * is-extglob <https://github.com/jonschlinkert/is-extglob>
 *
 * Copyright (c) 2014-2016, Jon Schlinkert.
 * Licensed under the MIT License.
 */

module.exports = function isExtGlob(str)
{
    if (typeof str !== 'string' || str === '') {
        return false;
    }

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = /(\\).|([@?!+*]\(.*\))/g.exec(str))) {
        if (match[2]) {
            return true;
        }
        // eslint-disable-next-line no-param-reassign
        str = str.slice(match.index + match[0].length);
    }

    return false;
};
