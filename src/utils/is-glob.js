/*!
 * is-glob <https://github.com/jonschlinkert/is-glob>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

import isExtGlob from './is-ext-glob';

const chars = {'{': '}', '(': ')', '[': ']'};
const strictRegex = /\\(.)|(^!|\*|[\].+)]\?|\[[^\\\]]+\]|\{[^\\}]+\}|\(\?[:!=][^\\)]+\)|\([^|]+\|[^\\)]+\))/;
const relaxedRegex = /\\(.)|(^!|[*?{}()[\]]|\(\?)/;

export default function isGlob(path, options)
{
    if (typeof path !== 'string' || path === '') {
        return false;
    }

    if (isExtGlob(path)) {
        return true;
    }

    let regex = strictRegex;
    let match;

    // optionally relax regex
    if (options && options.strict === false) {
        regex = relaxedRegex;
    }

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(path))) {
        if (match[2]) {
            return true;
        }
        let idx = match.index + match[0].length;

        // if an open bracket/brace/paren is escaped,
        // set the index to the next closing character
        // eslint-disable-next-line prefer-destructuring
        const open = match[1];
        const close = open ? chars[open] : null;
        if (open && close) {
            const n = path.indexOf(close, idx);
            if (n !== -1) {
                idx = n + 1;
            }
        }

        // eslint-disable-next-line no-param-reassign
        path = path.slice(idx);
    }
    return false;
};
