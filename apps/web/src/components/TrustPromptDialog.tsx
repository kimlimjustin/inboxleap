import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, ShieldCheck, UserCheck, UserX, Clock } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface PendingTrustUser {
  assignerId: string;
  assignerName: string;
  assignerEmail: string;
  taskCount: number;
}

interface TrustPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingUsers: PendingTrustUser[];
}

export default function TrustPromptDialog({ 
  isOpen, 
  onClose, 
  pendingUsers 
}: TrustPromptDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingDecisions, setProcessingDecisions] = useState<Set<string>>(new Set());

  const trustDecisionMutation = useMutation({
    mutationFn: async ({ assignerId, decision }: { assignerId: string; decision: 'trust' | 'block' }) => {
      const response = await fetch('/api/trust/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ assignerId, decision }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process trust decision');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      const user = pendingUsers.find(u => u.assignerId === variables.assignerId);
      const userEmail = user?.assignerEmail || 'Unknown';
      
      toast({
        title: variables.decision === 'trust' ? "User Trusted" : "User Blocked",
        description: variables.decision === 'trust' 
          ? `You will now receive notifications from ${userEmail}` 
          : `You will no longer receive notifications from ${userEmail}`,
      });

      // Remove from processing set
      setProcessingDecisions(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.assignerId);
        return newSet;
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/trust/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trust/relationships'] });
    },
    onError: (error, variables) => {
      console.error('Trust decision error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process trust decision",
        variant: "destructive",
      });

      // Remove from processing set
      setProcessingDecisions(prev => {
        const newSet = new Set(prev);
        newSet.delete(variables.assignerId);
        return newSet;
      });
    },
  });

  const handleDecision = async (assignerId: string, decision: 'trust' | 'block') => {
    setProcessingDecisions(prev => new Set(prev).add(assignerId));
    trustDecisionMutation.mutate({ assignerId, decision });
  };

  const handleDecideLater = () => {
    toast({
      title: "Decisions Postponed",
      description: "You can make trust decisions later from your dashboard",
    });
    onClose();
  };

  if (!pendingUsers || pendingUsers.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Trust & Safety
          </DialogTitle>
          <DialogDescription>
            You have received task assignments from new users. Would you like to trust these users 
            to receive future notifications, or block them to prevent spam?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <Card key={user.assignerId} className="border border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCheck className="h-4 w-4 text-blue-600" />
                    </div>
                    <span>{user.assignerName}</span>
                  </div>
                  <Badge variant="secondary">
                    {user.taskCount} task{user.taskCount === 1 ? '' : 's'}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-gray-600">{user.assignerEmail}</p>
              </CardHeader>
              
              <CardContent>
                <div className="bg-gray-50 p-3 rounded-lg mb-4">
                  <p className="text-sm text-gray-700">
                    This user has assigned you <strong>{user.taskCount}</strong> task{user.taskCount === 1 ? '' : 's'}. 
                    Choose whether to trust them for future notifications.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleDecision(user.assignerId, 'trust')}
                    disabled={processingDecisions.has(user.assignerId)}
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {processingDecisions.has(user.assignerId) ? 'Processing...' : 'Trust User'}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleDecision(user.assignerId, 'block')}
                    disabled={processingDecisions.has(user.assignerId)}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    {processingDecisions.has(user.assignerId) ? 'Processing...' : 'Block User'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex items-center text-sm text-gray-600">
            <Shield className="h-4 w-4 mr-1" />
            Your privacy and security are important to us
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDecideLater}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Decide Later
            </Button>
          </div>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <strong>What this means:</strong>
          <ul className="mt-1 space-y-1">
            <li>• <strong>Trust:</strong> You'll receive email notifications when this user assigns you tasks</li>
            <li>• <strong>Block:</strong> You won't receive notifications from this user (they won't know)</li>
            <li>• <strong>Decide Later:</strong> You can make these decisions anytime from your dashboard</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}