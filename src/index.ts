import { compareAgents } from "./commands/compare.js";

function printUsage(): void {
  console.log(`
Clarity Agent v0.1

Available commands:

  compare <agent-one> <agent-two>

Examples:

  npm run dev -- compare aeon hermes
  npm run dev -- compare clawbank aeon
`);
}

function main(): void {
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

main();