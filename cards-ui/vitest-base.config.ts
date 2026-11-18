import { defineConfig } from 'vitest/config';

// Angular runs spec files without isolation by default, so files sharing a worker share modules and
// a vi.mock (e.g. of aws-amplify) in one cannot replace a module another already loaded. Which files
// share a worker depends on the machine's cores, so the tests passed locally but failed in CI.
//
// Node 25 and later define a global localStorage of their own, which is undefined without
// --localstorage-file and hides the test DOM's; turning it off keeps the DOM's in every Node version.
export default defineConfig({ test: { isolate: true, execArgv: ['--no-experimental-webstorage'] } });
