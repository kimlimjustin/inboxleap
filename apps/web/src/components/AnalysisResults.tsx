import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  FileImage,
  FileSpreadsheet,
  Presentation,
  Archive,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Eye,
  Download,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Brain,
  Shield,
  Lightbulb,
  AlertCircle,
  TrendingUp,
  Calendar,
  Mail,
  ExternalLink,
  Copy,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface AnalysisResultsProps {
  result: AnalysisResult;
  onRetry: (resultId: string) => void;
  onDelete: (resultId: string) => void;
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

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'processing':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Clock className="w-5 h-5 text-gray-500" />;
  }
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
};

export default function AnalysisResults({ result, onRetry, onDelete }: AnalysisResultsProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    insights: true,
    recommendations: false,
    anomalies: false,
    extractedData: false,
    rawText: false,
    metadata: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const FileIcon = getFileIcon(result.fileType);
  const { aiAnalysis, processingResults } = result;

  return (
    <Card className={cn(
      "transition-all duration-200",
      result.status === 'error' && "border-red-200",
      result.status === 'completed' && "border-green-200"
    )}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileIcon className="w-8 h-8 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="truncate">{result.filename}</span>
                {getStatusIcon(result.status)}
              </CardTitle>
              <CardDescription className="flex items-center gap-4 mt-1">
                <span>{formatFileSize(result.fileSize)}</span>
                <span>{result.fileType}</span>
                {result.processedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(result.processedAt).toLocaleString()}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {result.status === 'error' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetry(result.id)}
                className="flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(result.id)}
              className="text-gray-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar for Processing */}
        {result.status === 'processing' && (
          <div className="mt-4">
            <Progress value={result.progress} className="h-2" />
            <p className="text-sm text-gray-500 mt-1">
              Processing... {result.progress}% complete
            </p>
          </div>
        )}

        {/* Error Display */}
        {result.status === 'error' && result.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}

        {/* Category and Confidence */}
        {aiAnalysis && (
          <div className="flex items-center gap-2 mt-4">
            <Badge className={getCategoryColor(aiAnalysis.category)}>
              {aiAnalysis.category.charAt(0).toUpperCase() + aiAnalysis.category.slice(1)}
            </Badge>
            <Badge variant="outline">
              {Math.round(aiAnalysis.confidence * 100)}% confidence
            </Badge>
            {processingResults?.virusScanResults && (
              <Badge variant={processingResults.virusScanResults.clean ? "default" : "destructive"}>
                <Shield className="w-3 h-3 mr-1" />
                {processingResults.virusScanResults.clean ? "Secure" : "Threats Found"}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      {/* Analysis Content */}
      {result.status === 'completed' && aiAnalysis && (
        <CardContent className="space-y-6">
          {/* Summary */}
          {aiAnalysis.summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                AI Summary
              </h4>
              <p className="text-blue-800">{aiAnalysis.summary}</p>
            </div>
          )}

          {/* Key Insights */}
          {aiAnalysis.insights && aiAnalysis.insights.length > 0 && (
            <Collapsible
              open={expandedSections.insights}
              onOpenChange={() => toggleSection('insights')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                  <div className="flex items-center gap-2">
                    {expandedSections.insights ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Lightbulb className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">Key Insights ({aiAnalysis.insights.length})</span>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-2 pl-6">
                  {aiAnalysis.insights.map((insight, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 bg-orange-50 rounded border-l-4 border-orange-400"
                    >
                      <TrendingUp className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{insight}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Recommendations */}
          {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
            <Collapsible
              open={expandedSections.recommendations}
              onOpenChange={() => toggleSection('recommendations')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                  <div className="flex items-center gap-2">
                    {expandedSections.recommendations ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Recommendations ({aiAnalysis.recommendations.length})</span>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-2 pl-6">
                  {aiAnalysis.recommendations.map((recommendation, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 bg-green-50 rounded border-l-4 border-green-400"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Anomalies */}
          {aiAnalysis.anomalies && aiAnalysis.anomalies.length > 0 && (
            <Collapsible
              open={expandedSections.anomalies}
              onOpenChange={() => toggleSection('anomalies')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                  <div className="flex items-center gap-2">
                    {expandedSections.anomalies ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="font-medium">Issues Detected ({aiAnalysis.anomalies.length})</span>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="space-y-2 pl-6">
                  {aiAnalysis.anomalies.map((anomaly, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 bg-red-50 rounded border-l-4 border-red-400"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{anomaly}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Extracted Data */}
          {aiAnalysis.dataExtracted && (
            <Collapsible
              open={expandedSections.extractedData}
              onOpenChange={() => toggleSection('extractedData')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                  <div className="flex items-center gap-2">
                    {expandedSections.extractedData ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Extracted Data</span>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="pl-6 space-y-4">
                  {aiAnalysis.dataExtracted.dates && aiAnalysis.dataExtracted.dates.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded">
                      <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Dates Found
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {aiAnalysis.dataExtracted.dates.map((date, index) => (
                          <Badge key={index} variant="outline">{date}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiAnalysis.dataExtracted.emails && aiAnalysis.dataExtracted.emails.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded">
                      <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Addresses
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {aiAnalysis.dataExtracted.emails.map((email, index) => (
                          <Badge key={index} variant="outline" className="cursor-pointer"
                            onClick={() => copyToClipboard(email)}>
                            {email}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiAnalysis.dataExtracted.urls && aiAnalysis.dataExtracted.urls.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded">
                      <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        URLs Found
                      </h5>
                      <div className="space-y-1">
                        {aiAnalysis.dataExtracted.urls.map((url, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-sm truncate flex-1"
                            >
                              {url}
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(url)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* OCR Text */}
          {processingResults?.ocrText && (
            <Collapsible
              open={expandedSections.rawText}
              onOpenChange={() => toggleSection('rawText')}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-0 h-auto">
                  <div className="flex items-center gap-2">
                    {expandedSections.rawText ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <FileText className="w-4 h-4 text-gray-600" />
                    <span className="font-medium">Extracted Text</span>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="pl-6">
                  <div className="bg-gray-50 p-3 rounded font-mono text-sm max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{processingResults.ocrText}</pre>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Security Issues */}
          {processingResults?.virusScanResults?.threats && processingResults.virusScanResults.threats.length > 0 && (
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Security threats detected:</div>
                <ul className="space-y-1">
                  {processingResults.virusScanResults.threats.map((threat, index) => (
                    <li key={index} className="text-sm">• {threat}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
}