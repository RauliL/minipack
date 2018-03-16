const babel = require('@babel/core');
const babylon = require('babylon');
const caporal = require('caporal');
const fs = require('fs');
const t = require('@babel/types');
const traverse = require('@babel/traverse').default;

const resolvedModules = {};
let entryLevelModule;

const processImportDeclaration = (path) => {
  const { specifiers, source } = path.node;
  let resolvedModule;

  if (!t.isStringLiteral(source)) {
    throw new Error('TODO: Complaint about dynamic imports.');
  }

  resolvedModule = resolveModule(source.value);

  // TODO: __minipack_require__(resolvedModule.index) to named variable.
  // TODO: Process each named import and create variable declarations from
  // them.

  throw new Error('TODO: Complete import processing');
};

const processRequireCall = (path) => {
  const { arguments } = path.node;
  let resolvedModule;

  if (arguments.length !== 1) {
    throw new Error('TODO: Complain about wrong number of arguments');
  } else if (!t.isStringLiteral(arguments[0])) {
    throw new Error('TODO: Complain about dynamic import');
  }

  resolvedModule = resolvedModule(arguments[0].value);
  path.replaceWith(
    t.callExpression(
      t.identifier('__minipack_require__'),
      [t.numericLiteral(resolvedModule.index)]
    )
  );
};

const processDefaultExport = (path) => {
  path.replaceWith(t.assignmentExpression(
    '=',
    t.memberExpression(
      t.identifier('exports'),
      t.identifier('default')
    ),
    path.node.declaration
  ));
};

const processExport = (path) => {
  if (t.isVariableDeclaration(path.node.declaration)) {
    path.replaceWithMultiple(path.node.declaration.declarations.map((declaration) =>
      t.variableDeclaration(
        path.node.declaration.kind,
        [t.variableDeclarator(
          declaration.id,
          t.assignmentExpression(
            '=',
            t.memberExpression(
              t.identifier('exports'),
              declaration.id
            ),
            declaration.init
          )
        )]
      )
    ));
  } else if (t.isFunctionDeclaration(path.node.declaration)) {
    path.replaceWithMultiple([
      path.node.declaration,
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          t.memberExpression(t.identifier('exports'), path.node.declaration.id),
          path.node.declaration.id
        )
      )
    ]);
  } else {
    path.replaceWithMultiple(path.node.specifiers.map((specifier) => t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(t.identifier('exports'), specifier.exported),
        specifier.local
      )
    )));
  }
}

const createModule = (path) => {
  const sourceCode = fs.readFileSync(path, 'utf8');
  const ast = babylon.parse(sourceCode, { sourceType: 'module' });
  const module = {
    ast,
    index: Object.keys(resolvedModules).length,
    path
  };

  resolvedModules[path] = module;

  // Go through imports and resolve them.
  traverse(ast, {
    enter (path) {
      if (t.isImportDeclaration(path.node)) {
        processImportDeclaration(path);
      } else if (t.isCallExpression(path.node) && t.isIdentifier(path.node.callee, { name: 'require' })) {
        processRequireCall(path);
      } else if (t.isExportAllDeclaration(path.node)) {
        throw new Error('TODO: export * from "mod"');
      } else if (t.isExportDefaultDeclaration(path.node)) {
        processDefaultExport(path);
      } else if (t.isExportNamedDeclaration(path.node)) {
        processExport(path);
      }
    }
  });

  return module;
};

const resolveModule = (path) => {
  const resolvedPath = require.resolve(path);

  return resolvedModules[path] || createModule(resolvedPath);
};

