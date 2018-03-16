const babel = require('@babel/core');
const babylon = require('babylon');
const caporal = require('caporal');
const fs = require('fs');
const t = require('@babel/types');
const traverse = require('@babel/traverse').default;

const resolvedModules = {};
let entryLevelModule;

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
        throw new Error('TODO: Convert import statement into require function call');
      } else if (t.isCallExpression(path.node) && t.isIdentifier(path.node.callee, { name: 'require' })) {
        let resolvedModule;

        if (path.node.arguments.length !== 1) {
          throw new Error('TODO: Complain about wrong number of arguments');
        } else if (!t.isStringLiteral(path.node.arguments[0])) {
          throw new Error('TODO: Complain about dynamic import');
        }

        resolvedModule = resolveModule(path.node.arguments[0].value);
        path.replaceWith(
          t.callExpression(
            t.identifier('__minipack_require__'),
            [t.numericLiteral(resolvedModule.index)]
          )
        );
      } else if (t.isExportAllDeclaration(path.node)) {
        throw new Error('TODO: Convert export * from "mod"');
      } else if (t.isExportDefaultDeclaration(path.node)) {
        throw new Error('TODO: Convert export default foo');
      } else if (t.isExportNamedDeclaration(path.node)) {
        throw new Error('TODO: Convert named export');
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
                      t.returnStatement(t.identifier('module'))
                    ),
                    t.expressionStatement(t.assignmentExpression(
                      '=',
                      t.identifier('module'),
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier('exports'),
                          t.objectExpression([])
                        ),
                        t.objectProperty(
                          t.identifier('id'),
                          t.identifier('moduleId')
                        ),
                        t.objectProperty(
                          t.identifier('loaded'),
                          t.booleanLiteral(false)
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
    const presets = ['env'];

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
