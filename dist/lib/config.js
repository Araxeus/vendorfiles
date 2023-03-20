// we are working on a new package called "vendor-dependencies" that automatically takes care of creating/updating vendor dependencies
// the configuration is either in package.json or in a separate file called vendor-dependencies.json
import { assert, getPackageJson } from './utils.js';
const defaultConfig = {
    vendorFolder: './vendor',
};
// function to get the configuration
let res;
export async function getConfig() {
    // if there is a vendor-dependencies.json file in the current directory, use that
    // otherwise, use the configuration from package.json
    // if there is no configuration in package.json, use the default configuration
    if (res)
        return res;
    const { packageJson: pkgJson, path: pkgPath } = await getPackageJson();
    // @ts-expect-error packageJson.vendorDependencies is not in the type definition
    const dependencies = pkgJson.vendorDependencies || {};
    assert(dependencies instanceof Object, 'The vendorDependencies in package.json is invalid.');
    // @ts-expect-error packageJson.vendorConfig is not in the type definition
    const config = pkgJson.vendorConfig || defaultConfig;
    config.vendorFolder = config.vendorFolder || defaultConfig.vendorFolder;
    assert(config instanceof Object &&
        typeof config.vendorFolder === 'string' &&
        !/^(\/?[a-z0-9]+)+$/.test(config.vendorFolder), 'The vendorConfig in package.json is invalid.');
    res = {
        dependencies,
        config,
        pkgJson,
        pkgPath,
    };
    return res;
}
