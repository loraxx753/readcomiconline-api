var path = require('path');

module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
//    uglify: {
//      options: {
//        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
//      },
//      build: {
//        src: 'src/<%= pkg.name %>.js',
//        dest: 'build/<%= pkg.name %>.min.js'
//      }
//    },
    watch: {
      options: {
        livereload: true
      },
      express: {
        files: [ 'src/**/*.js', 'app.js' ],
        tasks: [ 'express' ],
        options: {
          spawn: false
        }
      }
    },
    parallel: {
      dev: {
        options: {
          stream: true
        },
        tasks: [{
          grunt: true,
          args: ['watch:dev']
        }]
      },
    },
    express: {
      options: {
//        background: false,
        port: 8081,
        script: './app.js'
      },
      defaults: {},

    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-express-server');
  grunt.loadNpmTasks('grunt-parallel');

  //grunt.registerTask('server', [ 'express:dev', 'watch' ]);

  // Default task(s).
  grunt.registerTask('default', ['express', 'watch']);
  //grunt.registerTask('default', ['parallel:dev']);
};