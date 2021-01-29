#!/usr/bin/env node
import { InvalidOptionArgumentError, program } from 'commander';
import picomatch from 'picomatch';
import * as fs from 'fs';
import * as path from 'path';
import { getBenchmarks } from './catalog';
import { runBenchmark, RunBenchmarkOptions } from './runner';
import { printProgress, printResult } from './output';
import { BenchmarkEnvironment, HistoryEntry, loadHistory, saveHistory } from './history';
import { HighScoreConfig } from './cli-config';

/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */

const DEFAULT_OPTIONS: RunBenchmarkOptions = {
    minSampleDuration: 1,
    minSampleCount: 8,
    maxSampleCount: 32,
    timeout: false,
    runsPerSample: undefined,

    confirmationHeuristic: {
        sampleCount: 2,
        variance: 0.01,
    },

    cooldownHeuristic: {
        sampleCount: 3,
    },

    baselineHeuristic: {
        sampleCount: 32,
        variance: 0.01,
    },
};

const packageJson = require('../package.json');

// function intOption(str: string) {
//     const num = parseInt(str, 10);
//     if (isNaN(num)) {
//         throw new InvalidOptionArgumentError('Not an integer');
//     }
//     return num;
// }
function floatOption(str: string) {
    const num = parseFloat(str);
    if (isNaN(num)) {
        throw new InvalidOptionArgumentError('Not a number');
    }
    return num;
}

program
    .version(packageJson.version)
    .option('-c, --config <file>', 'Specify the benchmark config file (default: bench.config.js)')
    .option('--log-dir <dir>', 'Specify the directory to put logs in (default: bench-log)')
    .option('-t, --include <pattern>', 'Runs only benchmarks matching a given regex')
    .option('--min-sample-duration <seconds>', 'Ensure that each sample takes at least this many seconds', floatOption)
    .option('--no-log', 'Don\'t save the results to the log')
    .option('--set-baseline', 'Mark these results as the "baseline" for future runs')
    .option('-q, --quiet', 'Prints only the results of the benchmarks (no progress)');

program.parse(process.argv);

const options = program.opts();

const configFile = path.resolve(options.config || './bench.config.js');
const configDir = path.dirname(configFile);
let config: HighScoreConfig = {};
if (fs.existsSync(configFile)) {
    config = require(configFile) as HighScoreConfig;
}

let moduleDir = configDir;
while (moduleDir) {
    if (fs.existsSync(path.join(moduleDir, 'package.json'))) {
        break;
    }
    moduleDir = path.dirname(moduleDir);
}
const moduleJson = moduleDir && require(path.join(moduleDir, 'package.json'));

const logDir = path.resolve(configDir, options.logDir || config.logDir || './bench-log');

function walk(dir: string, callback: (file: string) => void) {
    for (const name of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, name);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, callback);
        } else {
            callback(fullPath);
        }
    }
}

const excludePaths = config.excludePaths || [ '**/node_modules/**' ];
const benchmarkPaths = config.benchmarkPaths || [ '**/*.bench.js' ];
const excludeMatcher = picomatch(excludePaths);
const includeMatcher = picomatch(benchmarkPaths);
const rootDir = config.rootDir ? path.resolve(configDir, config.rootDir) : configDir;
walk(rootDir, (file) => {
    const relPath = file.substring(rootDir.length + 1);
    if (!includeMatcher(relPath) || excludeMatcher(relPath)) {
        return;
    }
    require(file);
});

const includeStr = options.include;
const includeRegexp = includeStr && new RegExp(includeStr);
const benchmarks = getBenchmarks();

const filteredBenchmarks = benchmarks.filter((benchmark) => {
    return !includeRegexp || includeRegexp.test(benchmark.name);
});

const longestNameLength = filteredBenchmarks.reduce((sofar, benchmark) => Math.max(sofar, benchmark.name.length), 0);

const baseOptions = {
    ...DEFAULT_OPTIONS,
};

function copyOption<O, T extends (keyof RunBenchmarkOptions & keyof O)>(from: O, name: T) {
    if (from[name]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        baseOptions[name] = from[name] as any;
    }
}

copyOption(config, 'timeout');

copyOption(options, 'minSampleDuration');

const environment: BenchmarkEnvironment = {
    nodeVersion: process.version,
    runnerVersion: packageJson.version,
    moduleName: config.moduleName ?? (moduleJson && moduleJson.name),
    moduleVersion: config.moduleVersion ?? (moduleJson && moduleJson.version),
};

console.log(`Running ${filteredBenchmarks.length} benchmark${filteredBenchmarks.length === 1 ? '' : 's'}...`);

function fixFilename(str: string) {
    let ret = '';
    for (const c of str) {
        if ('/\\?%*:|"<>.,= '.indexOf(c) >= 0) {
            ret += '-';
        } else {
            ret += c;
        }
    }
    return ret;
}

for (const benchmark of benchmarks) {
    const logPath = path.join(logDir, `${fixFilename(benchmark.name)}.log.json`);
    const history = loadHistory(logPath, benchmark.name);
    if (!includeRegexp || includeRegexp.test(benchmark.name)) {
        process.stdout.write(`${benchmark.name}: initializing...`);
        const benchOptions = {
            ...baseOptions,
            ...benchmark.options,
        };
        let baseline: HistoryEntry | undefined;
        if (history && typeof history.baseline !== 'undefined') {
            baseline = history.entries[history.baseline];
        }
        const result = runBenchmark(benchmark, benchOptions, baseline, (progress) => {
            if (!options.quiet) {
                printProgress(benchmark.name, progress);
            }
        });
        printResult(benchmark.name, longestNameLength, result, baseline);
        if (!options.noLog) {
            if (options.setBaseline) {
                history.baseline = history.entries.length;
            }
            history.entries.push({
                timestamp: new Date().toISOString(),
                result,
                environment,
                options: benchOptions,
                comment: benchmark.comment,
                version: benchmark.version,
            });
            saveHistory(history, logPath);
        }
    }
}
