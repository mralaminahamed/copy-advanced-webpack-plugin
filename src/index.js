import path from "path";

import fastGlob from "fast-glob";
import { validate } from "schema-utils";

import normalizePath from "./utils/normalize-path";
import { globby } from "./utils/globby/main";
import schema from "./options.json";
import globParent from "./utils/glob-parent";
import { readFile, stat } from "./utils/promisify";

// Internal variables
const template = /\[\\*([\w:]+)\\*\]/i;

const isCopied = [];

export default class CopyAdvancedPlugin {
    // Any options should be passed in the constructor of your plugin,
    // (this is a public API of your plugin).
    constructor(options = []) {
        validate(schema, options, {
            name: "Copy Advanced Plugin",
            baseDataPath: "options",
        });

        this.patterns = options.patterns;
        // this.options = options.options || {};
        // Applying user-specified options over the default options
        // and making merged options further available to the plugin methods.
        // You should probably validate all the options here as well.
        this.options = options || {};
    }

    static getContentHash(compiler, compilation, source) {
        const { outputOptions } = compilation;
        const { hashDigest, hashDigestLength, hashFunction, hashSalt } =
            outputOptions;
        const hash = compiler.webpack.util.createHash(hashFunction);

        if (hashSalt) {
            hash.update(hashSalt);
        }

        hash.update(source);

        const fullContentHash = hash.digest(hashDigest);

        return fullContentHash.slice(0, hashDigestLength);
    }

