export interface InitOptions {
  quick?: boolean;
  id?: string;
  title?: string;
  maxRounds?: number;
  keepSessionOnError?: boolean;
}

export interface InitPayload {
  manifest: { id: string; title: string };
  canon: {
    'premise.md': string;
    'rules.md': string;
    'style.md': string;
    'user_role.md': string;
  };
  state: {
    'world.yaml': string;
    'calendar.yaml'?: string;
  };
  characters: Array<{
    id: string;
    profileYaml: string;
    relationshipsYaml?: string;
  }>;
  scenes?: Array<{
    id: string;
    profileYaml: string;
  }>;
}

export interface InterviewStatus {
  status: 'continue' | 'ready';
  missing: string[];
}

export interface InitSession {
  root: string;
  messagesDir: string;
  round: number;
}
