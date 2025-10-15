import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Calendar, User, Users, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProcessedEmail {
  id: number;
  messageId: string;
  subject: string;
  sender: string;
  recipients: string[];
  ccList: string[];
  bccList: string[];
  body: string;
  status: string;
  tasksCreated: number;
  createdAt: string;
}

interface EmailChainModalProps {
  projectId: number | null;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function EmailChainModal({ projectId, projectName, isOpen, onClose }: EmailChainModalProps) {
  const { toast } = useToast();

  const { data: emails = [], isLoading, error } = useQuery({
    queryKey: [`/api/projects/${projectId}/emails`],
    enabled: isOpen && projectId !== null,
    retry: false,
  }) as { data: ProcessedEmail[], isLoading: boolean, error: any };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Email content copied to clipboard",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getEmailPreview = (body: string, maxLength: number = 150) => {
    const text = body.replace(/<[^>]*>/g, '').trim();
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 bg-gradient-to-br from-white via-gray-50/30 to-white border border-gray-200 shadow-xl">
        <DialogHeader className="p-6 pb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white border-b border-gray-200">
          <DialogTitle className="flex items-center gap-2 text-white font-semibold">
            <Mail className="h-5 w-5" />
            Email Chain for {projectName}
          </DialogTitle>
          <DialogDescription className="text-white/90">
            View the complete email thread that created this project
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 bg-gradient-to-br from-gray-50/30 via-white to-gray-50/30">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-gray-700 font-medium">Loading email chain...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-red-700 font-medium">Failed to load email chain</div>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-gray-700 font-medium">No emails found for this project</div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4 pb-4">
              {emails.map((email, index) => (
                <Card key={email.id} className="border border-gray-200 bg-gradient-to-br from-white via-gray-50/30 to-white shadow-lg">
                  <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-gray-900">{email.subject}</h4>
                          <Badge variant={email.status === 'processed' ? 'default' : 'secondary'} className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                            {email.status}
                          </Badge>
                          {email.tasksCreated > 0 && (
                            <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 shadow-sm">
                              {email.tasksCreated} tasks created
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-700 font-medium">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>From: {email.sender}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(email.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(email.body)}
                          className="hover:bg-gray-100"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Recipients */}
                    <div className="space-y-2 text-xs">
                      {email.recipients.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 font-medium">To:</span>
                          <div className="flex flex-wrap gap-1">
                            {email.recipients.map((recipient, i) => (
                              <Badge key={i} variant="outline" className="text-xs py-0">
                                {recipient}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {email.ccList && email.ccList.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 font-medium">CC:</span>
                          <div className="flex flex-wrap gap-1">
                            {email.ccList.map((cc, i) => (
                              <Badge key={i} variant="outline" className="text-xs py-0">
                                {cc}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 bg-white">
                    <div className="space-y-3">
                      <Separator />
                      <div className="text-sm">
                        <div className="mb-2 text-gray-800 font-semibold">Email Content:</div>
                        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-3 rounded-md border border-gray-200 shadow-sm">
                          <div className="whitespace-pre-wrap break-words text-gray-900 font-medium leading-relaxed">
                            {getEmailPreview(email.body, 300)}
                          </div>
                          {email.body.length > 300 && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto mt-2 text-blue-600 hover:text-blue-800"
                              onClick={() => copyToClipboard(email.body)}
                            >
                              Copy full content <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end p-6 pt-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700 hover:bg-white font-medium">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
