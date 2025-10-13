import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Canvas as FabricCanvas, Image as FabricImage, PencilBrush, Rect, Circle, Textbox, filters } from 'fabric';
import { logger } from '@/services/logger';
import { 
  RotateCcw, 
  Crop, 
  Paintbrush, 
  Type, 
  Square, 
  Circle as CircleIcon,
  Undo,
  Redo,
  Save,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getSignedUrl } from '@/services/storage/filesStorage';
import type { ProjectFile } from '@/types';

interface ImageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  image: ProjectFile;
  onSave: (editedBlob: Blob, originalImage: ProjectFile) => void;
}

export function ImageEditor({ isOpen, onClose, image, onSave }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'draw' | 'text' | 'rectangle' | 'circle' | 'crop'>('select');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Initialize canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
    });

    setFabricCanvas(canvas);
    loadImage(canvas);

    return () => {
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, [isOpen, image]);

  // Load image into canvas
  const loadImage = async (canvas: FabricCanvas) => {
    try {
      setIsLoading(true);
      
      // Get signed URL for the image
      let imageUrl = image.url;
      if (image.storage_path) {
        const { url } = await getSignedUrl(image.storage_path);
        imageUrl = url;
      }

      FabricImage.fromURL(imageUrl, {
        crossOrigin: 'anonymous'
      }).then((fabricImage) => {
        // Scale image to fit canvas
        const canvasWidth = canvas.getWidth();
        const canvasHeight = canvas.getHeight();
        const imageWidth = fabricImage.width || 1;
        const imageHeight = fabricImage.height || 1;
        
        const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
        
        fabricImage.scale(scale);
        canvas.centerObject(fabricImage);
        fabricImage.setCoords();
        
        canvas.add(fabricImage);
        canvas.renderAll();
        
        // Save initial state
        saveToHistory(canvas);
        setIsLoading(false);
      });
    } catch (error) {
      logger.error('Error loading image for editing', {
        error,
        imageId: image.id,
        imageName: image.name,
        storagePath: image.storagePath,
        operacao: 'loadImageForEditing'
      });
      toast({
        title: 'Erro',
        description: 'Erro ao carregar imagem para edição.',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };

  // Save canvas state to history
  const saveToHistory = (canvas: FabricCanvas) => {
    const state = JSON.stringify(canvas.toJSON());
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Handle tool changes
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === 'draw';
    
    if (activeTool === 'draw') {
      fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
      fabricCanvas.freeDrawingBrush.color = brushColor;
      fabricCanvas.freeDrawingBrush.width = brushSize;
    }
  }, [activeTool, brushColor, brushSize, fabricCanvas]);

  // Handle tool clicks
  const handleToolClick = (tool: typeof activeTool) => {
    if (!fabricCanvas) return;

    setActiveTool(tool);

    if (tool === 'rectangle') {
      const rect = new Rect({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: 2,
        width: 100,
        height: 100,
      });
      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
      saveToHistory(fabricCanvas);
    } else if (tool === 'circle') {
      const circle = new Circle({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: brushColor,
        strokeWidth: 2,
        radius: 50,
      });
      fabricCanvas.add(circle);
      fabricCanvas.setActiveObject(circle);
      saveToHistory(fabricCanvas);
    } else if (tool === 'text') {
      const text = new Textbox('Digite aqui...', {
        left: 100,
        top: 100,
        fill: brushColor,
        fontSize: 20,
        fontFamily: 'Arial',
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      saveToHistory(fabricCanvas);
    }
  };

  // Rotate image
  const rotateImage = () => {
    if (!fabricCanvas) return;
    
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      activeObject.rotate((activeObject.angle || 0) + 90);
      fabricCanvas.renderAll();
      saveToHistory(fabricCanvas);
    }
  };

  // Apply filters (simplified version)
  const applyFilters = () => {
    if (!fabricCanvas) return;
    // Simple brightness adjustment by changing canvas background or object opacity
    // For now, we'll skip complex filters to avoid fabric.js compatibility issues
    fabricCanvas.renderAll();
    saveToHistory(fabricCanvas);
  };

  // Undo/Redo
  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      fabricCanvas?.loadFromJSON(prevState, () => {
        fabricCanvas.renderAll();
        setHistoryIndex(historyIndex - 1);
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      fabricCanvas?.loadFromJSON(nextState, () => {
        fabricCanvas.renderAll();
        setHistoryIndex(historyIndex + 1);
      });
    }
  };

  // Save edited image
  const handleSave = () => {
    if (!fabricCanvas) return;

    const dataURL = fabricCanvas.toDataURL({ 
      format: 'png', 
      quality: 1.0,
      multiplier: 1
    });
    fetch(dataURL)
      .then(res => res.blob())
      .then(blob => {
        if (blob) {
          onSave(blob, image);
        }
      });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Editor de Imagem - {image.name}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          {/* Toolbar */}
          <div className="p-4 border-b bg-muted/30">
            <div className="flex flex-wrap gap-2 mb-4">
              {/* Selection Tools */}
              <Button
                variant={activeTool === 'select' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTool('select')}
              >
                Selecionar
              </Button>
              
              {/* Drawing Tools */}
              <Button
                variant={activeTool === 'draw' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleToolClick('draw')}
              >
                <Paintbrush className="h-4 w-4 mr-1" />
                Desenhar
              </Button>
              
              <Button
                variant={activeTool === 'text' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleToolClick('text')}
              >
                <Type className="h-4 w-4 mr-1" />
                Texto
              </Button>
              
              <Button
                variant={activeTool === 'rectangle' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleToolClick('rectangle')}
              >
                <Square className="h-4 w-4 mr-1" />
                Retângulo
              </Button>
              
              <Button
                variant={activeTool === 'circle' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleToolClick('circle')}
              >
                <CircleIcon className="h-4 w-4 mr-1" />
                Círculo
              </Button>
              
              {/* Transform Tools */}
              <Button
                variant="outline"
                size="sm"
                onClick={rotateImage}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Girar
              </Button>
              
              {/* History */}
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <Undo className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Tool Options */}
            <div className="flex flex-wrap gap-4 items-center">
              {activeTool === 'draw' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Cor:</span>
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-8 h-8 rounded border"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Tamanho:</span>
                    <Slider
                      value={[brushSize]}
                      onValueChange={(value) => setBrushSize(value[0])}
                      max={50}
                      min={1}
                      step={1}
                      className="w-24"
                    />
                    <span className="text-sm w-8">{brushSize}</span>
                  </div>
                </>
              )}
              
              {/* Filters */}
              <div className="flex items-center gap-2">
                <span className="text-sm">Brilho:</span>
                <Slider
                  value={[brightness]}
                  onValueChange={(value) => setBrightness(value[0])}
                  onValueCommit={applyFilters}
                  max={100}
                  min={-100}
                  step={1}
                  className="w-20"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm">Contraste:</span>
                <Slider
                  value={[contrast]}
                  onValueChange={(value) => setContrast(value[0])}
                  onValueCommit={applyFilters}
                  max={100}
                  min={-100}
                  step={1}
                  className="w-20"
                />
              </div>
            </div>
          </div>
          
          {/* Canvas Container */}
          <div className="flex-1 p-4 bg-muted/10 flex items-center justify-center">
            {isLoading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Carregando imagem...</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="border border-border rounded-lg shadow-lg bg-white"
              />
            )}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t bg-muted/30 flex justify-between">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Edição
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}