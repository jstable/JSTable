const gulp = require( 'gulp' );
const sass = require( 'gulp-sass' );
const rename = require( 'gulp-rename' );
const terser = require( 'gulp-terser' );
const autoprefixer = require( 'gulp-autoprefixer' );

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

function watchTask(cb) {
    livereload.listen();
    gulp.watch( [ 'src/*.scss' ], sassTask )
    gulp.watch( 'src/*.js', uglifyTask );
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
exports.uglify = uglifyTask;
exports.default = watchTask;