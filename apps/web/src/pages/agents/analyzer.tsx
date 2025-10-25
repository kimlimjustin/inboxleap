import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  RefreshCw,
  Mail,
  Paperclip,
  Clock,
  Shield,
  Info,
  RotateCcw,
} from "lucide-react";

interface EmailWithAttachments {
  id: string;
  messageId: string;
  subject: string;
  sender: string;
  recipients: string[];
  createdAt: string;
  attachmentCount: number;
  analysisResults?: any[];
}

export default function AnalyzerPage() {
  const { isAuthenticated, user } = useAuth();
  const [selectedEmail, setSelectedEmail] = useState<EmailWithAttachments | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch document analysis results (emails with attachments analyzed)
  const { data: resultsData, isLoading: loadingResults, error: resultsError, refetch: refetchResults } = useQuery({
    queryKey: ['/api/documents/results'],
    queryFn: async () => {
      const response = await fetch('/api/documents/results?limit=50', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch analysis results');
      }

      return data.results || [];
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Reanalyze mutation
  const reanalyzeMutation = useMutation({
    mutationFn: async (resultId: number) => {
      const response = await fetch(`/api/documents/results/${resultId}/reanalyze`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to reanalyze document');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents/results'] });
      toast({
        title: "Success",
        description: "Document reanalyzed successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reanalyze document",
        variant: "destructive"
      });
    }
  });

  // Group results by email/messageId
  const emailsWithAttachments = resultsData?.reduce((acc: EmailWithAttachments[], result: any) => {
    const existing = acc.find(e => e.messageId === result.messageId);
    if (existing) {
      existing.analysisResults = existing.analysisResults || [];
      existing.analysisResults.push(result);
      existing.attachmentCount = existing.analysisResults.length;
    } else {
      acc.push({
        id: result.id?.toString() || crypto.randomUUID(),
        messageId: result.messageId,
        subject: `Email with ${result.filename}`,
        sender: result.userId || 'Unknown',
        recipients: [],
        createdAt: result.createdAt || result.processedAt,
        attachmentCount: 1,
        analysisResults: [result]
      });
    }
    return acc;
  }, []) || [];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access document analyzer
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
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-12">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="space-y-6">
          {/* Main Content Area with Two-Panel Layout */}
          <div className="flex flex-col gap-6 xl:flex-row xl:h-[calc(100vh-8rem)]">
            {/* Left Sidebar - Emails List */}
            <div className="w-80 flex-shrink-0">
              <Card className="h-full border border-orange-200/70 shadow-xl bg-white/85 backdrop-blur-sm">
                <CardHeader className="border-b border-orange-200/70 bg-orange-50/80 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
                      <Paperclip className="h-5 w-5 text-orange-600" />
                      Emails
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchResults()}
                      disabled={loadingResults}
                      className="border-orange-200 bg-white/80 text-orange-700 shadow-sm hover:border-orange-300 hover:bg-orange-100"
                    >
                      <RefreshCw className={`w-4 h-4 text-orange-600 ${loadingResults ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <CardDescription className="mt-2 text-xs text-gray-600">
                    {emailsWithAttachments.length} emails with attachments
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
                    {loadingResults ? (
                      <div className="text-center py-8 px-4">
                        <div className="animate-pulse space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
                          <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto"></div>
                        </div>
                        <p className="text-gray-500 mt-2">Loading emails...</p>
                      </div>
                    ) : resultsError ? (
                      <div className="text-center py-8 px-4">
                        <p className="text-red-500 text-sm">Failed to load emails</p>
                        <p className="text-gray-400 text-xs">{(resultsError as Error).message}</p>
                      </div>
                    ) : emailsWithAttachments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 px-4">
                        <Paperclip className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm font-medium mb-1">No emails yet</p>
                        <p className="text-xs text-gray-400">Forward emails to analyzer@inboxleap.com</p>
                      </div>
                    ) : (
                      <div className="space-y-2 p-3">
                        {emailsWithAttachments.map((email) => (
                          <div
                            key={email.id}
                            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${
                              selectedEmail?.id === email.id
                                ? 'bg-gradient-to-br from-orange-100 to-orange-50 border-orange-300 shadow-md'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedEmail(email)}
                          >
                            <div className="font-semibold text-sm truncate text-gray-900">
                              {email.subject}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                                <Paperclip className="w-3 h-3 mr-1" />
                                {email.attachmentCount}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3" />
                                {email.sender}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(email.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Main Area - Analysis Details */}
            <div className="flex-1 space-y-4">
              {!selectedEmail ? (
                <Card className="h-full border border-gray-200 shadow-xl">
                  <CardContent className="flex items-center justify-center h-full min-h-[500px]">
                    <div className="text-center">
                      <Info className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">
                        Select an Email
                      </h3>
                      <p className="text-gray-500 text-sm mb-6">
                        Choose an email from the left to view analysis details
                      </p>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-md mx-auto">
                        <p className="text-sm text-gray-700 mb-2">
                          <strong>Send documents to:</strong>
                        </p>
                        <Badge variant="secondary" className="bg-white text-orange-600 text-base px-4 py-2">
                          analyzer@inboxleap.com
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full border border-gray-200 shadow-xl">
                  <CardHeader className="border-b bg-gray-50">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Mail className="w-5 h-5 text-orange-600" />
                      {selectedEmail.subject}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        From {selectedEmail.sender}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(selectedEmail.createdAt).toLocaleDateString()}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 overflow-y-auto max-h-[calc(100vh-16rem)]">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Paperclip className="w-4 h-4 text-orange-600" />
                          Attachments ({selectedEmail.attachmentCount})
                        </h3>
                        {selectedEmail.analysisResults && selectedEmail.analysisResults.length > 0 ? (
                          <div className="space-y-3">
                            {selectedEmail.analysisResults.map((result: any, idx: number) => (
                              <Card key={idx} className="border border-gray-200">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-5 h-5 text-orange-500" />
                                      <div>
                                        <p className="font-medium text-gray-900">{result.filename}</p>
                                        <p className="text-xs text-gray-500">
                                          {result.fileType} • {(result.fileSize / 1024).toFixed(1)} KB
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {result.category && (
                                        <Badge variant="outline" className="text-xs">
                                          {result.category}
                                        </Badge>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => reanalyzeMutation.mutate(result.id)}
                                        disabled={reanalyzeMutation.isPending}
                                        className="text-xs"
                                      >
                                        <RotateCcw className={`w-3 h-3 mr-1 ${reanalyzeMutation.isPending ? 'animate-spin' : ''}`} />
                                        Reanalyze
                                      </Button>
                                    </div>
                                  </div>

                                  {/* AI Analysis */}
                                  {result.aiAnalysis && (
                                    <div className="mt-4 space-y-3">
                                      {result.aiAnalysis.summary && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-1">Summary</h4>
                                          <p className="text-sm text-gray-600">{result.aiAnalysis.summary}</p>
                                        </div>
                                      )}

                                      {result.aiAnalysis.keyPoints && result.aiAnalysis.keyPoints.length > 0 && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Key Points</h4>
                                          <ul className="space-y-1">
                                            {result.aiAnalysis.keyPoints.map((point: string, i: number) => (
                                              <li key={i} className="text-sm text-gray-600 flex gap-2">
                                                <span className="text-orange-500">•</span>
                                                <span>{point}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {result.aiAnalysis.insights && result.aiAnalysis.insights.length > 0 && (
                                        <div>
                                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Insights</h4>
                                          <ul className="space-y-1">
                                            {result.aiAnalysis.insights.map((insight: string, i: number) => (
                                              <li key={i} className="text-sm text-gray-600 flex gap-2">
                                                <span className="text-orange-500">→</span>
                                                <span>{insight}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Extracted Text Preview */}
                                  {result.extractedText && (
                                    <div className="mt-4">
                                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Extracted Text</h4>
                                      <div className="bg-gray-50 rounded p-3 text-xs text-gray-600 max-h-40 overflow-y-auto font-mono">
                                        {result.extractedText.substring(0, 500)}
                                        {result.extractedText.length > 500 && '...'}
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No analysis results available</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
