module.exports =
  options:
    archive: './release.zip'
    mode: 'zip'
  build:
    files: [
      {
        cwd: 'build'
        src: [
          '**'
          '!manifest.json'
          '!lib/bootstrap/fonts/*.eot'
          '!lib/bootstrap/fonts/*.svg'
          '!lib/bootstrap/fonts/*.ttf'
        ]
        expand: true
        filter: 'isFile'
      }
      {
        cwd: 'tmp/'
        src: 'manifest.json'
        expand: true
      }
    ]
