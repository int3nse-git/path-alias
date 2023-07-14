const nodePath = require('path');
const callerCallsite = require('caller-callsite');
let BuiltinModule = require('module');

// Guard against poorly mocked module constructors
let Module = module.constructor.length > 1
    ? module.constructor
    : BuiltinModule;

// --- Module folder paths ---
let modulePaths = [];

let oldNodeModulePaths = Module._nodeModulePaths;
Module._nodeModulePaths = function(from) {
    let paths = oldNodeModulePaths.call(this, from);

    // Only include the module path for top-level modules
    // that were not installed:
    if (from.indexOf('node_modules') === -1)
        paths = modulePaths.concat(paths);

    return paths;
}

function addPathHelper(path, targetArray) {
    path = nodePath.normalize(path);
    
    if (targetArray && targetArray.indexOf(path) === -1)
        targetArray.unshift(path);
}

function addPath(path) {
    path = nodePath.normalize(path);
    
    // Return if path is already added
    if (modulePaths.indexOf(path) !== -1)
        return;
    
    modulePaths.push(path);
    
    // Enable the search path for the current top-level module
    let mainModule = require.main._simulateRepl ? undefined : require.main;
    if (mainModule)
        addPathHelper(path, mainModule.paths);
    
    // Also modify the paths of the module that was used to load the
    // path-alias module and all of it's parents
    let parent = module.parent;
    while (parent && parent !== mainModule) {
        addPathHelper(path, parent.paths);
        parent = parent.parent;
    }
}

// --- Path aliases ---
let pathAliases = {};
let pathAliasNames = [];

function addAlias(alias, target) {
    // Allow object of aliases to be passed
    if (typeof alias == 'object' && typeof target == 'undefined') {
        for (let thisAlias in alias)
            addAlias(thisAlias, alias[thisAlias]);
        
        return;
    }
    
    pathAliases[alias] = target;
    
    // Cost of sorting is lower here than during resolution
    pathAliasNames = Object.keys(pathAliases);
    pathAliasNames.sort().reverse();
}

function pathContainsAlias(path, alias) {
    // Matching /^alias(\/|$)/
    return (path.indexOf(alias) === 0 && (path.length === alias.length || path[alias.length] === '/'));
}

function resolve(path) {
    for (let i = 0; i < pathAliasNames.length; i++) {
        const alias = pathAliasNames[i];
        
        if (!pathContainsAlias(path, alias))
            continue;
        
        let aliasTarget = pathAliases[alias];
        
        // Custom function handler
        if (typeof aliasTarget === 'function') {
            aliasTarget = aliasTarget(callerCallsite({ recentFirst: true, depth: 1 }).getFileName(), path, alias);
            
            if (!aliasTarget || typeof aliasTarget !== 'string') 
                throw new Error('[path-alias] Expecting custom handler function to return path.');
        }
        
        return nodePath.join(aliasTarget, path.substr(alias.length));
    }
    
    // If no alias matches, return supplied path
    return path;
}

let oldResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parentModule, isMain, options) {
    request = resolve(request);

    return oldResolveFilename.call(this, request, parentModule, isMain, options);
}

const exportObj = {
    addPath,
    addAlias,
    resolve,
    pathContainsAlias,
    
    // Added to not have any breaking differences between this module and the module it's based off of, module-alias
    isPathMatchesAlias: pathContainsAlias,
    addAliases: addAlias
};

/**
 * Import aliases from package.json
 * @param {object} options
 */
function init(options) {
    if (typeof options === 'string') {
        options = { base: options };
    }

    options = options || {};

    // There is probably 99% chance that the project root directory is located
    // above the node_modules directory,
    // Or that package.json is in the node process' current working directory (when
    // running a package manager script, e.g. `yarn start` / `npm run start`)
    let candidatePackagePaths = options.base ? 
        [nodePath.resolve(options.base.replace(/\/package\.json$/, ''))] :
        [nodePath.join(__dirname, '..', '..'), process.cwd()];
    
    let base;
    let npmPackage;
    for (let i in candidatePackagePaths) {
        try {
            base = candidatePackagePaths[i];
            npmPackage = require(nodePath.join(base, 'package.json'));
            break;
        } catch (e) {}
    }

    if (typeof npmPackage !== 'object') {
        let pathString = candidatePackagePaths.join(',\n');
        throw new Error(`[path-alias] Unable to find package.json in any of:\n[${pathString}]`);
    }

    // Import aliases, fallback to _moduleAliases if needed
    let aliases = npmPackage._pathAliases || npmPackage._moduleAliases || {};
    
    for (let alias in aliases)
        if (aliases[alias][0] !== '/')
            aliases[alias] = nodePath.join(base, aliases[alias]);
    
    addAlias(aliases);
    
    // Register custom module directories (like node_modules)
    if (npmPackage._moduleDirectories instanceof Array) {
        npmPackage._moduleDirectories.forEach(function(dir) {
            if (dir === 'node_modules')
                return;

            let modulePath = nodePath.join(base, dir);
            addPath(modulePath);
        });
    }
    
    return exportObj;
}

module.exports = init;
Object.assign(module.exports, exportObj);
