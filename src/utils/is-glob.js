/*!
 * is-glob <https://github.com/jonschlinkert/is-glob>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

const isExtGlob = require('./is-extglob');
const chars = {'{': '}', '(': ')', '[': ']'};
const strictRegex = /\\(.)|(^!|\*|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
const relaxedRegex = /\\(.)|(^!|[*?{}()[\]]|\(\?)/;

module.exports = function isGlob(str, options)
{
    if (typeof str !== 'string' || str === '') {
        return false;
    }

    if (isExtGlob(str)) {
        return true;
    }

    let regex = strictRegex;
    let match;

    // optionally relax regex
    if (options && options.strict === false) {
        regex = relaxedRegex;
    }

    while ((match = regex.exec(str))) {
        if (match[2]) {
            return true;
        }
        let idx = match.index + match[0].length;

        // if an open bracket/brace/paren is escaped,
        // set the index to the next closing character
        const open = match[1];
        const close = open ? chars[open] : null;
        if (open && close) {
            const n = str.indexOf(close, idx);
            if (n !== -1) {
                idx = n + 1;
            }
        }

        str = str.slice(idx);
    }
    return false;
};
