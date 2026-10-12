// Entry point for `@bull/create` (`npm create @bull`): the same `create` as `bull create`.
export {
  type CreateOptions,
  createCommand,
  detectPackageManager,
  type PackageManager,
  runScript,
  type ScaffoldOptions,
  scaffoldProject,
} from "./commands/create";
