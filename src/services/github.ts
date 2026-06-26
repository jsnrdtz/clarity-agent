import { Octokit } from "octokit";

const octokit = new Octokit();

export type GitHubRepositoryData = {
  owner: string;
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  url: string;
};

export async function getRepositoryData(
  owner: string,
  repo: string
): Promise<GitHubRepositoryData> {
  const response = await octokit.rest.repos.get({
    owner,
    repo
  });

  const repository = response.data;

  return {
    owner: repository.owner.login,
    name: repository.name,
    description: repository.description,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    openIssues: repository.open_issues_count,
    language: repository.language,
    defaultBranch: repository.default_branch,
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at,
    url: repository.html_url
  };
}