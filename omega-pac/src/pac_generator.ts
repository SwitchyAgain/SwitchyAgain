import type {OptionsMap, PacGeneratorOptions, Profile, ReferenceSet} from './types';
import Profiles from './profiles';
import U2 from './uglifyjs_shim';

type UglifyAst = {
  compute_char_frequency(): void;
  figure_out_scope(): void;
  mangle_names(): void;
  transform(compressor: unknown): UglifyAst;
  [key: string]: unknown;
};

const ProfilesApi = Profiles as {
  allReferenceSet(profile: string | Profile, options: OptionsMap, args?: PacGeneratorOptions): ReferenceSet;
  byName(profileName: string, options: OptionsMap): Profile | undefined;
  compile(profile: Profile): unknown;
  profileNotFound(name: string, action?: unknown): Profile | null;
  profileResult(profileName: string | Profile): unknown;
};

export function ascii(str: string): string {
  return str.replace(/[\u0080-\uffff]/g, (char) => {
    const hex = char.charCodeAt(0).toString(16);
    let result = '\\u';
    for (let i = hex.length; i < 4; i++) {
      result += '0';
    }
    result += hex;
    return result;
  });
}

export function compress(ast: UglifyAst): UglifyAst {
  ast.figure_out_scope();
  const compressor = U2.Compressor({
    warnings: false,
    keep_fargs: true
  }, {
    if_return: false
  });
  const compressed_ast = ast.transform(compressor);
  compressed_ast.figure_out_scope();
  compressed_ast.compute_char_frequency();
  compressed_ast.mangle_names();
  return compressed_ast;
}

export function script(options: OptionsMap, profile: string | Profile, args?: PacGeneratorOptions) {
  let targetProfile;
  if (typeof profile === 'string') {
    targetProfile = ProfilesApi.byName(profile, options);
  } else {
    targetProfile = profile;
  }
  const refs = ProfilesApi.allReferenceSet(targetProfile, options, {
    profileNotFound: args != null ? args.profileNotFound : void 0
  });
  const properties = [];
  for (const key in refs) {
    const name = refs[key];
    if (!(key !== '+direct')) {
      continue;
    }
    let p = typeof targetProfile === 'object' && targetProfile.name === name ? targetProfile : ProfilesApi.byName(name, options);
    if (p == null) {
      p = ProfilesApi.profileNotFound(name, args != null ? args.profileNotFound : void 0);
    }
    properties.push(new U2.AST_ObjectKeyVal({
      key: key,
      value: ProfilesApi.compile(p)
    }));
  }
  const profiles = new U2.AST_Object({
    properties: properties
  });
  const factory = new U2.AST_Function({
      argnames: [
        new U2.AST_SymbolFunarg({
          name: 'init'
        }), new U2.AST_SymbolFunarg({
          name: 'profiles'
        })
      ],
      body: [
        new U2.AST_Return({
          value: new U2.AST_Function({
            argnames: [
              new U2.AST_SymbolFunarg({
                name: 'url'
              }), new U2.AST_SymbolFunarg({
                name: 'host'
              })
            ],
            body: [
              new U2.AST_Directive({
                value: 'use strict'
              }), new U2.AST_Var({
                definitions: [
                  new U2.AST_VarDef({
                    name: new U2.AST_SymbolVar({
                      name: 'result'
                    }),
                    value: new U2.AST_SymbolRef({
                      name: 'init'
                    })
                  }), new U2.AST_VarDef({
                    name: new U2.AST_SymbolVar({
                      name: 'scheme'
                    }),
                    value: new U2.AST_Call({
                      expression: new U2.AST_Dot({
                        expression: new U2.AST_SymbolRef({
                          name: 'url'
                        }),
                        property: 'substr'
                      }),
                      args: [
                        new U2.AST_Number({
                          value: 0
                        }), new U2.AST_Call({
                          expression: new U2.AST_Dot({
                            expression: new U2.AST_SymbolRef({
                              name: 'url'
                            }),
                            property: 'indexOf'
                          }),
                          args: [
                            new U2.AST_String({
                              value: ':'
                            })
                          ]
                        })
                      ]
                    })
                  })
                ]
              }), new U2.AST_Do({
                body: new U2.AST_BlockStatement({
                  body: [
                    new U2.AST_SimpleStatement({
                      body: new U2.AST_Assign({
                        left: new U2.AST_SymbolRef({
                          name: 'result'
                        }),
                        operator: '=',
                        right: new U2.AST_Sub({
                          expression: new U2.AST_SymbolRef({
                            name: 'profiles'
                          }),
                          property: new U2.AST_SymbolRef({
                            name: 'result'
                          })
                        })
                      })
                    }), new U2.AST_If({
                      condition: new U2.AST_Binary({
                        left: new U2.AST_UnaryPrefix({
                          operator: 'typeof',
                          expression: new U2.AST_SymbolRef({
                            name: 'result'
                          })
                        }),
                        operator: '===',
                        right: new U2.AST_String({
                          value: 'function'
                        })
                      }),
                      body: new U2.AST_SimpleStatement({
                        body: new U2.AST_Assign({
                          left: new U2.AST_SymbolRef({
                            name: 'result'
                          }),
                          operator: '=',
                          right: new U2.AST_Call({
                            expression: new U2.AST_SymbolRef({
                              name: 'result'
                            }),
                            args: [
                              new U2.AST_SymbolRef({
                                name: 'url'
                              }), new U2.AST_SymbolRef({
                                name: 'host'
                              }), new U2.AST_SymbolRef({
                                name: 'scheme'
                              })
                            ]
                          })
                        })
                      })
                    })
                  ]
                }),
                condition: new U2.AST_Binary({
                  left: new U2.AST_Binary({
                    left: new U2.AST_UnaryPrefix({
                      operator: 'typeof',
                      expression: new U2.AST_SymbolRef({
                        name: 'result'
                      })
                    }),
                    operator: '!==',
                    right: new U2.AST_String({
                      value: 'string'
                    })
                  }),
                  operator: '||',
                  right: new U2.AST_Binary({
                    left: new U2.AST_Call({
                      expression: new U2.AST_Dot({
                        expression: new U2.AST_SymbolRef({
                          name: 'result'
                        }),
                        property: 'charCodeAt'
                      }),
                      args: [
                        new U2.AST_Number({
                          value: 0
                        })
                      ]
                    }),
                    operator: '===',
                    right: new U2.AST_Number({
                      value: '+'.charCodeAt(0)
                    })
                  })
                })
              }), new U2.AST_Return({
                value: new U2.AST_SymbolRef({
                  name: 'result'
                })
              })
            ]
          })
        })
      ]
    });
  return new U2.AST_Toplevel({
    body: [
      new U2.AST_Var({
        definitions: [
          new U2.AST_VarDef({
            name: new U2.AST_SymbolVar({
              name: 'FindProxyForURL'
            }),
            value: new U2.AST_Call({
              expression: factory,
              args: [ProfilesApi.profileResult(targetProfile.name), profiles]
            })
          })
        ]
      })
    ]
  });
}
