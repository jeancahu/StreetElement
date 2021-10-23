import webpack from "webpack";

export default {
    mode: 'development',
    target: 'web',
    devtool: false,
    plugins: [new webpack.SourceMapDevToolPlugin({
    })],
    entry: {
        main: {
            import: './js/example.js',
        },
    },
    output: {
        library: 'global',
        filename: '[name].bundle.js',
        path: (new URL('dist/', import.meta.url)).pathname,
    },
    module: {
        rules: [
        ],
    }
};
