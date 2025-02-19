import chalk from 'chalk';

export class ExitFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExitFailed';
  }
}

export class RebaseConflictError extends Error {
  constructor() {
    super(`Hit a conflict during rebase.`);
    this.name = 'RebaseConflict';
  }
}

export class PreconditionsFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreconditionsFailed';
  }
}

export class ConcurrentExecutionError extends Error {
  constructor() {
    super(`Cannot run more than one Graphite process at once.`);
    this.name = 'ConcurrentExecutionError';
  }
}

export class DetachedError extends Error {
  constructor() {
    super(`Cannot perform this operation without a branch checked out.`);
    this.name = 'DetachedError';
  }
}

export class NoBranchError extends Error {
  constructor(branchName: string) {
    super(`Could not find branch ${chalk.yellow(branchName)}.`);
    this.name = 'NoBranchError';
  }
}

export class UntrackedBranchError extends Error {
  constructor(branchName: string) {
    super(
      [
        `Cannot perform this operation on untracked branch ${chalk.yellow(
          branchName
        )}.`,
        `You can track it by specifying its parent with ${chalk.cyan(
          `gt branch track`
        )}.`,
      ].join('\n')
    );
    this.name = 'UntrackedBranchError';
  }
}

export class BadTrunkOperationError extends Error {
  constructor() {
    super(`Cannot perform this operation on the trunk branch.`);
    this.name = 'BadTrunkOperationError';
  }
}

export class KilledError extends Error {
  constructor() {
    super(`Killed Graphite early.`);
    this.name = 'Killed';
  }
}
