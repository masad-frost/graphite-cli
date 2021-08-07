import { Stack, stackNodeT } from ".";
import { repoConfig } from "../lib/config";
import { getTrunk } from "../lib/utils";
import Branch from "./branch";

export abstract class AbstractStackBuilder {
  public allStacksFromTrunk(): Stack[] {
    const baseBranches = this.allStackBaseNames();
    return baseBranches.map(this.fullStackFromBranch);
  }

  public abstract fullStackFromBranch(branch: Branch): Stack;

  public upstackInclusiveFromBranchWithParents(branch: Branch): Stack {
    const stack = this.fullStackFromBranch(branch);

    // Traverse to find the source node and set;
    let possibleSourceNodes = [stack.source];
    while (possibleSourceNodes.length > 0) {
      const node = possibleSourceNodes.pop();
      if (!node) {
        throw new Error("Stack missing source node, shouldnt happen");
      }
      if (node.branch.name === branch.name) {
        stack.source = node;
        break;
      }
      possibleSourceNodes = possibleSourceNodes.concat(node.children);
    }
    return stack;
  }

  public upstackInclusiveFromBranchWithoutParents(branch: Branch): Stack {
    const sourceNode: stackNodeT = {
      branch,
      parents: [],
      children: [],
    };

    let nodes: stackNodeT[] = [sourceNode];
    do {
      const curNode = nodes.pop();
      if (!curNode) {
        break;
      }
      curNode.children = this.getChildrenForBranch(curNode.branch).map(
        (child) => {
          return { branch: child, parents: [curNode], children: [] };
        }
      );
      nodes = nodes.concat(curNode.children);
    } while (nodes.length > 0);

    return new Stack(sourceNode);
  }

  protected allStackBaseNames(): Branch[] {
    const allBranches = Branch.allBranches();
    const allStackBaseNames = allBranches
      .filter(
        (b) =>
          !repoConfig.getIgnoreBranches().includes(b.name) &&
          b.name != getTrunk().name
      )
      .map((b) => this.getStackBaseBranch(b).name);
    const uniqueStackBaseNames = [...new Set(allStackBaseNames)];
    return uniqueStackBaseNames.map((bn) => new Branch(bn));
  }

  protected abstract getStackBaseBranch(branch: Branch): Branch;
  protected abstract getChildrenForBranch(branch: Branch): Branch[];
  protected abstract getParentsForBranch(branch: Branch): Branch[];
}