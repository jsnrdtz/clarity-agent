export type AgentScores = {
  overall: number;
  development: number;
  activity: number;
  documentation: number;
  community: number;
  transparency: number;
};

export type AgentRecord = {
  slug: string;
  name: string;
  description: string;
  githubUrl?: string;
  marketCapUsd?: number;
  scores: AgentScores;
  updatedAt: string;
  source: "demo" | "github" | "bankr";
};