import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Trash2, UserX, UserCheck, Plus } from "lucide-react";

interface BlockedUser {
  email: string;
}

export default function BlacklistManager() {
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [newEmailToBlock, setNewEmailToBlock] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocking, setIsBlocking] = useState(false);

  // Load blocked users on component mount
  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      const response = await fetch('/api/trust/blocked', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBlockedUsers(data.blockedUsers || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load blocked users",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading blocked users:', error);
      toast({
        title: "Error", 
        description: "Failed to load blocked users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const blockUser = async () => {
    if (!newEmailToBlock.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address to block",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmailToBlock.trim())) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (blockedUsers.includes(newEmailToBlock.trim().toLowerCase())) {
      toast({
        title: "Error",
        description: "This user is already blocked",
        variant: "destructive",
      });
      return;
    }

    setIsBlocking(true);
    try {
      const response = await fetch('/api/trust/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          emailToBlock: newEmailToBlock.trim().toLowerCase(),
        }),
      });

      if (response.ok) {
        setBlockedUsers(prev => [...prev, newEmailToBlock.trim().toLowerCase()]);
        setNewEmailToBlock("");
        toast({
          title: "Success",
          description: `Successfully blocked ${newEmailToBlock.trim()}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to block user",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: "Error",
        description: "Failed to block user",
        variant: "destructive",
      });
    } finally {
      setIsBlocking(false);
    }
  };

  const unblockUser = async (email: string) => {
    try {
      const response = await fetch('/api/trust/unblock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          blockedEmail: email,
        }),
      });

      if (response.ok) {
        setBlockedUsers(prev => prev.filter(blockedEmail => blockedEmail !== email));
        toast({
          title: "Success",
          description: `Successfully unblocked ${email}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to unblock user",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      toast({
        title: "Error",
        description: "Failed to unblock user",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      blockUser();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading blocked users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5" />
          Collaboration Blacklist
        </CardTitle>
        <CardDescription>
          Manage users who cannot include you in InboxLeap projects. 
          When someone on your blacklist tries to CC you on emails to agents, they'll be notified that you've opted out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new blocked user */}
        <div className="space-y-4">
          <Label htmlFor="email-to-block">Block a user</Label>
          <div className="flex gap-2">
            <Input
              id="email-to-block"
              type="email"
              placeholder="Enter email address to block"
              value={newEmailToBlock}
              onChange={(e) => setNewEmailToBlock(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button 
              onClick={blockUser} 
              disabled={isBlocking}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {isBlocking ? "Blocking..." : "Block"}
            </Button>
          </div>
        </div>

        {/* List of blocked users */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Blocked Users ({blockedUsers.length})</Label>
          </div>
          
          {blockedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No blocked users</p>
              <p className="text-sm">Users you block will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((email) => (
                <div 
                  key={email}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <UserX className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium">{email}</p>
                      <p className="text-sm text-gray-500">Blocked from collaborations</p>
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Unblock user?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to unblock <strong>{email}</strong>? 
                          They will be able to include you in InboxLeap collaborations again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => unblockUser(email)}>
                          Unblock
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <h4 className="font-medium text-blue-900 mb-2">How this works:</h4>
          <ul className="space-y-1 text-blue-800">
            <li>• When someone tries to CC you on emails to InboxLeap agents, they'll be notified you've opted out</li>
            <li>• Blocked users cannot add you to new projects or existing collaborations</li>
            <li>• You can unblock users at any time to allow future collaborations</li>
            <li>• This doesn't affect your existing projects - only new invitations</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}