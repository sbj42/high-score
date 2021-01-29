import * as fs from 'fs';
import * as path from 'path';
import { BenchmarkResult, RunBenchmarkOptions } from './runner';

export type HistoryEntry = {
    timestamp: string;
    result: BenchmarkResult;
    options: RunBenchmarkOptions;
    environment: BenchmarkEnvironment;
    comment?: string;
    version?: string;
};

export type History = {
    logVersion: string;
    name: string;
    entries: HistoryEntry[];
    baseline?: number;
}

export type BenchmarkEnvironment = {
    nodeVersion: string;
    runnerVersion: string;
    moduleName?: string;
    moduleVersion?: string;
}

const VERSION_CURRENT = '0.1.0';

export function loadHistory(file: string, name: string): History  {
    if (!fs.existsSync(file)) {
        return {
            logVersion: VERSION_CURRENT,
            name,
            entries: [],
        };
    }
    const text = fs.readFileSync(file, 'utf8');
    const json = JSON.parse(text);
    const history = json as History;
    if (history.logVersion !== VERSION_CURRENT) {
        throw new Error(`Unexpected version in history file ${file}`);
    }
    return history;
}

export function saveHistory(history: History, file: string): void {
    makeParents(file);
    const text = JSON.stringify(history, undefined, 2);
    fs.writeFileSync(file, text, 'utf8');
}

function makeParents(file: string) {
    const parent = path.dirname(file);
    if (!parent) {
        return;
    }
    if (fs.existsSync(parent)) {
        return;
    }
    makeParents(parent);
    fs.mkdirSync(parent);
}