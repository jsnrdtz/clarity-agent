import { calculateGitHubScore } from "../scoring/github-score.js";
import { getRepositoryData } from "../services/github.js";

export async function scoreRepository(
  owner: string,
  repositoryName: string
): Promise<string> {
  const repository = await getRepositoryData(
    owner,
    repositoryName
  );

  const score = calculateGitHubScore(repository);

  return [
    "CLARITY GITHUB SCORE",
    "GitHub data only — not a complete Clarity rating",
    "",
    `${repository.owner}/${repository.name}`,
    "",
    `Overall             ${score.overall}/100`,
    `Current Activity    ${score.activity}/100`,
    `Collaboration       ${score.collaboration}/100`,
    `Adoption            ${score.adoption}/100`,
    `Release Discipline  ${score.releases}/100`,
    "",
    `Data Coverage       ${score.dataCoverage}%`,
    "",
    "Evidence:",
    ...score.evidence.map((item) => `- ${item}`),
    "",
    `Repository: ${repository.url}`,
    `Collected: ${new Date().toISOString()}`
  ].join("\n");
}