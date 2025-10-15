import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload, 
  File, 
  X, 
  AlertCircle, 
  FileText,
  FileImage,
  FileSpreadsheet,
  Presentation,
  Archive,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedTypes?: Record<string, string[]>;
  className?: string;
}

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return FileSpreadsheet;
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return Presentation;
  if (fileType.includes('zip') || fileType.includes('rar')) return Archive;
  return FileText;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DocumentUpload({
  onFilesSelected,
  isProcessing = false,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'text/plain': ['.txt']
  },
  className
}: DocumentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`;
    }

    // Check file type
    const isAccepted = Object.keys(acceptedTypes).some(mimeType => 
      file.type === mimeType || acceptedTypes[mimeType].some(ext => 
        file.name.toLowerCase().endsWith(ext.toLowerCase())
      )
    );

    if (!isAccepted) {
      const allowedExtensions = Object.values(acceptedTypes).flat().join(', ');
      return `File type not supported. Allowed types: ${allowedExtensions}`;
    }

    return null;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newErrors: string[] = [];
    const validFiles: File[] = [];

    // Check total file limit
    if (uploadedFiles.length + fileArray.length > maxFiles) {
      newErrors.push(`Cannot upload more than ${maxFiles} files at once`);
      setErrors(newErrors);
      return;
    }

    // Validate each file
    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
    } else {
      setErrors([]);
    }

    if (validFiles.length > 0) {
      // Add files to uploaded list
      const newUploadedFiles: UploadedFile[] = validFiles.map(file => ({
        file,
        id: crypto.randomUUID(),
        status: 'pending',
        progress: 0
      }));

      setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
      
      // Call the parent callback
      onFilesSelected(validFiles);
    }
  }, [uploadedFiles.length, maxFiles, maxSize, acceptedTypes, onFilesSelected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearAll = () => {
    setUploadedFiles([]);
    setErrors([]);
  };

  const acceptedExtensions = Object.values(acceptedTypes).flat().join(', ');

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          isDragOver 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-300 hover:border-gray-400",
          isProcessing && "pointer-events-none opacity-50"
        )}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Object.keys(acceptedTypes).join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center gap-4">
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : (
            <Upload className={cn(
              "w-12 h-12 transition-colors",
              isDragOver ? "text-blue-500" : "text-gray-400"
            )} />
          )}
          
          <div>
            <p className={cn(
              "text-lg font-medium transition-colors",
              isDragOver ? "text-blue-700" : "text-gray-700"
            )}>
              {isProcessing 
                ? "Processing documents..." 
                : isDragOver 
                ? "Drop files here" 
                : "Drag & drop files here"
              }
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {!isProcessing && "or click to browse files"}
            </p>
          </div>

          <Button 
            variant="outline" 
            disabled={isProcessing}
            className="mt-2"
          >
            {isProcessing ? "Processing..." : "Browse Files"}
          </Button>

          <div className="text-xs text-gray-500 space-y-1">
            <p>Supported formats: {acceptedExtensions}</p>
            <p>Maximum file size: {formatFileSize(maxSize)}</p>
            <p>Maximum files: {maxFiles}</p>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <File className="w-4 h-4" />
                Selected Files ({uploadedFiles.length})
              </h4>
              {uploadedFiles.length > 0 && !isProcessing && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAll}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {uploadedFiles.map((uploadedFile) => {
                const Icon = getFileIcon(uploadedFile.file.type);
                
                return (
                  <div
                    key={uploadedFile.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50"
                  >
                    <Icon className="w-6 h-6 text-blue-500 flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {uploadedFile.file.name}
                        </p>
                        {uploadedFile.status === 'success' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {uploadedFile.status === 'error' && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(uploadedFile.file.size)}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {uploadedFile.file.type || 'Unknown type'}
                        </span>
                      </div>
                      
                      {uploadedFile.status === 'uploading' && (
                        <Progress 
                          value={uploadedFile.progress} 
                          className="mt-2 h-2"
                        />
                      )}
                      
                      {uploadedFile.error && (
                        <p className="text-xs text-red-600 mt-1">
                          {uploadedFile.error}
                        </p>
                      )}
                    </div>

                    {!isProcessing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(uploadedFile.id);
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}