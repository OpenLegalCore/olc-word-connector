export type TaskPaneTone = "neutral" | "info" | "success" | "warning" | "danger";
export type TaskPaneEnvironment = "DEVELOPMENT" | "STAGING";
export type TaskPaneActionVariant = "primary" | "secondary" | "quiet";

export interface TaskPaneAction {
  id: string;
  label: string;
  variant: TaskPaneActionVariant;
  disabled?: boolean;
}

export interface TaskPaneStatus {
  label: string;
  detail: string;
  tone: TaskPaneTone;
  action?: TaskPaneAction;
}

export interface TaskPaneFieldFixture {
  id: string;
  label: string;
  value: string;
  help?: string;
  kind?: "text" | "password" | "textarea";
  readOnly?: boolean;
  placeholder?: string;
}

export interface TaskPaneChoice {
  value: string;
  label: string;
  checked?: boolean;
}

export interface TaskPaneChoiceGroup {
  name: string;
  label: string;
  choices: readonly TaskPaneChoice[];
}

export interface TaskPaneNotice {
  title: string;
  message: string;
  tone: TaskPaneTone;
  role?: "alert" | "status";
}

export interface TaskPaneFooter {
  eyebrow: string;
  message: string;
  actions?: readonly TaskPaneAction[];
}

export interface TaskPaneViewModel {
  id: string;
  environment?: TaskPaneEnvironment;
  busy?: boolean;
  status: TaskPaneStatus;
  eyebrow?: string;
  heading: string;
  description?: string;
  fields?: readonly TaskPaneFieldFixture[];
  choiceGroup?: TaskPaneChoiceGroup;
  legalAnswer?: string;
  notice?: TaskPaneNotice;
  actions?: readonly TaskPaneAction[];
  footer: TaskPaneFooter;
}
