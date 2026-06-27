export type PublicDevelopmentVisibility =
  | "public-heavy"
  | "partial"
  | "unknown";

export type AgentEvidenceProfile = {
  visibility: PublicDevelopmentVisibility;
  privacySensitive: boolean;
  note: string;
};

const DEFAULT_PROFILE: AgentEvidenceProfile = {
  visibility: "unknown",
  privacySensitive: false,
  note:
    "The completeness of public development evidence has not been verified."
};

const AGENT_EVIDENCE_PROFILES: Record<
  string,
  AgentEvidenceProfile
> = {
  aeon: {
    visibility: "public-heavy",
    privacySensitive: false,
    note:
      "The current project structure is represented by multiple active public core repositories."
  },

  prxvt: {
    visibility: "partial",
    privacySensitive: true,
    note:
      "Public GitHub evidence is treated as partial. This does not prove that private repositories exist, but the visible SDK may not represent the complete product."
  }
};

export function getAgentEvidenceProfile(
  agentSlug: string
): AgentEvidenceProfile {
  return (
    AGENT_EVIDENCE_PROFILES[
      agentSlug.trim().toLowerCase()
    ] ?? DEFAULT_PROFILE
  );
}