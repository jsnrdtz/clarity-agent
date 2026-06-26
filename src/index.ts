import { compareAgents } from "./commands/compare.js";
import { compareGitHubRepositories } from "./commands/compare-github.js";
import { scoreRepository } from "./commands/score.js";
import { getRepositoryData } from "./services/github.js";

function printUsage(): void {
  console.log(`
Clarity Agent v0.1

Available commands:

  compare <agent-one> <agent-two>
  github <owner> <repository>
  score <owner> <repository>
  compare-github <owner-one> <repo-one> <owner-two> <repo-two>

Examples:

  npm run dev -- compare aeon hermes
  npm run dev -- github jsnrdtz clarity-agent
  npm run dev -- score octokit octokit.js
  npm run dev -- compare-github octokit octokit.js jsnrdtz clarity-agent
`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    printUsage();
    return;
  }

  try {
    switch (command.toLowerCase()) {
      case "compare": {
        const [firstAgent, secondAgent] = args;

        if (!firstAgent || !secondAgent) {
          throw new Error(
            "Usage: compare <agent-one> <agent-two>"
          );
        }

        const result = compareAgents(
          firstAgent,
          secondAgent
        );

        console.log(result);
        break;
      }

      case "github": {
        const [owner, repository] = args;

        if (!owner || !repository) {
          throw new Error(
            "Usage: github <owner> <repository>"
          );
        }

        const data = await getRepositoryData(
          owner,
          repository
        );

        console.log(JSON.stringify(data, null, 2));
        break;
      }

      case "score": {
        const [owner, repository] = args;

        if (!owner || !repository) {
          throw new Error(
            "Usage: score <owner> <repository>"
          );
        }

        const result = await scoreRepository(
          owner,
          repository
        );

        console.log(result);
        break;
      }

      case "compare-github": {
        const [
          firstOwner,
          firstRepository,
          secondOwner,
          secondRepository
        ] = args;

        if (
          !firstOwner ||
          !firstRepository ||
          !secondOwner ||
          !secondRepository
        ) {
          throw new Error(
            "Usage: compare-github <owner-one> <repo-one> <owner-two> <repo-two>"
          );
        }

        const result =
          await compareGitHubRepositories(
            firstOwner,
            firstRepository,
            secondOwner,
            secondRepository
          );

        console.log(result);
        break;
      }

      default: {
        throw new Error(
          `Unknown command: "${command}"`
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(`Clarity error: ${message}`);
    process.exitCode = 1;
  }
}

await main();