# path-alias

path-alias is a drop in replacement for [module-alias](https://github.com/ilearnio/module-alias/).

In addition to module-alias features, you're able to resolve a path from a string, ex: for fs or path operations.

Like module-alias, you can make aliases for directories and files, and define custom module paths.

## Disclaimer
This package isn't guaranteed to work nicely, and depends on github repos I have, instead of npm.

## Install

```sh
npm install https://github.com/int3nse-git/path-alias
```

## Usage

See [module-alias](https://github.com/ilearnio/module-alias/) for most of the usage.

The differences are as follows:
- `_pathAliases` is a new name for `_moduleAliases` in your package.json, but both work
- `path-alias/register` returns the module too now
- `addAlias` can accept an object of aliases, simmilar to package.json
- `pathContainsAlias` is a new name for `isPathMatchesAlias`, but both work
- `addAlias` is a new name for `addAliases`, but both work
```js
const pathAlias = require('path-alias/register');

const myModule = require('$modules/myModule.js');

console.log(pathAlias.resolve('$root/foo/bar.js')); // -> yourProjectDirectory/foo/bar.js
```

```js
const pathAlias = require('path-alias');

console.log(pathAlias.resolve('$root/foo/bar.js')); // -> yourProjectDirectory/foo/bar.js
```
