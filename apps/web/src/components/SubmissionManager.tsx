import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Trash2, 
  MessageSquare, 
  Clock, 
  User, 
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Submission {
  id: number;
  subject: string;
  rawContent: string;
  submitterEmail: string;
  submitterUserId: string;
  submissionDate: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore?: number;
  topics?: string[];
  processingStatus: 'pending' | 'processed' | 'failed';
  processingError?: string;
}

interface SubmissionManagerProps {
  agentId: number;
  agentName: string;
}

export default function SubmissionManager({ agentId, agentName }: SubmissionManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Load submissions
  useEffect(() => {
    loadSubmissions();
  }, [agentId]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const response = await (await apiRequest('GET', `/api/polling/agents/${agentId}/submissions?limit=50`)).json();
      setSubmissions(response.submissions || []);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error('Failed to load submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete single submission
  const deleteSingleMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      await apiRequest('DELETE', `/api/polling/agents/${agentId}/submissions/${submissionId}`);
    },
    onSuccess: (_, submissionId) => {
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      toast({
        title: "Success",
        description: "Submission deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete submission",
        variant: "destructive",
      });
    },
  });

  // Delete multiple submissions
  const deleteMultipleMutation = useMutation({
    mutationFn: async (submissionIds: number[]) => {
      await apiRequest('DELETE', `/api/polling/agents/${agentId}/submissions`, {
        submissionIds
      });
    },
    onSuccess: (_, submissionIds) => {
      setSubmissions(prev => prev.filter(s => !submissionIds.includes(s.id)));
      setSelectedSubmissions(new Set());
      toast({
        title: "Success",
        description: `${submissionIds.length} submissions deleted successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete submissions",
        variant: "destructive",
      });
    },
  });

  const handleSelectSubmission = (submissionId: number, checked: boolean) => {
    const newSelected = new Set(selectedSubmissions);
    if (checked) {
      newSelected.add(submissionId);
    } else {
      newSelected.delete(submissionId);
    }
    setSelectedSubmissions(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubmissions(new Set(submissions.map(s => s.id)));
    } else {
      setSelectedSubmissions(new Set());
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submissions & Threads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading submissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Submissions & Threads
              <Badge variant="secondary">{totalCount}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage email submissions for {agentName}
            </p>
          </div>
          
          {selectedSubmissions.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  disabled={deleteMultipleMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedSubmissions.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Submissions</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedSubmissions.size} selected submissions? 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMultipleMutation.mutate(Array.from(selectedSubmissions))}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleteMultipleMutation.isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {submissions.length === 0 ? (
          <div className="text-center py-8 px-6">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
            <p className="text-gray-500">Email submissions will appear here when received</p>
          </div>
        ) : (
          <>
            {/* Select All Header */}
            <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
              <Checkbox
                checked={selectedSubmissions.size === submissions.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">
                Select All ({submissions.length} submissions)
              </span>
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-2 p-4">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className={`p-4 border rounded-lg hover:bg-gray-50 transition-colors ${
                      selectedSubmissions.has(submission.id) ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedSubmissions.has(submission.id)}
                        onCheckedChange={(checked) => handleSelectSubmission(submission.id, checked === true)}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900 truncate">
                            {submission.subject}
                          </h4>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this submission from {submission.submitterEmail}? 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSingleMutation.mutate(submission.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {deleteSingleMutation.isPending ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {submission.submitterEmail}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(submission.submissionDate)}
                          </div>
                          <div className="flex items-center gap-1">
                            {getSentimentIcon(submission.sentiment)}
                            {submission.sentiment}
                          </div>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(submission.processingStatus)}
                            {submission.processingStatus}
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                          {submission.rawContent}
                        </p>

                        {submission.topics && submission.topics.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {submission.topics.slice(0, 3).map((topic, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                            {submission.topics.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{submission.topics.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}

                        {submission.processingError && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            <strong>Processing Error:</strong> {submission.processingError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}