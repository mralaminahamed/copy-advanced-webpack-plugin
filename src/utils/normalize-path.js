/*!
 * normalize-path <https://github.com/jonschlinkert/normalize-path>
 *
 * Copyright (c) 2014-2018, Jon Schlinkert.
 * Released under the MIT License.
 */

module.exports = (path, stripTrailing) => {
    if (typeof path !== "string") {
        throw new TypeError("expected path to be a string");
    }

    if (path === "\\" || path === "/") return "/";

    const len = path.length;
    if (len <= 1) return path;

    // ensure that win32 namespaces has two leading slashes, so that the path is
    // handled properly by the win32 version of path.parse() after being normalized
    // https://msdn.microsoft.com/library/windows/desktop/aa365247(v=vs.85).aspx#namespaces
    let prefix = "";
    if (len > 4 && path[3] === "\\") {
        // eslint-disable-next-line prefer-destructuring
        const ch = path[2];
        if ((ch === "?" || ch === ".") && path.slice(0, 2) === "\\\\") {
            // eslint-disable-next-line no-param-reassign
            path = path.slice(2);
            prefix = "//";
        }
    }

    const segs = path.split(/[/\\]+/);
    if (stripTrailing !== false && segs[segs.length - 1] === "") {
        segs.pop();
    }
    return prefix + segs.join("/");
};
