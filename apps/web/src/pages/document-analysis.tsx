import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Upload, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  FileImage,
  FileSpreadsheet,
  Presentation,
  Archive,
  Download,
  Brain,
  Zap,
  Shield,
  RefreshCw
} from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import AnalysisResults from "@/components/AnalysisResults";
import { useToast } from "@/hooks/use-toast";

interface AnalysisResult {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: 'processing' | 'completed' | 'error';
  progress: number;
  aiAnalysis?: {
    summary: string;
    insights: string[];
    anomalies: string[];
    recommendations: string[];
    category: string;
    confidence: number;
    dataExtracted?: {
      tables: any[];
      forms: Record<string, any>;
      keyValuePairs: Record<string, any>;
      dates: string[];
      numbers: string[];
      emails: string[];
      urls: string[];
    };
  };
  processingResults?: {
    ocrText?: string;
    virusScanResults?: {
      clean: boolean;
      threats?: string[];
    };
    metadata?: {
      createdAt: string;
      modifiedAt: string;
      author?: string;
    };
  };
  processedAt?: string;
  error?: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return FileSpreadsheet;
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return Presentation;
  if (fileType.includes('zip') || fileType.includes('rar')) return Archive;
  return FileText;
};

const getCategoryColor = (category: string) => {
  const colors = {
    'financial': 'bg-green-100 text-green-800',
    'legal': 'bg-blue-100 text-blue-800',
    'technical': 'bg-purple-100 text-purple-800',
    'medical': 'bg-red-100 text-red-800',
    'business': 'bg-orange-100 text-orange-800',
    'personal': 'bg-gray-100 text-gray-800',
    'other': 'bg-slate-100 text-slate-800'
  };
  return colors[category as keyof typeof colors] || colors['other'];
};

// Helper function to convert stored results to frontend format
const convertStoredResultToAnalysisResult = (stored: any): AnalysisResult => {
  return {
    id: stored.id?.toString() || crypto.randomUUID(),
    filename: stored.filename || 'Unknown File',
    fileType: stored.fileType || 'application/octet-stream',
    fileSize: stored.fileSize || 0,
    status: 'completed' as const,
    progress: 100,
    aiAnalysis: stored.aiAnalysis ? {
      summary: stored.aiAnalysis.summary || '',
      insights: stored.aiAnalysis.insights || stored.aiAnalysis.keyInsights || [],
      anomalies: stored.aiAnalysis.anomalies || stored.aiAnalysis.issues || [],
      recommendations: stored.aiAnalysis.recommendations || [],
      category: stored.category || stored.aiAnalysis.category || 'other',
      confidence: stored.confidence || stored.aiAnalysis.confidence || 70,
      dataExtracted: {
        tables: stored.aiAnalysis.tables || stored.analysisData?.tables || [],
        forms: stored.analysisData?.forms || {},
        keyValuePairs: stored.analysisData?.keyValuePairs || {},
        dates: stored.aiAnalysis.keyDates || stored.analysisData?.dates || [],
        numbers: stored.aiAnalysis.keyNumbers || stored.analysisData?.numbers || [],
        emails: stored.analysisData?.emails || [],
        urls: stored.aiAnalysis.urls || stored.analysisData?.urls || []
      }
    } : undefined,
    processingResults: {
      ocrText: stored.extractedText || '',
      virusScanResults: {
        clean: stored.virusScanPassed !== false,
        threats: []
      },
      metadata: {
        createdAt: stored.createdAt || stored.processedAt || new Date().toISOString(),
        modifiedAt: stored.updatedAt || stored.processedAt || new Date().toISOString()
      }
    },
    processedAt: stored.processedAt || stored.createdAt || new Date().toISOString()
  };
};

