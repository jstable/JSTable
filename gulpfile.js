const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const rename = require('gulp-rename');
const terser = require('gulp-terser');
const webpackStream = require('webpack-stream');
const TerserPlugin = require("terser-webpack-plugin");

function sassTask(cb) {
    return gulp.src('src/jstable.scss')
        .pipe(sass({
            style: 'compressed',
            includePaths: ['sass'],
            silenceDeprecations: ['legacy-js-api']
        }))
        .pipe(gulp.dest('dist'));
}

function uglifyTask(cb) {
    return gulp.src(['src/jstable.js'])
        .pipe(terser())
        .on('error', printError)
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(gulp.dest('dist'))
}

function uglifyCompatibilityTask(cb) {
    return gulp.src(['src/jstable.js'])
        .pipe(webpackStream({
            output: {
                filename: 'jstable.js',
            },
            mode: 'production',
            optimization: {
                minimize: true,
                minimizer: [
                    new TerserPlugin({
                        extractComments: false,
                    }),
                ],
            },
            module: {
                rules: [
                    {
                        test: /\.js$/,
                        exclude: /node_modules/,
                        use: {
                            loader: "babel-loader",
                            options: {
                                presets: [
                                    ['@babel/preset-env', {
                                        "useBuiltIns": "usage",
                                        "corejs": 3
                                    }]
                                ]
                            }
                        }
                    }
                ]
            }
        }))
        .pipe(rename({
            suffix: '.es5.min'
        }))
        .pipe(gulp.dest('dist'))
}


function copyPolyfillFetch(cb) {
    return gulp.src('node_modules/whatwg-fetch/dist/fetch.umd.js')
        .pipe(terser())
        .pipe(rename('polyfill-fetch.min.js'))
        .pipe(gulp.dest('dist'))
}

function watchTask(cb) {
    gulp.watch(['src/*.scss'], sassTask)
    gulp.watch('src/*.js', gulp.series(uglifyTask, uglifyCompatibilityTask));
}

function printError(error) {
    console.log('---- Error ----');
    console.log("message", error.cause.message);
    console.log("file", error.cause.filename);
    console.log("line", error.cause.line);
    console.log("col", error.cause.col);
    console.log("pos", error.cause.pos);
    console.log("");

    // this will ensure that gulp will stop processing the pipeline without a crash
    this.emit('end');
}

exports.sass = sassTask;
exports.uglify = gulp.series(uglifyTask, uglifyCompatibilityTask, copyPolyfillFetch);

exports.default = watchTask;