import { compareAgents } from "./commands/compare.js";
import { getRepositoryData } from "./services/github.js";

function printUsage(): void {
  console.log(`
Clarity Agent v0.1

Available commands:

  compare <agent-one> <agent-two>
  github <owner> <repository>

Examples:

  npm run dev -- compare aeon hermes
  npm run dev -- github jsnrdtz clarity-agent
`);
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exit(0);
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

        console.log(compareAgents(firstAgent, secondAgent));
        break;
      }

      case "github": {
        const [owner, repository] = args;

        if (!owner || !repository) {
          throw new Error(
            "Usage: github <owner> <repository>"
          );
        }

        const data = await getRepositoryData(owner, repository);

        console.log(JSON.stringify(data, null, 2));
        break;
      }

      default:
        throw new Error(`Unknown command: "${command}"`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    console.error(`Clarity error: ${message}`);
    process.exit(1);
  }
}

await main();