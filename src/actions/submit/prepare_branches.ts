import chalk from 'chalk';
import prompts from 'prompts';
import { TContext } from '../../lib/context';
import { TBranchPRInfo } from '../../lib/engine/metadata_ref';
import { getPRBody } from './pr_body';
import { getPRDraftStatus } from './pr_draft';
import { getPRTitle } from './pr_title';
import { getReviewers } from './reviewers';
import { TPRSubmissionInfo } from './submit_prs';

type TPRSubmissionAction = { branchName: string } & (
  | { update: false }
  | {
      update: true;
      prNumber: number;
    }
);

/**
 * For now, we only allow users to update the following PR properties which
 * necessitate a PR update:
 * - the PR base
 * - the PR's code contents
 *
 * Notably, we do not yet allow users to update the PR title, body, etc.
 *
 * Therefore, we should only update the PR iff either of these properties
 * differ from our stored data on the previous PR submission.
 */
export async function getPRInfoForBranches(
  args: {
    branchNames: string[];
    editPRFieldsInline: boolean;
    draft: boolean;
    publish: boolean;
    updateOnly: boolean;
    dryRun: boolean;
    reviewers: boolean;
    select: boolean;
  },
  context: TContext
): Promise<TPRSubmissionInfo> {
  const prActions = [];
  for await (const branchName of args.branchNames) {
    const action = await getPRAction(
      {
        branchName,
        updateOnly: args.updateOnly,
        draft: args.draft,
        publish: args.publish,
        dryRun: args.dryRun,
        select: args.select,
      },
      context
    );
    if (action) {
      prActions.push(action);
    }
  }

  const submissionInfo = [];
  for await (const action of prActions) {
    const parentBranchName = context.metaCache.getParentPrecondition(
      action.branchName
    );
    submissionInfo.push({
      head: action.branchName,
      headSha: context.metaCache.getRevision(action.branchName),
      base: parentBranchName,
      baseSha: context.metaCache.getRevision(parentBranchName),
      ...(action.update
        ? {
            action: 'update' as const,
            prNumber: action.prNumber,
            draft: args.draft ? true : args.publish ? false : undefined,
          }
        : {
            action: 'create' as const,
            ...(await getPRCreationInfo(
              {
                branchName: action.branchName,
                editPRFieldsInline: args.editPRFieldsInline,
                draft: args.draft,
                publish: args.publish,
                reviewers: args.reviewers,
              },
              context
            )),
          }),
    });
  }
  context.splog.newline();
  return submissionInfo;
}

async function getPRAction(
  args: {
    branchName: string;
    updateOnly: boolean;
    draft: boolean;
    publish: boolean;
    dryRun: boolean;
    select: boolean;
  },
  context: TContext
): Promise<TPRSubmissionAction | undefined> {
  // The branch here should always have a parent - above, the branches we've
  // gathered should exclude trunk which ensures that every branch we're submitting
  // a PR for has a valid parent.
  const parentBranchName = context.metaCache.getParentPrecondition(
    args.branchName
  );
  const prInfo = context.metaCache.getPrInfo(args.branchName);
  const prNumber = prInfo?.number;

  const calculatedStatus =
    prNumber === undefined
      ? args.updateOnly
        ? 'NOOP'
        : 'CREATE'
      : parentBranchName !== prInfo?.base
      ? 'RESTACK'
      : !context.metaCache.branchMatchesRemote(args.branchName)
      ? 'CHANGE'
      : args.draft === true && prInfo.isDraft !== true
      ? 'DRAFT'
      : args.publish === true && prInfo.isDraft !== false
      ? 'PUBLISH'
      : 'NOOP';

  const status =
    !args.select ||
    calculatedStatus === 'NOOP' ||
    (await selectBranch(args.branchName))
      ? calculatedStatus
      : 'NOOP';

  context.splog.info(
    {
      NOOP: `▸ ${chalk.gray(args.branchName)} (No-op)`,
      CREATE: `▸ ${chalk.cyan(args.branchName)} (Create)`,
      RESTACK: `▸ ${chalk.cyan(args.branchName)} (New parent)`,
      CHANGE: `▸ ${chalk.cyan(args.branchName)} (Update)`,
      DRAFT: `▸ ${chalk.blueBright(args.branchName)} (Mark as draft)`,
      PUBLISH: `▸ ${chalk.blueBright(args.branchName)} (Ready for review)`,
    }[status]
  );

  return args.dryRun || status === 'NOOP'
    ? undefined
    : {
        branchName: args.branchName,
        ...(prNumber === undefined
          ? { update: false }
          : { update: true, prNumber }),
      };
}

async function selectBranch(branchName: string): Promise<boolean> {
  const result = (
    await prompts({
      name: 'value',
      initial: true,
      type: 'confirm',
      message: `Would you like to submit ${chalk.cyan(branchName)}?`,
    })
  ).value;
  // Clear the prompt result
  process.stdout.moveCursor(0, -1);
  process.stdout.clearLine(1);
  return result;
}

async function getPRCreationInfo(
  args: {
    branchName: string;
    editPRFieldsInline: boolean;
    draft: boolean;
    publish: boolean;
    reviewers: boolean;
  },
  context: TContext
): Promise<{
  title: string;
  body: string;
  reviewers: string[];
  draft: boolean;
}> {
  if (args.editPRFieldsInline) {
    context.splog.newline();
    context.splog.info(
      `Enter info for new pull request for ${chalk.cyan(
        args.branchName
      )} ▸ ${chalk.blueBright(
        context.metaCache.getParentPrecondition(args.branchName)
      )}:`
    );
  }

  const submitInfo: TBranchPRInfo = {};

  try {
    submitInfo.title = await getPRTitle(
      {
        branchName: args.branchName,
        editPRFieldsInline: args.editPRFieldsInline,
      },
      context
    );

    submitInfo.body = await getPRBody(
      {
        branchName: args.branchName,
        editPRFieldsInline: args.editPRFieldsInline,
      },
      context
    );
  } finally {
    // Save locally in case this command fails
    context.metaCache.upsertPrInfo(args.branchName, submitInfo);
  }

  const reviewers = await getReviewers({
    fetchReviewers: args.reviewers,
  });

  const createAsDraft = args.publish
    ? false
    : args.draft || !context.interactive
    ? true
    : await getPRDraftStatus(context);

  return {
    title: submitInfo.title,
    body: submitInfo.body,
    reviewers,
    draft: createAsDraft,
  };
}
