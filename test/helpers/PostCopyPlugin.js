class PostCopyPlugin {
    constructor(options = {})
    {
        this.options = options.options || {};
    }

    // eslint-disable-next-line class-methods-use-this
    apply(compiler)
    {
        const plugin = {name: "PostCopyPlugin"};

        compiler.hooks.thisCompilation.tap(plugin, (compilation) => {
            compilation.hooks.finishModules.tapAsync(
                "post-copy-webpack-plugin",
                (callback) => {
                compilation.hooks.finishModules.tap(plugin, (module) => {
                        // eslint-disable-next-line no-console
                        console.log(module)
                        // module.forEach(({item, index})=>{
                        //     // const {RawSource} = compiler.webpack.sources;
                        //     // const source = new RawSource(item);
                        //
                        //     // compilation.emitAsset(item, source, info);
                        // })

                    });
                callback();
                }
            );
        });
    }
}

export default PostCopyPlugin;
