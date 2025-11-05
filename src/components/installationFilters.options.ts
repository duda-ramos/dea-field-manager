export type InstallationSortOption =
  | "code-asc"
  | "code-desc"
  | "tipologia-asc"
  | "tipologia-desc"
  | "status-pending"
  | "updated-recent"
  | "pavimento";

export const INSTALLATION_SORT_OPTIONS: Array<{ value: InstallationSortOption; label: string }> = [
  { value: "code-asc", label: "Código (crescente)" },
  { value: "code-desc", label: "Código (decrescente)" },
  { value: "tipologia-asc", label: "Tipologia (A-Z)" },
  { value: "tipologia-desc", label: "Tipologia (Z-A)" },
  { value: "status-pending", label: "Status (pendentes primeiro)" },
  { value: "updated-recent", label: "Atualização recente" },
  { value: "pavimento", label: "Pavimento" },
];

export const DEFAULT_INSTALLATION_SORT_OPTION: InstallationSortOption = "code-asc";
