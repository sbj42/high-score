export type BenchmarkOptions = {
    minSampleDuration?: number;
    minSampleCount?: number;
    maxSampleCount?: number | false;
    timeout?: number | false;

    runsPerSample?: number;

    confirmationHeuristic?: {
        sampleCount: number;
        variance: number;
    } | false;

    cooldownHeuristic?: {
        sampleCount: number;
    } | false;

    baselineHeuristic?: {
        sampleCount: number;
        variance: number;
    } | false;
};