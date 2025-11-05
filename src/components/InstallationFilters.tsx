import { ChangeEvent, useMemo, useRef } from "react";
import { Search, Filter, ChevronDown, Upload, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Installation } from "@/types";
import {
  INSTALLATION_SORT_OPTIONS,
  type InstallationSortOption,
} from "./installationFilters.options";

interface InstallationFiltersProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: "all" | "installed" | "pending";
  onStatusFilterChange: (value: "all" | "installed" | "pending") => void;
  itemStatusFilter: NonNullable<Installation["status"]> | "all";
  onItemStatusFilterChange: (value: NonNullable<Installation["status"]> | "all") => void;
  pavimentos: string[];
  pavimentoFilter: string;
  onPavimentoFilterChange: (value: string) => void;
  sortOption: InstallationSortOption;
  onSortOptionChange: (value: InstallationSortOption) => void;
  groupByTipologia: boolean;
  onGroupByTipologiaChange: (value: boolean) => void;
  onResetFilters: () => void;
  isImporting: boolean;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function InstallationFilters({
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  itemStatusFilter,
  onItemStatusFilterChange,
  pavimentos,
  pavimentoFilter,
  onPavimentoFilterChange,
  sortOption,
  onSortOptionChange,
  groupByTipologia,
  onGroupByTipologiaChange,
  onResetFilters,
  isImporting,
  onFileUpload,
}: InstallationFiltersProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasPavimentoSort = pavimentos.length > 1;

  const availableSortOptions = useMemo(() => {
    if (hasPavimentoSort) {
      return INSTALLATION_SORT_OPTIONS;
    }
    return INSTALLATION_SORT_OPTIONS.filter(option => option.value !== "pavimento");
  }, [hasPavimentoSort]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por código, tipologia..."
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar Excel
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileUpload}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 justify-between min-w-[150px]" aria-label="Abrir filtros">
                  <Filter className="h-4 w-4 mr-2" />
                  Filtros
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <div className="p-2 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(event) => onStatusFilterChange(event.target.value as InstallationFiltersProps["statusFilter"])}
                      className="w-full px-2 py-1 border border-input bg-background rounded text-sm"
                    >
                      <option value="all">Todos</option>
                      <option value="installed">Instalados</option>
                      <option value="pending">Pendentes</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Situação do item</label>
                    <select
                      value={itemStatusFilter}
                      onChange={(event) => onItemStatusFilterChange(event.target.value as InstallationFiltersProps["itemStatusFilter"])}
                      className="w-full px-2 py-1 border border-input bg-background rounded text-sm"
                    >
                      <option value="all">Todas</option>
                      <option value="ativo">Ativo</option>
                      <option value="on hold">Em espera</option>
                      <option value="cancelado">Cancelado</option>
                      <option value="pendente">Pendente</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Pavimento</label>
                    <select
                      value={pavimentoFilter}
                      onChange={(event) => onPavimentoFilterChange(event.target.value)}
                      className="w-full px-2 py-1 border border-input bg-background rounded text-sm"
                    >
                      <option value="all">Todos</option>
                      {pavimentos.map((pavimento) => (
                        <option key={pavimento} value={pavimento}>
                          {pavimento}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex gap-2 sm:items-center">
            <Label htmlFor="installation-sort" className="text-xs text-muted-foreground sm:text-sm">
              Ordenar por:
            </Label>
            <Select value={sortOption} onValueChange={(value: InstallationSortOption) => onSortOptionChange(value)}>
              <SelectTrigger id="installation-sort" className="h-9 w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableSortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="group-by-tipologia"
              checked={groupByTipologia}
              onCheckedChange={onGroupByTipologiaChange}
            />
            <Label htmlFor="group-by-tipologia" className="text-sm text-muted-foreground">
              Agrupar por Tipologia
            </Label>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" onClick={onResetFilters}>
            <RefreshCw className="h-4 w-4" />
            Resetar Filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
