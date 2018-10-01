/**
* @file main file
*/

const program = require('commander');
const packageJson = require('./package.json');
const moment = require('moment');
const getPackageDetails = require('./lib/getPackageDetails');
const walkDependencies = require('./lib/walkDependencies');
const bluebird = require('bluebird');
const fs = require('fs');
const { toPairs } = require('lodash');
const getSimpleTable = require('./lib/getSimpleTable');


/**
 * install action
 * @param  {string} nameVersion package considering to install
 */
function installPackage(name, versionLoose) {
  return getPackageDetails(name, versionLoose)
    .then(async (packageStats) => {
      const packages = await walkDependencies(
        { [name]: versionLoose }
      );

      return [
        `${packageStats.name}@${packageStats.version}`,
        moment(packageStats.modified).fromNow(),
        Object.keys(packages).length,
      ];
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}


program.version(packageJson.version);
program.description(packageJson.description);
program.usage('npm-consider install <path to package.json>');

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// feed it package.json path
program.command(`install [pkg]`)
  .option('-d', '--dev', 'Include dev dependencies')
  .action(async (pkg, cmd) => {
    const filename = fs.readFileSync(pkg);
    let packages = JSON.parse(filename).dependencies;
    console.log(cmd);
    if (cmd.D) {
      packages = Object.assign(packages, JSON.parse(filename).devDependencies);
    }
    console.log('Walking dependency tree...');
    const results = await bluebird.map(toPairs(packages), ([name, version]) => {
      return installPackage(name, version.replace(/[\~\^]/, ''));
    });

    results.sort((a, b) => (-1) * (a[2] - b[2]));

    const table = getSimpleTable();
    table.push(['Package', 'Updated', 'Dependencies']);
    results.forEach(data => table.push(data));

    console.log(`\n${table.toString()}`);

    console.log(
      '\n\nTotal dependencies:',
      results.reduce((acc, item) => acc + item[2], 0));
  });

program.parse(process.argv);
