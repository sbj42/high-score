import { BenchmarkOptions } from './benchmark-options';

export type Benchmark = {
    name: string;
    version?: string;
    comment?: string;
    setup: undefined | SetupFunction;
    func: BenchmarkFunction;
    divisor?: number;
    options?: BenchmarkOptions;
};

export type SetupFunction = (count: number) => void;
export type BenchmarkFunction = () => void;

const SCOPE: string[] = [];

export function benchmarkGroup(name: string, callback: () => void): void {
    SCOPE.push(name);
    callback();
    SCOPE.pop();
}

const BENCHMARKS: Benchmark[] = [];

export function benchmark(name: string, func: BenchmarkFunction, options?: BenchmarkOptions): void;
export function benchmark(name: string, setup: undefined | SetupFunction, func: BenchmarkFunction, options?: BenchmarkOptions): void;
export function benchmark(name: string, setup: undefined | SetupFunction | BenchmarkFunction, func?: BenchmarkFunction | BenchmarkOptions, options?: BenchmarkOptions): void {
    name = (SCOPE.length ? SCOPE.join('/') + '/' : '') + name;
    if (typeof func === 'function') {
        BENCHMARKS.push({
            name,
            setup,
            func,
            options,
        });
    } else {
        BENCHMARKS.push({
            name,
            setup: undefined,
            func: setup as BenchmarkFunction,
            options: func as BenchmarkOptions | undefined,
        });
    }
}

export function getBenchmarks(): Benchmark[] {
    return BENCHMARKS;
}