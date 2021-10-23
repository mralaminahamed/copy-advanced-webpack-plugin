import {posix} from 'path';
import {platform} from 'os';

import isGlob from './is-glob';

const pathPosixDirname = posix.dirname;
const isWin32 = platform() === 'win32';

const slash = '/';
const backslash = /\\/g;
const globby = /(^|[^\\])([{[]|\([^)]+$)/;
const escaped = /\\([!*?|[\](){}])/g;

/**
 * @param {string} str
 * @param {Object} opts
 * @param {boolean} [opts.flipBackslashes=true]
 */
export default function globParent(str, opts)
{
    let pathString = '';
    const options = Object.assign({flipBackslashes: true}, opts);

    // flip windows path separators
    if (options.flipBackslashes && isWin32 && str.indexOf(slash) < 0) {
        pathString = str.replace(backslash, slash);
    }

    // special case for strings ending in enclosure containing path separator
    if (isEnclosure(pathString)) {
        pathString += slash;
    }

    // preserves full path in case of trailing path separator
    pathString += 'a';

    // remove path parts that are globby
    do {
        pathString = pathPosixDirname(pathString);
    } while (isGlob(pathString) || globby.test(pathString));

    // remove escape chars and return result
    return pathString.replace(escaped, '$1');
}

function isEnclosure(path)
{
    let enclosureStart;
    const lastChar = path.slice(-1);

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

    const foundIndex = path.indexOf(enclosureStart);
    if (foundIndex < 0) {
        return false;
    }

    return path.slice(foundIndex + 1, -1).includes(slash);
}
