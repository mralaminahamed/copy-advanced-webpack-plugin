//external dependencies
const path = require("path");
const {validate} = require('schema-utils');
const normalizePath = require('normalize-path');
const fastGlob = require('fast-glob');

//internal dependencies
const schema = require('./options.json');
const {stat, readFile} = require("./utils/promisify");
const {version} = require("../package.json");
const globParent = require('./utils/glob-parent');
const serialize = require('./utils/serialize-javascript');
const Limit = require('./utils/limit')
const globby = require("globby");
const crypto = require("crypto");

//Internal variables
const template = /\[\\*([\w:]+)\\*\]/i;



class CopyAdvancedPlugin {
    static defaultOptions = {
        outputFile: 'assets.md',
    };
    // Any options should be passed in the constructor of your plugin,
    // (this is a public API of your plugin).
    constructor(options = []) {
        validate(schema, options, {
            name: "Copy Advanced Plugin",
            baseDataPath: "options",
        });


        this.patterns = options.patterns;
        //this.options = options.options || {};
        // Applying user-specified options over the default options
        // and making merged options further available to the plugin methods.
        // You should probably validate all the options here as well.
        this.options = {...CopyAdvancedPlugin.defaultOptions, ...options};
    }

    static async createSnapshot(compilation, startTime, dependency) {
        // eslint-disable-next-line consistent-return
        return new Promise((resolve, reject) => {
            compilation.fileSystemInfo.createSnapshot(
                startTime,
                [dependency],
                // eslint-disable-next-line no-undefined
                undefined,
                // eslint-disable-next-line no-undefined
                undefined,
                null,
                (error, snapshot) => {
                    if (error) {
                        reject(error);

                        return;
                    }

                    resolve(snapshot);
                }
            );
        });
    }

    static async checkSnapshotValid(compilation, snapshot) {
        // eslint-disable-next-line consistent-return
        return new Promise((resolve, reject) => {
            compilation.fileSystemInfo.checkSnapshotValid(
                snapshot,
                (error, isValid) => {
                    if (error) {
                        reject(error);

                        return;
                    }

                    resolve(isValid);
                }
            );
        });
    }

    static getContentHash(compiler, compilation, source) {
        const {outputOptions} = compilation;
        const {hashDigest, hashDigestLength, hashFunction, hashSalt} =
            outputOptions;
        const hash = compiler.webpack.util.createHash(hashFunction);

        if (hashSalt) {
            hash.update(hashSalt);
        }

        hash.update(source);

        const fullContentHash = hash.digest(hashDigest);

        return fullContentHash.slice(0, hashDigestLength);
    }


