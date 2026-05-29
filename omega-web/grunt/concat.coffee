module.exports =
  web_omega:
    options:
      separator: '\n'
    files:
      'build/js/omega.js': [
        'src/omega/app.js'
        'src/omega/filters.js'
        'src/omega/directives.js'
        'src/omega/controllers/about.js'
        'src/omega/controllers/fixed_profile.js'
        'src/omega/controllers/io.js'
        'src/omega/controllers/master.js'
        'src/omega/controllers/pac_profile.js'
        'src/omega/controllers/profile.js'
        'src/omega/controllers/quick_switch.js'
        'src/omega/controllers/rule_list_profile.js'
        'src/omega/controllers/switch_profile.js'
      ]
