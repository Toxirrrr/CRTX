export enum SkillStage {
  Planning = 'Planning',
  Architecture = 'Architecture',
  Engineering = 'Engineering',
  UX = 'UX',
  Infrastructure = 'Infrastructure',
  Learning = 'Learning',
}

export enum Priority {
  P0 = 'P0',
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export interface SkillMetadata {
  id: string;
  version: string;
  stage: SkillStage;
  priority: Priority;
  depends: string[];
}

export interface SkillDefinition {
  metadata: SkillMetadata;
  source: string;
}