    static async run(
        compiler,
        compilation,
        inputPattern,
        fileBase,
        assetEmitted
    ) {
        if (!isCopied.includes(inputPattern)) {
            isCopied.push(inputPattern);
            console.log(fileBase);
            console.log(assetEmitted);
            const { RawSource } = compiler.webpack.sources;
            // destruct source destination from input pattern
            const pattern =
                typeof inputPattern === "string"
                    ? { from: inputPattern }
                    : { ...inputPattern };

            pattern.fromOrigin = pattern.from;
            pattern.from = path.normalize(pattern.from);
            pattern.context =
                typeof pattern.context === "undefined"
                    ? compiler.context
                    : path.isAbsolute(pattern.context)
                    ? pattern.context
                    : path.join(compiler.context, pattern.context);
            if (path.isAbsolute(pattern.from)) {
                pattern.absoluteFrom = pattern.from;
            } else {
                pattern.absoluteFrom = path.resolve(
                    pattern.context,
                    pattern.from
                );
            }

            const { inputFileSystem } = compiler;
            let stats;
            let paths;

            try {
                stats = await stat(inputFileSystem, pattern.absoluteFrom);
            } catch (error) {
                // Nothing
            }

            if (stats) {
                if (stats.isDirectory()) {
                    pattern.fromType = "dir";
                } else if (stats.isFile()) {
                    pattern.fromType = "file";
                } else {
                    pattern.fromType = "glob";
                }
            }

            // eslint-disable-next-line no-param-reassign
            pattern.globOptions = {
                ...{ followSymbolicLinks: true },
                ...(pattern.globOptions || {}),
                ...{ cwd: pattern.context, objectMode: true },
            };
            pattern.globOptions.fs = inputFileSystem;

            switch (pattern.fromType) {
                case "dir":
                    /* eslint-disable no-param-reassign */
                    pattern.context = pattern.absoluteFrom;
                    pattern.glob = path.posix.join(
                        fastGlob.escapePath(
                            normalizePath(path.resolve(pattern.absoluteFrom))
                        ),
                        "**/*"
                    );
                    pattern.absoluteFrom = path.join(
                        pattern.absoluteFrom,
                        "**/*"
                    );

                    if (typeof pattern.globOptions.dot === "undefined") {
                        pattern.globOptions.dot = true;
                    }
                    /* eslint-enable no-param-reassign */
                    break;
                case "file":
                    /* eslint-disable no-param-reassign */
                    pattern.context = path.dirname(pattern.absoluteFrom);
                    pattern.glob = fastGlob.escapePath(
                        normalizePath(path.resolve(pattern.absoluteFrom))
                    );

                    if (typeof pattern.globOptions.dot === "undefined") {
                        pattern.globOptions.dot = true;
                    }
                    /* eslint-enable no-param-reassign */
                    break;
                default: {
                    /* eslint-disable no-param-reassign */
                    pattern.fromType = "glob";
                    pattern.glob = path.isAbsolute(pattern.fromOrigin)
                        ? pattern.fromOrigin
                        : path.posix.join(
                              fastGlob.escapePath(
                                  normalizePath(path.resolve(pattern.context))
                              ),
                              pattern.fromOrigin
                          );
                    /* eslint-enable no-param-reassign */
                }
            }

            try {
                // console.log(data);
                paths = await globby(pattern.glob, pattern.globOptions);
            } catch (error) {
                return;
            }

            const filteredPaths = (
                await Promise.all(
                    paths.map(async (item) => {
                        // Exclude directories
                        if (!item.dirent.isFile()) {
                            return false;
                        }

                        if (pattern.filter) {
                            let isFiltered;

                            try {
                                isFiltered = await pattern.filter(item.path);
                            } catch (error) {
                                return false;
                            }

                            return isFiltered ? item : false;
                        }

                        return item;
                    })
                )
            ).filter((item) => item);

            if (filteredPaths.length === 0) {
                if (pattern.noErrorOnMissing) {
                    return;
                }
                return;
            }
            const files = await Promise.all(
                filteredPaths.map(async (item) => {
                    const from = item.path;

                    // `globby`/`fast-glob` return the relative path when the path contains special characters on windows
                    const absoluteFilename = path.resolve(
                        pattern.context,
                        from
                    );

                    pattern.to =
                        typeof pattern.to === "function"
                            ? await pattern.to({
                                  context: pattern.context,
                                  absoluteFilename,
                              })
                            : path.normalize(
                                  typeof pattern.to !== "undefined"
                                      ? pattern.to
                                      : ""
                              );

                    const isToDirectory =
                        path.extname(pattern.to) === "" ||
                        pattern.to.slice(-1) === path.sep;

                    const toType = pattern.toType
                        ? pattern.toType
                        : template.test(pattern.to)
                        ? "template"
                        : isToDirectory
                        ? "dir"
                        : "file";

                    const relativeFrom = path.relative(
                        pattern.context,
                        absoluteFilename
                    );
                    let filename =
                        toType === "dir"
                            ? path.join(pattern.to, relativeFrom)
                            : pattern.to;

                    if (path.isAbsolute(filename)) {
                        filename = path.relative(
                            compiler.options.output.path,
                            filename
                        );
                    }

                    const sourceFilename = normalizePath(
                        path.relative(compiler.context, absoluteFilename)
                    );

                    return {
                        absoluteFilename,
                        sourceFilename,
                        filename,
                        toType,
                    };
                })
            );

            let assets;

            try {
                assets = await Promise.all(
                    files.map(async (file) => {
                        const { absoluteFilename, sourceFilename, filename } =
                            file;
                        const info =
                            typeof pattern.info === "function"
                                ? pattern.info(file) || {}
                                : pattern.info || {};
                        const result = {
                            absoluteFilename,
                            sourceFilename,
                            filename,
                            force: pattern.force,
                            info,
                        };

                        if (!result.source) {
                            let data;

                            try {
                                data = await readFile(
                                    inputFileSystem,
                                    absoluteFilename
                                );
                            } catch (error) {
                                return;
                            }

                            result.source = new RawSource(data);
                        }

                        if (pattern.transform) {
                            const transform =
                                typeof pattern.transform === "function"
                                    ? { transformer: pattern.transform }
                                    : pattern.transform;

                            if (transform.transformer) {
                                const buffer = result.source.buffer();

                                if (transform.cache) {
                                    if (!result.source) {
                                        const transformed =
                                            await transform.transformer(
                                                buffer,
                                                absoluteFilename
                                            );

                                        result.source = new RawSource(
                                            transformed
                                        );
                                    }
                                } else {
                                    result.source = new RawSource(
                                        await transform.transformer(
                                            buffer,
                                            absoluteFilename
                                        )
                                    );
                                }
                            }
                        }

                        // eslint-disable-next-line consistent-return
                        return result;
                    })
                );
            } catch (error) {
                return;
            }

            // eslint-disable-next-line consistent-return
            return assets;
        }
    }

    apply(compiler) {
        const pluginName = this.constructor.name;
        const { compilation } = compiler;

        compiler.hooks.assetEmitted.tap(
            pluginName,
            async (file, assetEmitted) => {
                await Promise.all(
                    this.patterns.map(async (item) => {
                        try {
                            await CopyAdvancedPlugin.run(
                                compiler,
                                compilation,
                                item,
                                file,
                                assetEmitted
                            );
                        } catch (error) {
                            // compilation.errors.push(error);
                            console.log(error);
                        }
                    })
                );
            }
        );
    }
}
