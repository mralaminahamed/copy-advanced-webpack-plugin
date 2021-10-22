/*!
 * is-extglob <https://github.com/jonschlinkert/is-extglob>
 *
 * Copyright (c) 2014-2016, Jon Schlinkert.
 * Licensed under the MIT License.
 */

export default function isExtGlob(path)
{
    let match;
    if (typeof path !== 'string' || path === '') {
        return false;
    }

    // eslint-disable-next-line no-cond-assign
    while ((match = /(\\).|([@?!+*]\(.*\))/g.exec(path))) {
        if (match[2]) {
            return true;
        }
        // eslint-disable-next-line no-param-reassign
        path = path.slice(match.index + match[0].length);
    }

    return false;
};
