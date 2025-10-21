import { supabase } from '@/integrations/supabase/client';

const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string;

/**
 * Upload a photo for report with robust error handling
 * 
 * @param photoDataUrl - Photo data URL or blob URL
 * @param installationId - Installation ID for unique naming
 * @returns Promise<string> - Public URL of uploaded photo, or empty string if upload fails
 * 
 * Error Handling:
 * - Validates bucket configuration before processing
 * - Validates photo data URL is provided
 * - Logs detailed error on failure
 * - Returns empty string instead of throwing (allows report to continue)
 * - Cleans up object URLs to prevent memory leaks
 */
export async function uploadPhotoForReport(
  photoDataUrl: string, 
  installationId: string
): Promise<string> {
  try {
    // Input validation
    if (!bucket) {
      console.error('[uploadPhotoForReport] Error: Supabase bucket not configured');
      return '';
    }

    if (!photoDataUrl) {
      console.error('[uploadPhotoForReport] Error: photoDataUrl is empty');
      return '';
    }

    if (!installationId) {
      console.error('[uploadPhotoForReport] Error: installationId is missing');
      return '';
    }

    // Convert data URL to Blob
    const response = await fetch(photoDataUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    // Create unique filename with timestamp
    const timestamp = Date.now();
    const filename = `report-photos/${installationId}-${timestamp}.jpg`;
    
    // Upload to Supabase Storage in project-files bucket
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    // Cleanup object URL to prevent memory leak
    URL.revokeObjectURL(objectUrl);
    
    if (uploadError) {
      console.error('[uploadPhotoForReport] Error uploading photo:', {
        error: uploadError,
        installationId,
        filename
      });
      return '';
    }
    
    // Get public URL using getPublicUrl
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filename);
    
    if (!urlData?.publicUrl) {
      console.error('[uploadPhotoForReport] Error: Failed to get public URL for photo:', {
        installationId,
        filename
      });
      return '';
    }
    
    return urlData.publicUrl;
    
  } catch (error) {
    console.error('[uploadPhotoForReport] Critical error uploading photo:', {
      error,
      installationId
    });
    return '';
  }
}

/**
 * Upload multiple photos for report and create HTML gallery
 * 
 * @param photos - Array of photo data URLs
 * @param installationId - Installation ID
 * @returns Promise<string> - Public URL of HTML gallery, or empty string if all uploads fail
 * 
 * Error Handling:
 * - Validates bucket configuration before processing
 * - Validates photos array is not empty
 * - Continues with successful photos if some uploads fail
 * - Returns empty string if no photos succeed (doesn't break report)
 * - Logs detailed context on errors
 */
export async function uploadPhotosForReportGallery(
  photos: string[], 
  installationId: string
): Promise<string> {
  try {
    // Input validation
    if (!bucket) {
      console.error('[uploadPhotosForReportGallery] Error: Supabase bucket not configured');
      return '';
    }

    if (!photos || photos.length === 0) {
      console.warn('[uploadPhotosForReportGallery] No photos provided for item:', installationId);
      return '';
    }
    
    const timestamp = Date.now();
    
    // Upload photos with retry logic
    const uploadPromises = photos.map(async (photo, index) => {
      try {
        const url = await uploadPhotoForReport(photo, `${installationId}_${index}_${timestamp}`);
        return url || null;
      } catch (error) {
        console.error('[uploadPhotosForReportGallery] Error uploading individual photo:', {
          error,
          installationId,
          photoIndex: index
        });
        return null;
      }
    });
    
    const uploadedPhotoUrls = await Promise.all(uploadPromises);
    
    // Filter out failed uploads
    const successfulUrls = uploadedPhotoUrls.filter(url => url !== null) as string[];
    
    if (successfulUrls.length === 0) {
      console.error('[uploadPhotosForReportGallery] All photo uploads failed for item:', {
        installationId,
        totalPhotos: photos.length
      });
      return '';
    }

    // Log if some photos failed
    if (successfulUrls.length < photos.length) {
      console.warn('[uploadPhotosForReportGallery] Some photo uploads failed:', {
        installationId,
        successful: successfulUrls.length,
        total: photos.length,
        failed: photos.length - successfulUrls.length
      });
    }
    
    // Create HTML gallery page
    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galeria de Fotos</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
      text-align: center;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .photo-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .photo-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .photo-card img {
      width: 100%;
      height: 250px;
      object-fit: cover;
      display: block;
    }
    .photo-card .caption {
      padding: 12px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .lightbox.active {
      display: flex;
    }
    .lightbox img {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
    }
    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 30px;
      color: white;
      font-size: 40px;
      font-weight: bold;
      cursor: pointer;
      z-index: 1001;
    }
    .lightbox-close:hover {
      color: #ccc;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Galeria de Fotos (${successfulUrls.length})</h1>
    <div class="gallery">
      ${successfulUrls.map((url, idx) => `
        <div class="photo-card" onclick="openLightbox(event, '${url}')">
          <img src="${url}" alt="Foto ${idx + 1}" loading="lazy">
          <div class="caption">Foto ${idx + 1}</div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="lightbox" id="lightbox" onclick="closeLightbox()">
    <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
    <img id="lightbox-img" src="" alt="Foto ampliada">
  </div>
  
  <script>
    function openLightbox(e, url) {
      e.stopPropagation();
      document.getElementById('lightbox').classList.add('active');
      document.getElementById('lightbox-img').src = url;
    }
    
    function closeLightbox() {
      document.getElementById('lightbox').classList.remove('active');
    }
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeLightbox();
    });
  </script>
</body>
</html>`;
    
    // Upload HTML page to Supabase Storage
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const htmlFilename = `reports/gallery_${installationId}_${timestamp}.html`;
    
    const { error: htmlUploadError } = await supabase.storage
      .from(bucket)
      .upload(htmlFilename, htmlBlob, {
        contentType: 'text/html',
        upsert: true
      });
    
    if (htmlUploadError) {
      console.error('[uploadPhotosForReportGallery] Error uploading HTML gallery:', {
        error: htmlUploadError,
        installationId,
        photoCount: successfulUrls.length
      });
      return '';
    }
    
    // Get public URL for the HTML page
    const { data: htmlUrlData } = supabase.storage.from(bucket).getPublicUrl(htmlFilename);
    return htmlUrlData?.publicUrl || '';
    
  } catch (error) {
    console.error('[uploadPhotosForReportGallery] Critical error in photo upload process:', {
      error,
      installationId,
      photoCount: photos?.length || 0
    });
    return '';
  }
}
