'use strict';

const isGlob = require('./is-glob');
const pathPosixDirname = require('path').posix.dirname;
const isWin32 = require('os').platform() === 'win32';

const slash = '/';
const backslash = /\\/g;
const globby = /(^|[^\\])([{[]|\([^)]+$)/;
const escaped = /\\([!*?|[\](){}])/g;

/**
 * @param {string} str
 * @param {Object} opts
 * @param {boolean} [opts.flipBackslashes=true]
 */
module.exports = function globParent(str, opts)
{
    const options = Object.assign({flipBackslashes: true}, opts);

    // flip windows path separators
    if (options.flipBackslashes && isWin32 && str.indexOf(slash) < 0) {
        str = str.replace(backslash, slash);
    }

    // special case for strings ending in enclosure containing path separator
    if (isEnclosure(str)) {
        str += slash;
    }

    // preserves full path in case of trailing path separator
    str += 'a';

    // remove path parts that are globby
    do {
        str = pathPosixDirname(str);
    } while (isGlob(str) || globby.test(str));

    // remove escape chars and return result
    return str.replace(escaped, '$1');
};

function isEnclosure(str)
{
    const lastChar = str.slice(-1);
    let enclosureStart;

    switch (lastChar) {
        case '}':
            enclosureStart = '{';
            break;
        case ']':
            enclosureStart = '[';
            break;
        default:
            return false;
    }

    let foundIndex = str.indexOf(enclosureStart);
    if (foundIndex < 0) {
        return false;
    }

    return str.slice(foundIndex + 1, -1).includes(slash);
}
