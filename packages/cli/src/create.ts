// Entry point for `@bull-js/create` (`npm create @bull-js`): the same `create` as `bull create`.
export {
  type CreateOptions,
  createCommand,
  detectPackageManager,
  type PackageManager,
  runScript,
  type ScaffoldOptions,
  scaffoldProject,
} from "./commands/create";
