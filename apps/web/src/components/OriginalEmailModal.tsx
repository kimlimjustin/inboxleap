import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Mail, Calendar, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";

interface OriginalEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
}

interface EmailData {
  from: string;
  date: string;
  subject: string;
  body: string;
}

export default function OriginalEmailModal({ isOpen, onClose, projectId, projectName }: OriginalEmailModalProps) {
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      fetchOriginalEmail();
    }
  }, [isOpen, projectId]);

  const fetchOriginalEmail = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/original-email`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch original email');
      }
      
      const data = await response.json();
      setEmailData(data);
    } catch (err) {
      console.error('Error fetching original email:', err);
      setError(err instanceof Error ? err.message : 'Failed to load email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">Original Email</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Email that created tasks for {projectName}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading email...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={fetchOriginalEmail} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          ) : emailData ? (
            <Card className="p-6 bg-muted/30">
              {/* Email Header */}
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="font-medium">{emailData.from}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">Date</div>
                    <div className="font-medium">{emailData.date}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">Subject</div>
                    <div className="font-medium">{emailData.subject}</div>
                  </div>
                </div>
              </div>
              
              {/* Email Body */}
              <div className="border-t pt-6">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {emailData.body}
                  </pre>
                </div>
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No email data available</p>
            </div>
          )}
        </div>
        
        <div className="pt-4 border-t flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}