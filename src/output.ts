import { HistoryEntry } from './history';
import { BenchmarkProgress, BenchmarkResult } from './runner';

function rpadString(str: string, len: number) {
    while (str.length < len) {
        str = str + ' ';
    }
    return str;
}

function formatFloat(val: number, maxLength: number): string {
    let str = '';
    for (let maximumFractionDigits = 0; str.length < maxLength; maximumFractionDigits ++) {
        str = val.toLocaleString(undefined, { maximumFractionDigits });
    }
    return str;
}

function formatCount(val: number): string {
    return val.toLocaleString(undefined);
}

function formatFrequency(val: number): string {
    return formatFloat(val, 6);
}

function formatPercentage(val: number): string {
    const str = formatFloat(val, 3) + '%';
    if (str[0] !== '-') {
        return '+' + str;
    }
    return str;
}

const BOL = '\r';
const CLR = '\u001B[K';

function printSameLine(msg: string) {
    process.stdout.write(`${BOL}${CLR}${msg}`);
}

export function printProgress(name: string, progress: BenchmarkProgress): void {
    if (!progress.sampleCount) {
        printSameLine(`${name}: collecting samples...`);
    } else if (progress.waitingForHeuristic?.heuristic === 'cooldown') {
        printSameLine(`${name}: (${formatCount(progress.sampleCount)}) waiting for cooldown (${progress.waitingForHeuristic.samplesSinceBest})...`);
    } else if (progress.waitingForHeuristic?.heuristic === 'confirmation') {
        printSameLine(`${name}: (${formatCount(progress.sampleCount)}) waiting for confirmation (${progress.waitingForHeuristic.confirmingSamples})...`);
    } else if (progress.waitingForHeuristic?.heuristic === 'baseline') {
        printSameLine(`${name}: (${formatCount(progress.sampleCount)}) trying to meet the baseline (${formatPercentage(progress.waitingForHeuristic.currentVariance * 100)})...`);
    } else {
        printSameLine(`${name}: (${formatCount(progress.sampleCount)}) collecting samples...`);
    }
}

export function printResult(name: string, longestNameLength: number, result: BenchmarkResult, baseline: HistoryEntry | undefined): void {
    const padded = rpadString(`${name}:`, longestNameLength + 1);
    printSameLine(`${padded} ${formatFrequency(result.frequency)} runs/sec`);
    if (baseline) {
        const baselineFrequency = baseline.result.frequency;
        process.stdout.write(` ${formatPercentage((result.frequency - baselineFrequency) * 100 / baselineFrequency)}`);
    }
    if (result.aborted) {
        if (result.aborted === 'timeout') {
            process.stdout.write(` (timed out`);
        } else if (result.aborted === 'maxSampleCount') {
            process.stdout.write(` (gave up`);
        }
        if (result.failedHeuristic) {
            process.stdout.write(`, failed ${result.failedHeuristic.heuristic}`);
        } else {
            process.stdout.write(`, not enough samples`);
        }
        process.stdout.write(`)`);
    }
    process.stdout.write(`\n`);
}