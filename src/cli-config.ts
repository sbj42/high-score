export type HighScoreConfig = {

    benchmarkPaths?: string | string[];
    excludePaths?: string | string[];

    rootDir?: string;
    logDir?: string;

    moduleName?: string;
    moduleVersion?: string;

    timeout?: number;

};