export default function DocumentAnalysis() {
  const { isAuthenticated, user } = useAuth();
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Fetch stored document analysis results
  const { data: storedResults, isLoading: loadingStored, error: storedError, refetch: refetchStored } = useQuery({
    queryKey: ['/api/documents/results'],
    queryFn: async () => {
      const response = await fetch('/api/documents/results?limit=20', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch stored results');
      }
      
      return data.results || [];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // Load stored results into state when they're fetched
  useEffect(() => {
    if (storedResults && Array.isArray(storedResults)) {
      const convertedResults = storedResults.map(convertStoredResultToAnalysisResult);
      setAnalysisResults(prev => {
        // Merge stored results with any new uploads, avoiding duplicates
        const existing = prev.filter(r => !storedResults.some(s => s.id?.toString() === r.id));
        return [...convertedResults, ...existing];
      });
    }
  }, [storedResults]);

  // Show error if stored results failed to load
  useEffect(() => {
    if (storedError) {
      console.error('Failed to load stored results:', storedError);
      toast({
        title: "Failed to Load Previous Results",
        description: "Your previous analysis results couldn't be loaded. New uploads will work normally.",
        variant: "destructive"
      });
    }
  }, [storedError, toast]);

  const handleFileUpload = async (files: File[]) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to analyze documents",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    // Create analysis results for each file
    const newResults: AnalysisResult[] = files.map(file => ({
      id: crypto.randomUUID(),
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
      status: 'processing' as const,
      progress: 0
    }));

    setAnalysisResults(prev => [...prev, ...newResults]);

    // Process each file
    for (const [index, file] of files.entries()) {
      const resultId = newResults[index].id;
      
      try {
        // Simulate processing progress
        for (let progress = 0; progress <= 90; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setAnalysisResults(prev => prev.map(result => 
            result.id === resultId ? { ...result, progress } : result
          ));
        }

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('files', file);
        formData.append('options', JSON.stringify({
          enableOCR: true,
          enableVirusScanning: true,
          enableDataAnalysis: true,
          extractTables: true,
          extractImages: true
        }));

        // Send to backend API
        const response = await fetch('/api/documents/analyze', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.statusText}`);
        }

        const analysisData = await response.json();

        // Extract the first result from the results array
        const firstResult = analysisData.data?.results?.[0];
        if (!firstResult) {
          throw new Error('No analysis results returned');
        }

        // Update with completed results
        setAnalysisResults(prev => prev.map(result => 
          result.id === resultId ? {
            ...result,
            status: 'completed' as const,
            progress: 100,
            aiAnalysis: firstResult.aiAnalysis,
            processingResults: firstResult.processingResults,
            processedAt: firstResult.processedAt
          } : result
        ));

        toast({
          title: "Analysis Complete",
          description: `${file.name} has been analyzed successfully`,
        });

        // Refetch stored results to include the newly processed file
        refetchStored();

      } catch (error) {
        console.error(`Error analyzing ${file.name}:`, error);
        
        setAnalysisResults(prev => prev.map(result => 
          result.id === resultId ? {
            ...result,
            status: 'error' as const,
            progress: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          } : result
        ));

        toast({
          title: "Analysis Failed",
          description: `Failed to analyze ${file.name}`,
          variant: "destructive"
        });
      }
    }

    setIsProcessing(false);
  };

  const handleRetry = (resultId: string) => {
    const result = analysisResults.find(r => r.id === resultId);
    if (!result) return;

    // Reset the result and retry (in a real implementation, you'd re-upload)
    setAnalysisResults(prev => prev.map(r => 
      r.id === resultId ? {
        ...r,
        status: 'processing' as const,
        progress: 0,
        error: undefined
      } : r
    ));

    toast({
      title: "Retrying Analysis",
      description: `Retrying analysis for ${result.filename}`,
    });
  };

  const handleDelete = (resultId: string) => {
    setAnalysisResults(prev => prev.filter(r => r.id !== resultId));
    toast({
      title: "Result Deleted",
      description: "Analysis result has been removed",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access document analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.href = '/api/auth/google'}>
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-500 text-white rounded-lg">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Document Analysis</h1>
              <p className="text-gray-600">AI-powered document processing and insights</p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              OCR & Text Extraction
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Brain className="w-3 h-3" />
              AI Analysis
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Security Scanning
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Data Extraction
            </Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analysisResults.filter(r => r.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-600">Analyzed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analysisResults.filter(r => r.status === 'processing').length}
                </div>
                <div className="text-sm text-gray-600">Processing</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analysisResults.filter(r => r.aiAnalysis?.insights?.length).length}
                </div>
                <div className="text-sm text-gray-600">Insights Found</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {analysisResults.filter(r => r.aiAnalysis?.anomalies?.length).length}
                </div>
                <div className="text-sm text-gray-600">Issues Detected</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Area - Left Column */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Documents
                </CardTitle>
                <CardDescription>
                  Drag & drop files or browse to select documents for analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentUpload 
                  onFilesSelected={handleFileUpload}
                  isProcessing={isProcessing}
                  maxFiles={10}
                  maxSize={10 * 1024 * 1024} // 10MB
                  acceptedTypes={{
                    'application/pdf': ['.pdf'],
                    'application/msword': ['.doc'],
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                    'application/vnd.ms-excel': ['.xls'],
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                    'text/csv': ['.csv'],
                    'text/plain': ['.txt'],
                    'image/jpeg': ['.jpg', '.jpeg'],
                    'image/png': ['.png'],
                    'image/gif': ['.gif'],
                    'image/tiff': ['.tiff']
                  }}
                />

                <Separator className="my-6" />

                {/* Email Alternative */}
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Or email your documents to:
                  </p>
                  <div className="flex flex-col gap-2">
                    <Badge variant="outline" className="justify-center">
                      analyze@inboxleap.com
                    </Badge>
                    <Badge variant="outline" className="justify-center">
                      docs@inboxleap.com
                    </Badge>
                    <Badge variant="outline" className="justify-center">
                      review@inboxleap.com
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Area - Right Column */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Analysis Results
                      {analysisResults.length > 0 && (
                        <Badge variant="secondary">{analysisResults.length}</Badge>
                      )}
                      {loadingStored && (
                        <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                      )}
                    </CardTitle>
                    <CardDescription>
                      Document analysis results and AI-powered insights
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchStored()}
                    disabled={loadingStored}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingStored ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingStored && analysisResults.length === 0 ? (
                  <div className="text-center py-12">
                    <RefreshCw className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-500 text-lg font-medium mb-2">Loading your previous results...</p>
                    <p className="text-gray-400">Please wait while we fetch your document analysis history</p>
                  </div>
                ) : analysisResults.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium mb-2">No documents analyzed yet</p>
                    <p className="text-gray-400">Upload documents to see analysis results here</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {analysisResults.map((result) => (
                      <AnalysisResults
                        key={result.id}
                        result={result}
                        onRetry={handleRetry}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}