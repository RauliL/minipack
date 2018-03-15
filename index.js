const babylon = require('babylon');
const caporal = require('caporal');
const fs = require('fs');

const resolvedModules = {};
let entryLevelModule;

const createModule = (path) => {
  const sourceCode = fs.readFileSync(path, 'utf8');
  const tokens = babylon.parse(sourceCode).tokens;
  const module = {
    index: Object.keys(resolvedModules).length,
    path,
    tokens
  };

  resolvedModules[path] = module;
  // TODO: Go through imports and resolve them.

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
