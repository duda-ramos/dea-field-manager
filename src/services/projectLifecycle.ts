import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { storage } from "@/lib/storage";

export interface ProjectLifecycleFilters {
  showActive?: boolean;
  showDeleted?: boolean;
  showArchived?: boolean;
}

/**
 * Soft delete a project (moves to trash for 7 days)
 */
export async function softDeleteProject(projectId: string) {
  try {
    const deletedAt = new Date().toISOString();
    const permanentDeletionAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    // Update local storage first
    const project = await storage.getProjectById(projectId);
    if (project) {
      await storage.upsertProject({
        ...project,
        deleted_at: deletedAt,
        permanent_deletion_at: permanentDeletionAt,
      });
    }
    
    // Then update Supabase
    const { error } = await supabase
      .from("projects")
      .update({
        deleted_at: deletedAt,
        permanent_deletion_at: permanentDeletionAt,
      })
      .eq("id", projectId);

    if (error) throw error;

    toast.success("Projeto movido para lixeira", {
      description: "Será excluído permanentemente em 7 dias",
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error soft deleting project:", error);
    toast.error("Erro ao excluir projeto");
    return { success: false, error };
  }
}

/**
 * Archive a project (keeps for 6 months)
 */
export async function archiveProject(projectId: string) {
  try {
    const archivedAt = new Date().toISOString();
    
    // Update local storage first
    const project = await storage.getProjectById(projectId);
    if (project) {
      await storage.upsertProject({
        ...project,
        archived_at: archivedAt,
        status: "completed",
      });
    }
    
    // Then update Supabase
    const { error } = await supabase
      .from("projects")
      .update({
        archived_at: archivedAt,
        status: "completed",
      })
      .eq("id", projectId);

    if (error) throw error;

    toast.success("Projeto arquivado com sucesso", {
      description: "Mantido por 6 meses",
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error archiving project:", error);
    toast.error("Erro ao arquivar projeto");
    return { success: false, error };
  }
}

/**
 * Restore a project from trash or archive
 */
export async function restoreProject(projectId: string) {
  try {
    // Update local storage first
    const project = await storage.getProjectById(projectId);
    if (project) {
      await storage.upsertProject({
        ...project,
        deleted_at: null,
        archived_at: null,
        permanent_deletion_at: null,
        status: "in-progress",
      });
    }
    
    // Then update Supabase
    const { error } = await supabase
      .from("projects")
      .update({
        deleted_at: null,
        archived_at: null,
        permanent_deletion_at: null,
        status: "in-progress",
      })
      .eq("id", projectId);

    if (error) throw error;

    toast.success("Projeto restaurado com sucesso");
    return { success: true };
  } catch (error) {
    console.error("Error restoring project:", error);
    toast.error("Erro ao restaurar projeto");
    return { success: false, error };
  }
}

/**
 * Permanently delete a project
 */
export async function permanentlyDeleteProject(projectId: string) {
  try {
    console.log("Attempting to permanently delete project:", projectId);
    
    // Delete all related data to avoid foreign key constraints
    // Order matters - delete dependent tables first
    
    // Delete calendar events
    await supabase.from("calendar_events").delete().eq("project_id", projectId);
    
    // Delete collaboration events
    await supabase.from("collaboration_events").delete().eq("project_id", projectId);
    
    // Delete project versions
    await supabase.from("project_versions").delete().eq("project_id", projectId);
    
    // Delete project backups
    await supabase.from("project_backups").delete().eq("project_id", projectId);
    
    // Delete project activities
    await supabase.from("project_activities").delete().eq("project_id", projectId);
    
    // Delete project collaborators
    await supabase.from("project_collaborators").delete().eq("project_id", projectId);
    
    // Delete project files
    await supabase.from("project_files").delete().eq("project_id", projectId);
    
    // Delete installations
    const { error: installError } = await supabase
      .from("installations")
      .delete()
      .eq("project_id", projectId);
    
    if (installError) {
      console.error("Error deleting installations:", installError);
      throw installError;
    }

    // Delete contacts
    const { error: contactError } = await supabase
      .from("contacts")
      .delete()
      .eq("project_id", projectId);
    
    if (contactError) {
      console.error("Error deleting contacts:", contactError);
      throw contactError;
    }

    // Delete files metadata
    const { error: filesError } = await supabase
      .from("files")
      .delete()
      .eq("project_id", projectId);
    
    if (filesError) {
      console.error("Error deleting files:", filesError);
      throw filesError;
    }

    // Delete supplier proposals
    const { error: budgetsError } = await supabase
      .from("supplier_proposals")
      .delete()
      .eq("project_id", projectId);
    
    if (budgetsError) {
      console.error("Error deleting budgets:", budgetsError);
      throw budgetsError;
    }

    // Finally delete the project
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      console.error("Error deleting project:", error);
      throw error;
    }

    console.log("Project permanently deleted successfully");
    toast.success("Projeto excluído permanentemente");
    return { success: true };
  } catch (error) {
    console.error("Error permanently deleting project:", error);
    toast.error("Erro ao excluir projeto permanentemente", {
      description: error instanceof Error ? error.message : "Tente novamente"
    });
    return { success: false, error };
  }
}

/**
 * Download complete project as ZIP
 */
export async function downloadProjectZip(projectId: string) {
  try {
    toast.info("Preparando download...", { description: "Isso pode levar alguns minutos" });

    const zip = new JSZip();

    // Get project data
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) throw new Error("Projeto não encontrado");

    // Get installations
    const { data: installations } = await supabase
      .from("installations")
      .select("*")
      .eq("project_id", projectId);

    // Get contacts
    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("project_id", projectId);

    // Get budgets
    const { data: budgets } = await supabase
      .from("supplier_proposals")
      .select("*")
      .eq("project_id", projectId);

    // Get files
    const { data: files } = await supabase
      .from("files")
      .select("*")
      .eq("project_id", projectId);

    // Add project info JSON
    zip.file("projeto.json", JSON.stringify({
      projeto: project,
      instalacoes: installations || [],
      contatos: contacts || [],
      orcamentos: budgets || [],
    }, null, 2));

    // Add installation details
    if (installations && installations.length > 0) {
      const installationsFolder = zip.folder("instalacoes");
      installations.forEach((inst, index) => {
        installationsFolder?.file(
          `instalacao_${index + 1}_${inst.codigo}.json`,
          JSON.stringify(inst, null, 2)
        );
      });
    }

    // Add contacts
    if (contacts && contacts.length > 0) {
      zip.file("contatos.json", JSON.stringify(contacts, null, 2));
    }

    // Add budgets
    if (budgets && budgets.length > 0) {
      zip.file("orcamentos.json", JSON.stringify(budgets, null, 2));
    }

    // Download files from storage
    if (files && files.length > 0) {
      const filesFolder = zip.folder("arquivos");
      
      for (const file of files) {
        try {
          if (file.storage_path) {
            const { data: fileData } = await supabase.storage
              .from("project-files")
              .download(file.storage_path);

            if (fileData) {
              filesFolder?.file(file.name, fileData);
            }
          }
        } catch (error) {
          console.error(`Error downloading file ${file.name}:`, error);
        }
      }
    }

    // Generate and download ZIP
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${project.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.zip`);

    toast.success("Download concluído!");
    return { success: true };
  } catch (error) {
    console.error("Error downloading project ZIP:", error);
    toast.error("Erro ao criar arquivo ZIP");
    return { success: false, error };
  }
}

/**
 * Get projects with lifecycle filters
 */
export async function getFilteredProjects(filters: ProjectLifecycleFilters) {
  try {
    let query = supabase.from("projects").select("*");

    if (filters.showDeleted && !filters.showActive && !filters.showArchived) {
      // Only deleted
      query = query.not("deleted_at", "is", null);
    } else if (filters.showArchived && !filters.showActive && !filters.showDeleted) {
      // Only archived
      query = query.not("archived_at", "is", null).is("deleted_at", null);
    } else if (filters.showActive && !filters.showDeleted && !filters.showArchived) {
      // Only active
      query = query.is("deleted_at", null).is("archived_at", null);
    }
    // If multiple or none selected, show all

    const { data, error } = await query.order("updated_at", { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error("Error fetching filtered projects:", error);
    return { data: null, error };
  }
}