// TODO: This is pretty whoah, see if it can be simplified somehow.
const buildProgram = () => t.program([
  t.expressionStatement(
    t.callExpression(
      t.arrowFunctionExpression(
        [
          t.identifier('root'),
          t.identifier('factory')
        ],
        t.blockStatement([
          t.ifStatement(
            t.logicalExpression(
              '&&',
              t.binaryExpression(
                '===',
                t.unaryExpression(
                  'typeof',
                  t.identifier('exports')
                ),
                t.stringLiteral('object')
              ),
              t.binaryExpression(
                '===',
                t.unaryExpression(
                  'typeof',
                  t.identifier('module')
                ),
                t.stringLiteral('object')
              )
            ),
            t.expressionStatement(t.assignmentExpression(
              '=',
              t.memberExpression(
                t.identifier('module'),
                t.identifier('exports')
              ),
              t.callExpression(
                t.identifier('factory'),
                []
              )
            )),
            t.ifStatement(
              t.logicalExpression(
                '&&',
                t.binaryExpression(
                  '===',
                  t.unaryExpression(
                    'typeof',
                    t.identifier('define')
                  ),
                  t.stringLiteral('function')
                ),
                t.memberExpression(
                  t.identifier('define'),
                  t.identifier('amd')
                )
              ),
              t.expressionStatement(t.callExpression(
                t.identifier('define'),
                [
                  t.arrayExpression([]),
                  t.identifier('factory')
                ]
              )),
              t.ifStatement(
                t.binaryExpression(
                  '===',
                  t.unaryExpression(
                    'typeof',
                    t.identifier('exports')
                  ),
                  t.stringLiteral('object')
                ),
                t.expressionStatement(t.assignmentExpression(
                  '=',
                  t.memberExpression(
                    t.identifier('exports'),
                    t.identifier('TODO')
                  ),
                  t.callExpression(
                    t.identifier('factory'),
                    []
                  )
                )),
                t.expressionStatement(t.assignmentExpression(
                  '=',
                  t.memberExpression(
                    t.identifier('root'),
                    t.identifier('TODO')
                  ),
                  t.callExpression(
                    t.identifier('factory'),
                    []
                  )
                ))
              )
            )
          )
        ])
      ),
      [
        t.thisExpression(),
        t.arrowFunctionExpression(
          [],
          t.callExpression(
            t.arrowFunctionExpression(
              [t.identifier('modules')],
              t.blockStatement([
                t.variableDeclaration(
                  'const',
                  [t.variableDeclarator(
                    t.identifier('installedModules'),
                    t.objectExpression([])
                  )]
                ),
                t.functionDeclaration(
                  t.identifier('__minipack_require__'),
                  [t.identifier('moduleId')],
                  t.blockStatement([
                    t.variableDeclaration(
                      'let',
                      [t.variableDeclarator(
                        t.identifier('module'),
                        t.memberExpression(
                          t.identifier('installedModules'),
                          t.identifier('moduleId'),
                          true
                        )
                      )]
                    ),
                    t.ifStatement(
                      t.identifier('module'),
                      t.returnStatement(t.memberExpression(
                        t.identifier('module'),
                        t.identifier('exports')
                      ))
                    ),
                    t.expressionStatement(t.assignmentExpression(
                      '=',
                      t.identifier('module'),
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier('exports'),
                          t.objectExpression([])
                        )
                      ])
                    )),
                    t.expressionStatement(t.callExpression(
                      t.memberExpression(
                        t.memberExpression(
                          t.identifier('modules'),
                          t.identifier('moduleId'),
                          true
                        ),
                        t.identifier('call')
                      ),
                      [
                        t.memberExpression(
                          t.identifier('module'),
                          t.identifier('exports')
                        ),
                        t.identifier('module'),
                        t.memberExpression(
                          t.identifier('module'),
                          t.identifier('exports')
                        ),
                        t.identifier('__minipack_require__')
                      ]
                    )),
                    t.returnStatement(t.memberExpression(
                      t.identifier('module'),
                      t.identifier('exports')
                    ))
                  ])
                ),
                t.returnStatement(t.callExpression(
                  t.identifier('__minipack_require__'),
                  [t.numericLiteral(0)]
                ))
              ])
            ),
            [t.arrayExpression(
              Object.keys(resolvedModules).map((path) => t.arrowFunctionExpression(
                [
                  t.identifier('module'),
                  t.identifier('exports'),
                  t.identifier('__minipack_require__')
                ],
                t.blockStatement(resolvedModules[path].ast.program.body)
              ))
            )]
          )
        )
      ]
    )
  )
]);

caporal
  .version('1.0.0')
  .option('-m, --minify', 'Minify resulting output.', caporal.BOOL)
  .argument('<file>', 'Path to the entry point file.')
  .action((args, options) => {
    const presets = [];

    // TODO: Find out why 'env' preset in Babel currently gives us infinite
    // recursion with it's own typeof transformation.

    if (options.minify) {
      presets.push('minify');
    }

    // Construct the entry level module.
    entryLevelModule = createModule(fs.realpathSync(args.file));
    // Bundle everything into single program and output it to stdout.
    process.stdout.write(babel.transformFromAst(
      buildProgram(),
      null,
      { presets }
    ).code);
  });

caporal.parse(process.argv);
