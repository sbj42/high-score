# 🥇 HighScore

![Dependencies](https://img.shields.io/badge/dependencies-2-green.svg)
[![Node.js CI](https://github.com/sbj42/high-score/workflows/Node.js%20CI/badge.svg)](https://github.com/sbj42/high-score/actions?query=workflow%3A%22Node.js+CI%22)
[![License](https://img.shields.io/github/license/sbj42/high-score.svg)](https://github.com/sbj42/high-score)

#### Performance testing framework with history

* Automatically find benchmarks
* Get "stable" results
* Log benchmark history
* Set a baseline to compare against

## Installation

```
npm install --save-dev high-score
```

## Quick Start

Make a benchmark like this:

```js
const { benchmark } = require('high-score');

benchmark('my-fast-code', () => (
    // ... code to measure goes here
));
```

Run it from your terminal this:

```
high-score
```

## Command Line Options

```
  -V, --version                    output the version number
  -c, --config <file>              Specify the benchmark config file (default: bench.config.js)
  --log-dir <dir>                  Specify the log directory (default: bench-log)
  -t, --include <pattern>          Runs only benchmarks matching a given regex
  --min-sample-duration <seconds>  Ensure that each sample takes at least this many seconds    
  --no-log                         Don't save the results to the log
  --set-baseline                   Mark these results as the "baseline" for future runs        
  -q, --quiet                      Prints only the results of the benchmarks (no progress)     
  -h, --help                       display help for command
  ```

## Config File

You can set global benchmark options in a `bench.config.js` file at the root of your project.  All settings are optional:

```js
module.exports = {
    benchmarkPaths: ..., // glob for files that contain benchmarks (default: '**/*.bench.js')
    excludePaths: ...,   // glob for files to ignore (default: '**/node_modules/**')

    rootDir: ...,        // root directory to search for benchmarks (default: folder containing bench.config.js)
    logDir: ...,         // where to store logs of previous benchmark results (default: 'bench-log')

    moduleName: ...,     // name of module being tested (default: 'name' from package.json)
    moduleVersion: ...,  // version of module being tested (default: 'version' from package.json)

    timeout: ...,        // per-benchmark timeout in seconds (default: none)
};
```

## API

Declare a benchmark using the `benchmark()` function:

```
    benchmark(<name>, <benchmark-function> [, <options>]);
```

The benchmark function is where you put the code you want to measure.  It should take no arguments and return no result.  A single "sample" of the benchmark may call the benchmark function many times.

The options object can have the following properties (all optional):

```js
{
    minSampleDuration: ...,     // minimum time per sample, in seconds (default: 1)
    minSampleCount: ...;        // minimum number of samples to take (default: 8)
    maxSampleCount: ...;        // maximum number of samples to take or false for no limit (default: 32)
    timeout: ...;               // overall timeout in seconds, or false for no limit (default: false)

    confirmationHeuristic: ...; // settings for the confirmation heuristic, or false to disable it (see below)
    cooldownHeuristic: ...;     // settings for the cooldown heuristic, or false to disable it (see below)
    baselineHeuristic: ...;     // settings for the baseline heuristic, or false to disable it (see below)
}
```

## Heuristics

To get stable benchmark results, HighScore uses a few heuristics to determine when to stop taking samples:

### Confirmation

This heuristic causes HighScore to look for "confirmation" of a benchmark result, by taking samples until it has at least `sampleCount` samples within a certain `variance`.

This heuristic is on by default, and the default settings are:

```js
    confirmationHeuristic: {
        sampleCount: 2,
        variance: 0.008,
    }
```

Which means it will keep running until it gets 2 additional samples within 1% of the best sample so far.

### Cooldown

This heuristic tells HighScore to keep going for `sampleCount` more samples after the last best sample.  This keeps it from ending the benchmark too soon if the samples are just starting to improve.

This heuristic is on by default, and the default settings are:

```js
    cooldownHeuristic: {
        sampleCount: 3,
    }
```

Which means it will not stop the benchmark until it has collected 3 samples after the last best sample.

### Baseline

If you have saved a baseline result for a benchmark, then this heuristic will tell HighScore to collect extra samples (up to `sampleCount`) if necessary to find one that is within a certain `variance` of the baseline result.  This helps to avoid false reports that a benchmark has gotten slower.

This heuristic is on by default, and the default settings are:

```js
    baselineHeuristic: {
        sampleCount: 32,
        variance: 0.01,
    }
```

Which means it will collect up to 32 samples until it gets one within 1% of the baseline result.
