/**
 * Side-effect CSS imports. The application entry pulls in the FUI utility
 * stylesheet for its build side effect only — Vite owns the pipeline and
 * nothing reads a value back, so the module carries no exports.
 */
declare module '*.css' {}
