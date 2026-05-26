export type CommandActionType = 'query' | 'modal' | 'url' | 'local';

export interface CommandAction {
  type: CommandActionType;
  label: string;
  url?: string;
  params?: Record<string, unknown>;
}

export interface Command {
  id: string;
  command: string;
  text: string;
  icon: string;
  description: string;
  action: CommandAction;
}
