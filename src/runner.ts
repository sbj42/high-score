import { Benchmark } from './catalog';
import { BenchmarkOptions } from './benchmark-options';
import { HistoryEntry } from './history';

export type RunBenchmarkOptions = Omit<Required<BenchmarkOptions>, 'runsPerSample'> & {
    runsPerSample: number | undefined;
};

export type BenchmarkProgress = {
    sampleCount: number;
    runsPerSample: number;
    waitingForHeuristic: undefined | HeuristicStatus;
};

export type BenchmarkResult = {
    sampleCount: number;
    runsPerSample: number;
    frequency: number;
    aborted: undefined | 'timeout' | 'maxSampleCount';
    failedHeuristic: undefined | HeuristicStatus;
}

export type HeuristicStatus = {
    heuristic: 'confirmation';
    confirmingSamples: number;
    currentVariance: number;
} | {
    heuristic: 'cooldown',
    samplesSinceBest: number;
} | {
    heuristic: 'baseline';
    currentVariance: number;
};

function measure(benchmark: Benchmark, runCount: number) {
    const { setup, func, divisor } = benchmark;
    const rand = Math.floor(Math.random() * 100000000);
    if (setup) {
        setup(runCount);
    }
    const compiled = new Function('func', `
        const begin_${rand} = process.hrtime.bigint();
        let runCount = ${runCount};
        while (runCount--) {
            func();
        }
        return process.hrtime.bigint() - begin_${rand};
    `);
    return Number(compiled(func)) / 1000000000 / (divisor || 1);
}

function getVariance(current: number, target: number) {
    return (current - target) / target;
}

function getVarianceAt(samples: number[], sampleCount: number) {
    return getVariance(samples[sampleCount - 1], samples[0]);
}

function countConfirmingSamples(samples: number[], variance: number) {
    for (let i = 1; i < samples.length; i ++) {
        if (getVarianceAt(samples, i + 1) > variance) {
            return i - 1;
        }
    }
    return samples.length - 1;
}

export function runBenchmark(benchmark: Benchmark, options: RunBenchmarkOptions, baseline: HistoryEntry | undefined, onProgress: (progress: BenchmarkProgress) => void): BenchmarkResult {
    const {
        minSampleDuration,
        minSampleCount,
        maxSampleCount,
        timeout,
        confirmationHeuristic,
        cooldownHeuristic,
        baselineHeuristic,
    } = options;
    const start = Date.now();
    let runsPerSample = options.runsPerSample;
    if (!runsPerSample) {
        runsPerSample = 1;
        for (;;) {
            const begin = process.hrtime.bigint();
            measure(benchmark, runsPerSample);
            const end = process.hrtime.bigint();
            const duration = Number(end - begin) / 1000000000;
            if (duration >= minSampleDuration) {
                break;
            }
            if (runsPerSample > Number.MAX_SAFE_INTEGER / 2) {
                throw new Error(`benchmark "${name}" is too fast, or minSampleDuration is too large`);
            }
            runsPerSample *= 2;
        }
    }
    const samples: number[] = [];
    let samplesSinceBest = 0;
    const progress: BenchmarkProgress = {
        sampleCount: 0,
        runsPerSample,
        waitingForHeuristic: undefined,
    };
    let aborted: BenchmarkResult['aborted'];
    for (;;) {
        progress.sampleCount = samples.length;
        onProgress({ ...progress });
        const sample = measure(benchmark, runsPerSample);
        if (samples.length === 0 || sample < samples[0]) {
            samplesSinceBest = 0;
        } else {
            samplesSinceBest ++;
        }
        samples.push(sample);
        samples.sort();
        if (timeout && (Date.now() - start) / 1000 > timeout) {
            aborted = 'timeout';
        }
        if (samples.length >= minSampleCount) {
            progress.waitingForHeuristic = undefined;
            if (baseline && baselineHeuristic) {
                const currentVariance = getVariance(runsPerSample / samples[0], baseline.result.frequency);
                if (currentVariance < -baselineHeuristic.variance) {
                    progress.waitingForHeuristic = {
                        heuristic: 'baseline',
                        currentVariance,
                    };
                    if (samples.length < baselineHeuristic.sampleCount) {
                        if (aborted !== 'timeout') {
                            continue;
                        }
                    }
                }
            }
            if (cooldownHeuristic) {
                if (samplesSinceBest < cooldownHeuristic.sampleCount) {
                    progress.waitingForHeuristic = {
                        heuristic: 'cooldown',
                        samplesSinceBest,
                    };
                }
            }
            if (confirmationHeuristic) {
                const confirmingSamples = countConfirmingSamples(samples, confirmationHeuristic.variance);
                if (confirmingSamples < confirmationHeuristic.sampleCount) {
                    const currentVariance = getVarianceAt(samples, confirmationHeuristic.sampleCount + 1);
                    progress.waitingForHeuristic = {
                        heuristic: 'confirmation',
                        confirmingSamples,
                        currentVariance,
                    };
                }
            }
        }
        if (aborted === 'timeout') {
            break;
        }
        if (samples.length < minSampleCount) {
            continue;
        }
        if (maxSampleCount !== false && samples.length >= maxSampleCount) {
            aborted = 'maxSampleCount';
            break;
        }
        break;
    }
    return {
        frequency: runsPerSample / samples[0],
        sampleCount: samples.length,
        runsPerSample,
        aborted,
        failedHeuristic: progress.waitingForHeuristic,
    };
}