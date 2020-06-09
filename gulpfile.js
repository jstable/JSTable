const gulp = require( 'gulp' );
const sass = require( 'gulp-sass' );
const rename = require( 'gulp-rename' );
const terser = require( 'gulp-terser' );
const autoprefixer = require( 'gulp-autoprefixer' );
const babel = require( 'gulp-babel' );
const concat = require( 'gulp-concat' );

function sassTask(cb) {
    return gulp.src( 'src/jstable.scss' )
        .pipe( sass( { outputStyle: 'compressed'} )
         .on( 'error', printError ) )
        .pipe( autoprefixer() )
        .pipe( gulp.dest( 'dist' ) );
}

function uglifyTask(cb) {
    return gulp.src( [ 'src/jstable.js'] )
        .pipe( terser() )
        .on( 'error', printError )
        .pipe( rename( {
            suffix: '.min'
        } ) )
        .pipe( gulp.dest( 'dist' ) )
}

function uglifyCompatibilityTask(cb) {
    return gulp.src( ['src/jstable.js'] )
        //.pipe(concat('jstable.js'))
        .pipe(babel({ presets: ['@babel/preset-env']}))
        .pipe( terser() )
        .on( 'error', printError )
        .pipe( rename( {
            suffix: '.min'
        } ) )
        .pipe( gulp.dest( 'dist' ) )
}

function copyPolyfillBabel(cb) {
    return gulp.src( 'node_modules/babel-polyfill/dist/polyfill.js')
        .pipe( terser() )
        .pipe( rename('polyfill-babel.min.js') )
        .pipe( gulp.dest( 'dist' ) )
}

function copyPolyfillPromise(cb) {
    return gulp.src( 'node_modules/promise-polyfill/dist/polyfill.min.js')
        .pipe( rename('polyfill-promise.min.js') )
        .pipe( gulp.dest( 'dist' ) )
}

function copyPolyfillFetch(cb) {
    return gulp.src( 'node_modules/whatwg-fetch/dist/fetch.umd.js')
        .pipe( terser() )
        .pipe( rename('polyfill-fetch.min.js'))
        .pipe( gulp.dest( 'dist' ) )
}

function watchTask(cb) {
    gulp.watch( [ 'src/*.scss' ], sassTask )
    gulp.watch( 'src/*.js', uglifyCompatibilityTask );
}

function printError( error ) {
    console.log( '---- Error ----' );
    console.log( "message", error.cause.message );
    console.log( "file", error.cause.filename );
    console.log( "line", error.cause.line );
    console.log( "col", error.cause.col );
    console.log( "pos", error.cause.pos );
    console.log( "" );

    // this will ensure that gulp will stop processing the pipeline without a crash
    this.emit( 'end' );
}

exports.sass = sassTask;
exports.uglify = gulp.series(uglifyCompatibilityTask, copyPolyfillBabel, copyPolyfillPromise, copyPolyfillFetch);

exports.default = watchTask;