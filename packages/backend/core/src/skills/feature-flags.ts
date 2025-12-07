type SkillFlag = {
  rawValue: string;
  normalized: string;
};

const normalize = (value: string): string => value.trim().toLowerCase();

const parseSkillList = (value: string | undefined): SkillFlag[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => ({
      rawValue: entry,
      normalized: normalize(entry),
    }));
};

const resolveFlagState = () => {
  const experimentalSkills = parseSkillList(process.env.SKILL_ADAPTER_EXPERIMENTAL);
  const allowAll =
    experimentalSkills.length === 0 ||
    experimentalSkills.some(flag => flag.normalized === 'all' || flag.normalized === '*');

  return {
    allowAll,
    experimentalSkills,
  };
};

export function isSkillInExperiment(skillName: string): boolean {
  const { allowAll, experimentalSkills } = resolveFlagState();

  if (allowAll) {
    return true;
  }

  const normalized = normalize(skillName);
  return experimentalSkills.some(flag => flag.normalized === normalized);
}

export function getSkillFlagSnapshot(): {
  allowAll: boolean;
  experimentalSkills: string[];
} {
  const { allowAll, experimentalSkills } = resolveFlagState();

  return {
    allowAll,
    experimentalSkills: experimentalSkills.map(flag => flag.rawValue),
  };
}