    static async runPattern(
        compiler,
        compilation,
        logger,
        cache,
        inputPattern,
        index
    ) {
        // RawSource is one of the "sources" classes that should be used
        // to represent asset sources in compilation.
        const {RawSource} = compiler.webpack.sources;
        console.log(RawSource)
        console.log(inputPattern)
        console.log(typeof inputPattern)

        // Validate type of inputPattern (individual pattern object)
        const pattern = typeof inputPattern === "string" ? {from: inputPattern} : {...inputPattern};
        pattern.fromOrigin = pattern.from;
        pattern.from = path.normalize(pattern.from);

        console.log(pattern.from)

        pattern.context = typeof pattern.context === "undefined" ? compiler.context : path.isAbsolute(pattern.context) ? pattern.context : path.join(compiler.context, pattern.context);

        console.log(pattern.context)

        logger.log(
            `Starting to process a pattern from '${pattern.from}' using '${pattern.context}' context`
        );

        pattern.absoluteFrom = path.isAbsolute(pattern.from) ? pattern.from : path.resolve(pattern.context, pattern.from);

        logger.debug(
            `Getting stats for '${pattern.absoluteFrom}'...`
        );

        console.log(pattern.absoluteFrom)


        const {inputFileSystem} = compiler;

        //console.log(inputFileSystem)


        let stats;

        try {
            stats = await stat(inputFileSystem, pattern.absoluteFrom);
        } catch (error) {
            // Nothing
        }

        console.log(stats)


        if (typeof stats === 'object') {
            if (stats.isDirectory()) {
                pattern.fromType = "dir";
                logger.debug(`Determined '${pattern.absoluteFrom}' is a directory`);
            } else if (stats.isFile()) {
                pattern.fromType = "file";
                logger.debug(`Determined '${pattern.absoluteFrom}' is a file`);
            } else {
                logger.debug(`Determined '${pattern.absoluteFrom}' is a glob`);
            }
        }


        pattern.globOptions = {
            ...{followSymbolicLinks: true},
            ...(pattern.globOptions || {}),
            ...{cwd: pattern.context, objectMode: true},
        };

        pattern.globOptions.fs = inputFileSystem;


        console.log(pattern.fromType)



        //we should do something here

        switch (pattern.fromType) {
            case "dir":
                compilation.contextDependencies.add(pattern.absoluteFrom);
                logger.debug(`Added '${pattern.absoluteFrom}' as a context dependency`);
                pattern.context = pattern.absoluteFrom;
                pattern.glob = path.posix.join(
                    fastGlob.escapePath(
                        normalizePath(path.resolve(pattern.absoluteFrom))
                    ),
                    "**/*"
                );
                pattern.absoluteFrom = path.join(pattern.absoluteFrom, "**/*");

                if (typeof pattern.globOptions.dot === "undefined") {
                    pattern.globOptions.dot = true;
                }
                break;

            case "file":
                compilation.fileDependencies.add(pattern.absoluteFrom);

                logger.debug(`Added '${pattern.absoluteFrom}' as a file dependency`);

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
                const contextDependencies = path.normalize(
                    globParent(pattern.absoluteFrom)
                );

                compilation.contextDependencies.add(contextDependencies);

                logger.debug(`added '${contextDependencies}' as a context dependency`);

                /* eslint-disable no-param-reassign */
                pattern.fromType = "glob";
                pattern.glob = path.isAbsolute(pattern.fromOrigin)
                    ? pattern.fromOrigin
                    : path.posix.join(
                        fastGlob.escapePath(normalizePath(path.resolve(pattern.context))),
                        pattern.fromOrigin
                    );
                /* eslint-enable no-param-reassign */
            }
        }


        logger.log(`Begin globbing '${pattern.glob}'...`);

        let paths;

        try {
            paths = await globby(pattern.glob, pattern.globOptions);
        } catch (error) {
            compilation.errors.push(error);

            return;
        }

        console.log('viewing path')
        console.log(pattern.glob)
        console.log(pattern.globOptions)
        console.log(paths)
        console.log(paths.length)

        if (paths.length === 0) {
            if (pattern.noErrorOnMissing) {
                logger.log(
                    `Finished to process a pattern from '${pattern.from}' using '${pattern.context}' context to '${pattern.to}'`
                );

                return;
            }

            const missingError = new Error(`Unable to locate '${pattern.glob}' glob`);

            compilation.errors.push(missingError);

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
                            compilation.errors.push(error);

                            return false;
                        }

                        if (!isFiltered) {
                            logger.log(`skip '${item.path}', because it was filtered`);
                        }

