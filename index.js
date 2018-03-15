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

caporal
  .version('1.0.0')
  .argument('<file>', 'Path to the entry point file.')
  .action((args) => {
    entryLevelModule = createModule(fs.realpathSync(args.file));
    // TODO: Construct the file and bundle modules in it, output it to stdout.
  });

caporal.parse(process.argv);
