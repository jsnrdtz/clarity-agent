import {
  evaluateAgentJson
} from "./commands/evaluate.js";

import {
  inspectEvidence
} from "./commands/evidence.js";

import {
compareAgents
} from "./commands/compare.js";

import {
compareGitHubRepositories
} from "./commands/compare-github.js";

import {
discoverGitHub
} from "./commands/discover-github.js";

import {
discoverProject
} from "./commands/discover-project.js";

import {
discoverRelated
} from "./commands/discover-related.js";

import {
planProject
} from "./commands/plan-project.js";

import {
rateAgent
} from "./commands/rate.js";

import {
scoreProject
} from "./commands/score-project.js";

import {
scoreRepository
} from "./commands/score.js";

import {
getTopAgents
} from "./commands/top.js";

import {
listRegisteredAgents
} from "./data/agent-registry.js";

import {
getRepositoryData
} from "./services/github.js";

function printUsage(): void {
console.log(`
Clarity Agent v0.2

Available commands:

agents
top
rate <agent>
compare <agent-one> <agent-two>
  evidence <agent>
  evaluate <agent> [--json]
discover-github <owner>
discover-related <owner> <anchor-repository>
discover-project <brand> <owner> <anchor-repository>
plan-project <brand> <owner> <anchor-repository>
score-project <brand> <owner> <anchor-repository>
github <owner> <repository>
score <owner> <repository>
compare-github <owner-one> <repo-one> <owner-two> <repo-two>

Examples:

npm run dev -- agents
npm run dev -- top
npm run dev -- rate aeon
npm run dev -- compare aeon prxvt
  npm run dev -- evidence aeon
  npm run dev -- evaluate aeon --json
  npm run dev -- evidence prxvt
npm run dev -- discover-github PRXVT
npm run dev -- discover-related aaronjmars aeon
npm run dev -- discover-project PRXVT PRXVT sdk
npm run dev -- discover-project Aeon aaronjmars aeon
npm run dev -- plan-project PRXVT PRXVT sdk
npm run dev -- plan-project Aeon aaronjmars aeon
npm run dev -- score-project PRXVT PRXVT sdk
npm run dev -- score-project Aeon aaronjmars aeon
npm run dev -- github aaronjmars aeon
npm run dev -- score PRXVT sdk
npm run dev -- compare-github aaronjmars aeon PRXVT sdk
`);
}

async function main(): Promise<void> {
const [command, ...args] =
process.argv.slice(2);

if (!command) {
printUsage();
return;
}

try {
switch (command.toLowerCase()) {

      case "evaluate": {
        const [
          agentSlug,
          formatFlag
        ] = args;

        if (!agentSlug) {
          throw new Error(
            "Usage: evaluate <agent> [--json]"
          );
        }

        if (
          formatFlag &&
          formatFlag !== "--json"
        ) {
          throw new Error(
            `Unknown evaluate option: "${formatFlag}"`
          );
        }

        const result =
          await evaluateAgentJson(
            agentSlug
          );

        console.log(result);
        break;
      }


      case "evidence": {
        const [agentSlug] = args;

        if (!agentSlug) {
          throw new Error(
            "Usage: evidence <agent>"
          );
        }

        const result =
          await inspectEvidence(
            agentSlug
          );

        console.log(result);
        break;
      }

case "agents": {
const agents =
listRegisteredAgents();


    console.log(
      "REGISTERED CLARITY AGENTS\n"
    );

    for (const agent of agents) {
      console.log(
        `${agent.slug.padEnd(10)} ${agent.name}`
      );

      console.log(
        `           GitHub: ${agent.github.owner}/${agent.github.repository}`
      );

      console.log(
        `           Scope: ${agent.github.scope}\n`
      );
    }

    break;
  }

  case "top": {
    const result =
      await getTopAgents();

    console.log(result);
    break;
  }

  case "rate": {
    const [agentSlug] = args;

    if (!agentSlug) {
      throw new Error(
        "Usage: rate <agent>"
      );
    }

    const result =
      await rateAgent(agentSlug);

    console.log(result);
    break;
  }

  case "compare": {
    const [
      firstAgent,
      secondAgent
    ] = args;

    if (
      !firstAgent ||
      !secondAgent
    ) {
      throw new Error(
        "Usage: compare <agent-one> <agent-two>"
      );
    }

    const result =
      await compareAgents(
        firstAgent,
        secondAgent
      );

    console.log(result);
    break;
  }

  case "discover-github": {
    const [owner] = args;

    if (!owner) {
      throw new Error(
        "Usage: discover-github <owner>"
      );
    }

    const result =
      await discoverGitHub(owner);

    console.log(result);
    break;
  }

  case "discover-related": {
    const [
      owner,
      anchorRepository
    ] = args;

    if (
      !owner ||
      !anchorRepository
    ) {
      throw new Error(
        "Usage: discover-related <owner> <anchor-repository>"
      );
    }

    const result =
      await discoverRelated(
        owner,
        anchorRepository
      );

    console.log(result);
    break;
  }

  case "discover-project": {
    const [
      brand,
      owner,
      anchorRepository
    ] = args;

    if (
      !brand ||
      !owner ||
      !anchorRepository
    ) {
      throw new Error(
        "Usage: discover-project <brand> <owner> <anchor-repository>"
      );
    }

    const result =
      await discoverProject(
        brand,
        owner,
        anchorRepository
      );

    console.log(result);
    break;
  }

  case "plan-project": {
    const [
      brand,
      owner,
      anchorRepository
    ] = args;

    if (
      !brand ||
      !owner ||
      !anchorRepository
    ) {
      throw new Error(
        "Usage: plan-project <brand> <owner> <anchor-repository>"
      );
    }

    const result =
      await planProject(
        brand,
        owner,
        anchorRepository
      );

    console.log(result);
    break;
  }

  case "score-project": {
    const [
      brand,
      owner,
      anchorRepository
    ] = args;

    if (
      !brand ||
      !owner ||
      !anchorRepository
    ) {
      throw new Error(
        "Usage: score-project <brand> <owner> <anchor-repository>"
      );
    }

    const result =
      await scoreProject(
        brand,
        owner,
        anchorRepository
      );

    console.log(result);
    break;
  }

  case "github": {
    const [
      owner,
      repository
    ] = args;

    if (!owner || !repository) {
      throw new Error(
        "Usage: github <owner> <repository>"
      );
    }

    const data =
      await getRepositoryData(
        owner,
        repository
      );

    console.log(
      JSON.stringify(data, null, 2)
    );

    break;
  }

  case "score": {
    const [
      owner,
      repository
    ] = args;

    if (!owner || !repository) {
      throw new Error(
        "Usage: score <owner> <repository>"
      );
    }

    const result =
      await scoreRepository(
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


console.error(
  `Clarity error: ${message}`
);

process.exitCode = 1;


}
}

await main();