                        return isFiltered ? item : false;
                    }

                    return item;
                })
            )
        ).filter((item) => item);

        if (filteredPaths.length === 0) {
            if (pattern.noErrorOnMissing) {
                logger.log(
                    `finished to process a pattern from '${pattern.from}' using '${pattern.context}' context to '${pattern.to}'`
                );

                return;
            }

            const missingError = new Error(
                `unable to locate '${pattern.glob}' glob after filtering paths`
            );

            compilation.errors.push(missingError);

            return;
        }

        const files = await Promise.all(
            filteredPaths.map(async (item) => {
                const from = item.path;

                logger.debug(`Found '${from}'`);

                // `globby`/`fast-glob` return the relative path when the path contains special characters on windows
                const absoluteFilename = path.resolve(pattern.context, from);

                pattern.to =
                    typeof pattern.to === "function"
                        ? await pattern.to({context: pattern.context, absoluteFilename})
                        : path.normalize(
                            typeof pattern.to !== "undefined" ? pattern.to : ""
                        );

                const isToDirectory =
                    path.extname(pattern.to) === "" || pattern.to.slice(-1) === path.sep;

                const toType = pattern.toType
                    ? pattern.toType
                    : template.test(pattern.to)
                        ? "template"
                        : isToDirectory
                            ? "dir"
                            : "file";

                logger.log(`'to' option '${pattern.to}' determinated as '${toType}'`);

                const relativeFrom  = path.relative(pattern.context, absoluteFilename);
                let filename        = toType === "dir" ? path.join(pattern.to, relativeFrom) : pattern.to;

                if (path.isAbsolute(filename)) {
                    filename = path.relative(compiler.options.output.path, filename);
                }

                logger.log(`Determined that '${from}' should write to '${filename}'`);

                const sourceFilename = normalizePath(path.relative(compiler.context, absoluteFilename));

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
                    const {absoluteFilename, sourceFilename, filename, toType} = file;
                    const info = typeof pattern.info === "function" ? pattern.info(file) || {} : pattern.info || {};
                    const result = {
                        absoluteFilename,
                        sourceFilename,
                        filename,
                        force: pattern.force,
                        info,
                    };

                    // If this came from a glob or dir, add it to the file dependencies
                    if (pattern.fromType === "dir" || pattern.fromType === "glob") {
                        compilation.fileDependencies.add(absoluteFilename);

                        logger.debug(`Added '${absoluteFilename}' as a file dependency`);
                    }

                    let cacheEntry;

                    logger.debug(`Getting cache for '${absoluteFilename}'...`);

                    try {
                        cacheEntry = await cache.getPromise(
                            `${sourceFilename}|${index}`,
                            null
                        );
                    } catch (error) {
                        compilation.errors.push(error);

                        return;
                    }

                    if (cacheEntry) {
                        logger.debug(`Found cache for '${absoluteFilename}'...`);

                        let isValidSnapshot;

                        logger.debug(
                            `Checking snapshot on valid for '${absoluteFilename}'...`
                        );

                        try {
                            isValidSnapshot = await CopyPlugin.checkSnapshotValid(
                                compilation,
                                cacheEntry.snapshot
                            );
                        } catch (error) {
                            compilation.errors.push(error);

                            return;
                        }

                        if (isValidSnapshot) {
                            logger.debug(`Snapshot for '${absoluteFilename}' is valid`);

                            result.source = cacheEntry.source;
                        } else {
                            logger.debug(`Snapshot for '${absoluteFilename}' is invalid`);
                        }
                    } else {
                        logger.debug(`Missed cache for '${absoluteFilename}'`);
                    }

                    if (!result.source) {
                        const startTime = Date.now();

                        logger.debug(`Reading '${absoluteFilename}'...`);

                        let data;

                        try {
                            data = await readFile(inputFileSystem, absoluteFilename);
                        } catch (error) {
                            compilation.errors.push(error);

                            return;
                        }

                        logger.debug(`Read '${absoluteFilename}'`);

                        result.source = new RawSource(data);

                        let snapshot;

                        logger.debug(`Creating snapshot for '${absoluteFilename}'...`);

                        try {
                            snapshot = await CopyAdvancedPlugin.createSnapshot(
                                compilation,
                                startTime,
                                absoluteFilename
                            );
                        } catch (error) {
                            compilation.errors.push(error);

                            return;
                        }

                        if (snapshot) {
                            logger.debug(`Created snapshot for '${absoluteFilename}'`);
                            logger.debug(`Storing cache for '${absoluteFilename}'...`);

                            try {
                                await cache.storePromise(`${sourceFilename}|${index}`, null, {
                                    source: result.source,
                                    snapshot,
                                });
                            } catch (error) {
                                compilation.errors.push(error);

                                return;
                            }

                            logger.debug(`Stored cache for '${absoluteFilename}'`);
                        }
                    }

                    if (pattern.transform) {
                        const transform =
                            typeof pattern.transform === "function"
                                ? {transformer: pattern.transform}
                                : pattern.transform;

                        if (transform.transformer) {
                            logger.log(`Transforming content for '${absoluteFilename}'...`);

                            const buffer = result.source.buffer();

                            if (transform.cache) {
                                const defaultCacheKeys = {
                                    version,
                                    sourceFilename,
                                    transform: transform.transformer,
                                    contentHash: crypto
                                        .createHash("md4")
                                        .update(buffer)
                                        .digest("hex"),
                                    index,
                                };
                                const cacheKeys = `transform|${serialize(
                                    typeof transform.cache.keys === "function"
                                        ? await transform.cache.keys(
                                            defaultCacheKeys,
                                            absoluteFilename
                                        )
                                        : {...defaultCacheKeys, ...pattern.transform.cache.keys}
                                )}`;

                                logger.debug(
                                    `Getting transformation cache for '${absoluteFilename}'...`
                                );

                                const cacheItem = cache.getItemCache(
                                    cacheKeys,
                                    cache.getLazyHashedEtag(result.source)
                                );

                                result.source = await cacheItem.getPromise();

                                logger.debug(
                                    result.source
                                        ? `found transformation cache for '${absoluteFilename}'`
                                        : `no transformation cache for '${absoluteFilename}'`
                                );

                                if (!result.source) {
                                    const transformed = await transform.transformer(
                                        buffer,
                                        absoluteFilename
                                    );

                                    result.source = new RawSource(transformed);

                                    logger.debug(
                                        `Caching transformation for '${absoluteFilename}'...`
                                    );

                                    await cacheItem.storePromise(result.source);

                                    logger.debug(
                                        `Cached transformation for '${absoluteFilename}'`
                                    );
                                }
                            } else {
                                result.source = new RawSource(
                                    await transform.transformer(buffer, absoluteFilename)
                                );
                            }
                        }
                    }

                    if (toType === "template") {
                        logger.log(
                            `interpolating template '${filename}' for '${sourceFilename}'...`
                        );

                        const contentHash = CopyAdvancedPlugin.getContentHash(
                            compiler,
                            compilation,
                            result.source.buffer()
                        );
                        const ext = path.extname(result.sourceFilename);
                        const base = path.basename(result.sourceFilename);
                        const name = base.slice(0, base.length - ext.length);
                        const data = {
                            filename: normalizePath(
                                path.relative(pattern.context, absoluteFilename)
                            ),
                            contentHash,
                            chunk: {
                                name,
                                id: result.sourceFilename,
                                hash: contentHash,
                                contentHash,
                            },
                        };
                        const {path: interpolatedFilename, info: assetInfo} =
                            compilation.getPathWithInfo(normalizePath(result.filename), data);

                        result.info = {...result.info, ...assetInfo};
                        result.filename = interpolatedFilename;

                        logger.log(
                            `interpolated template '${filename}' for '${sourceFilename}'`
                        );
                    } else {
                        // eslint-disable-next-line no-param-reassign
                        result.filename = normalizePath(result.filename);
                    }

                    // eslint-disable-next-line consistent-return
                    return result;
                })
            );
        } catch (error) {
            compilation.errors.push(error);

            return;
        }

        logger.log(
            `Finished to process a pattern from '${pattern.from}' using '${pattern.context}' context to '${pattern.to}'`
        );

        return assets;
    }

    // Define `apply` as its prototype method which is supplied with compiler as its argument
    apply(compiler) {
        const pluginName = this.constructor.name;
        const limit = Limit(this.options.concurrency || 100);
        console.log(pluginName)


        // webpack module instance can be accessed from the compiler object,
        // this ensures that correct version of the module is used
        // (do not require/import the webpack or any symbols from it directly).
        const {webpack} = compiler;

        // Compilation object gives us reference to some useful constants.
        const {Compilation} = webpack;

        // RawSource is one of the "sources" classes that should be used
        // to represent asset sources in compilation.
        const {RawSource} = webpack.sources;

        // Tapping to the "thisCompilation" hook in order to further tap
        // to the compilation process on an earlier stage.
        compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
            const logger = compilation.getLogger("copy-advanced-webpack-plugin");
            const cache = compilation.getCache("CopyAdvancedWebpackPlugin");

            // Tapping to the assets processing pipeline on a specific stage.
            compilation.hooks.processAssets.tap(
                {
                    name: pluginName,

                    // Using one of the later asset processing stages to ensure
                    // that all assets were already added to the compilation by other plugins.
                    stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
                },
                async (assets) => {
                    logger.log('Starting to add additional assets...');
                    // "assets" is an object that contains all assets
                    // in the compilation, the keys of the object are pathnames of the assets
                    // and the values are file sources.


                    // Iterating over all the assets and
                    // generating content for our Markdown file.
                    // const content =
                    //     '# In this build:\n\n' +
                    //     Object.keys(assets)
                    //         .map((filename) => ` - ${filename} [${path.resolve(filename)}]`)
                    //         .join('\n');
                    // console.log(content)
                    // // Adding new asset to the compilation, so it would be automatically
                    // // generated by the webpack in the output directory.
                    // compilation.emitAsset(
                    //     this.options.outputFile,
                    //     new RawSource(content)
                    // );
                    //
                    let assetsMap = new Map();
                    await Promise.all(
                        this.patterns.map((item, index) => {
                            console.log(item)
                            console.log(index)

                            limit(async () => {
                                let assets;

                                try {
                                    assets = await CopyAdvancedPlugin.runPattern(
                                        compiler,
                                        compilation,
                                        logger,
                                        cache,
                                        item,
                                        index
                                    );
                                    console.log(assets)
                                } catch (error) {
                                    compilation.errors.push(error);

                                    //return;
                                }
                            })
                        })
                    );


                    const assetsAll = [...assetsMap.entries()].sort((a, b) => a[0] - b[0]);

                    // Avoid writing assets inside `p-limit`, because it creates concurrency.
                    // It could potentially lead to an error - 'Multiple assets emit different content to the same filename'
                    assetsAll
                        .reduce((acc, val) => acc.concat(val[1]), [])
                        .filter(Boolean)
                        .forEach((asset) => {
                            const {
                                absoluteFilename,
                                sourceFilename,
                                filename,
                                source,
                                force,
                            } = asset;

                            const existingAsset = compilation.getAsset(filename);

                            if (existingAsset) {
                                if (force) {
                                    const info = {copied: true, sourceFilename};

                                    logger.log(
                                        `force updating '${filename}' from '${absoluteFilename}' to compilation assets, because it already exists...`
                                    );

                                    compilation.updateAsset(filename, source, {
                                        ...info,
                                        ...asset.info,
                                    });

                                    logger.log(
                                        `force updated '${filename}' from '${absoluteFilename}' to compilation assets, because it already exists`
                                    );

                                    return;
                                }

                                logger.log(
                                    `skip adding '${filename}' from '${absoluteFilename}' to compilation assets, because it already exists`
                                );

                                return;
                            }

                            const info = {copied: true, sourceFilename};

                            logger.log(
                                `writing '${filename}' from '${absoluteFilename}' to compilation assets...`
                            );

                            compilation.emitAsset(filename, source, {
                                ...info,
                                ...asset.info,
                            });

                            logger.log(
                                `written '${filename}' from '${absoluteFilename}' to compilation assets`
                            );
                        });

                    logger.log("finished to adding additional assets");

                    //callback();
                });

            if (compilation.hooks.statsPrinter) {
                compilation.hooks.statsPrinter.tap(pluginName, (stats) => {
                    stats.hooks.print
                        .for("asset.info.copied")
                        .tap("copy-advanced-webpack-plugin",
                            (copied, {green, formatFlag}) =>
                            // eslint-disable-next-line no-undefined
                            copied ? green(formatFlag("copied")) : undefined
                        );
                });
            }
        });
    }
}

module.exports = CopyAdvancedPlugin;
