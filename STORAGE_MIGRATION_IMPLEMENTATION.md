# Storage Migration Implementation

This document outlines the implementation of file attachment migration from local IndexedDB to Supabase Storage.

## Changes Made

### 1. Database Migration
- **File**: Database migration via Supabase
- **Changes**:
  - Created `attachments` bucket with private access
  - Added RLS policies for user-specific file access
  - Added `storage_path` column to files table
  - Made `url` column nullable for storage-based files

### 2. Storage Service
- **File**: `src/services/storage.ts`
- **Purpose**: Handles file uploads/downloads with Supabase Storage
- **Key Features**:
  - Upload files to user-specific folders (`userId/projectId/installationId?/timestamp_filename`)
  - Generate signed URLs for file access (5-15 min expiry)
  - Handle offline uploads with local blob URLs
  - Migrate legacy files from blob URLs to storage
  - Delete files from both storage and database

### 3. File Sync Service
- **File**: `src/services/sync/fileSync.ts`
- **Purpose**: Specialized sync service for file operations
- **Features**:
  - Push file metadata to Supabase DB
  - Pull file metadata from Supabase DB
  - Upload pending files (offline uploads) to Storage
  - Handle file deletions from both storage and DB
  - Maintain sync flags and timestamps

### 4. Enhanced File Upload Component
- **File**: `src/components/file-upload.tsx`
- **Changes**:
  - Online/offline status detection
  - Storage-based uploads when online
  - Local blob URLs when offline
  - Visual indicators for cloud vs local files
  - Preview with signed URL generation
  - Enhanced error handling

### 5. File Migration Modal
- **File**: `src/components/file-migration-modal.tsx`
- **Purpose**: UI for migrating legacy files to storage
- **Features**:
  - List files to be migrated
  - Progress tracking
  - Error handling and reporting
  - Network status awareness

### 6. Updated Types
- **File**: `src/types/index.ts`
- **Changes**:
  - Added `installation_id` and `storage_path` to ProjectFile
  - Made `url` optional for storage-based files

### 7. Enhanced Sync Integration
- **File**: `src/services/sync/sync.ts`
- **Changes**:
  - Integrated file sync service into main sync flow
  - Upload pending files before pushing metadata
  - Specialized handling for file operations

## Architecture

### Storage Structure
```
attachments/
  └── {userId}/
      └── {projectId}/
          ├── {timestamp}_{filename}
          └── {installationId}/
              └── {timestamp}_{filename}
```

### File States
1. **Legacy Local**: `url` with blob URL, no `storage_path`
2. **Storage-based**: `storage_path` set, empty `url`
3. **Pending Upload**: blob URL + `_dirty=1` (offline upload)

### Sync Flow
1. **Upload pending files** to Storage (offline → online)
2. **Push metadata** to Supabase DB
3. **Pull metadata** from Supabase DB
4. **Generate signed URLs** on demand for preview/download

## Testing Checklist

### Basic Functionality
- [ ] Upload files when online → stored in Supabase Storage
- [ ] Upload files when offline → stored locally with blob URL
- [ ] Preview files (both storage and local)
- [ ] Download files
- [ ] Delete files

### Network States
- [ ] Go offline → uploads create local blob URLs
- [ ] Go online → pending uploads sync to storage
- [ ] File operations work in both states

### Migration
- [ ] Legacy files show migration prompt
- [ ] Migration uploads files to storage
- [ ] Migration updates metadata
- [ ] Failed migrations are reported

### Multi-device Sync
- [ ] Upload file on device A
- [ ] Sync pulls file metadata on device B
- [ ] File can be previewed/downloaded on device B
- [ ] Delete on device A syncs to device B

### Security
- [ ] Files are private by default
- [ ] Signed URLs expire (15 min)
- [ ] User can only access their own files
- [ ] RLS policies prevent unauthorized access

### Error Handling
- [ ] Network errors during upload
- [ ] Storage quota exceeded
- [ ] Invalid file types
- [ ] Large file uploads
- [ ] Concurrent access scenarios

## QA Steps

1. **Setup**: Create project with some files
2. **Online Upload**: Upload files, verify they appear in Supabase Storage
3. **Offline Upload**: Disconnect, upload files, reconnect, verify sync
4. **Preview**: Test file preview with signed URLs
5. **Migration**: Import old project data, trigger migration
6. **Multi-device**: Test file access across multiple browser tabs/devices
7. **Deletion**: Delete files, verify removal from storage and DB
8. **Error scenarios**: Test with network issues, quota limits, etc.

## Performance Considerations

- Signed URLs are generated on-demand (not cached)
- File uploads use streaming for large files
- Batch operations for multiple file syncs
- Exponential backoff for failed uploads
- Progress indicators for long operations