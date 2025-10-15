import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Shield, Bell, User, Mail, Link, Unlink, Plus, ArrowLeft } from "lucide-react";
import BlacklistManager from "@/components/BlacklistManager";
import { apiRequest } from "@/lib/queryClient";

interface NotificationPreferences {
  id?: number;
  userId: string;
  emailNotifications: boolean;
  newTaskAlerts: boolean;
  projectUpdates: boolean;
  taskStatusChanges: boolean;
  taskAssignments: boolean;
  taskDueReminders: boolean;
  weeklyDigest: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface LinkedAccount {
  id: number;
  provider: 'google' | 'email';
  email: string;
  linkedAt: string;
  lastUsed: string;
  isActive: boolean;
}


export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("account");
  const [notifications, setNotifications] = useState<NotificationPreferences | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedAccountsLoading, setLinkedAccountsLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showAddPasswordModal, setShowAddPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showUpdateProfileModal, setShowUpdateProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  

  // Load notification preferences and linked accounts on component mount
  useEffect(() => {
    loadNotificationPreferences();
    loadLinkedAccounts();
  }, []);

  // Update profile form when user data changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        firstName: (user as any).firstName || '',
        lastName: (user as any).lastName || '',
        email: (user as any).email || ''
      });
    }
  }, [user]);

  const loadNotificationPreferences = async () => {
    try {
      setLoading(true);
      const response = await (await apiRequest('GET', '/api/notifications/preferences')).json();
      setNotifications(response);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateNotificationSetting = async (setting: keyof NotificationPreferences, enabled: boolean) => {
    if (!notifications) return;

    try {
      setUpdating(setting);
      
      await apiRequest('PATCH', `/api/notifications/preferences/${setting}`, {
        enabled
      });

      // Update local state
      setNotifications(prev => prev ? { ...prev, [setting]: enabled } : null);

      toast({
        title: "Settings Updated",
        description: `${setting} has been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating notification setting:', error);
      toast({
        title: "Error",
        description: "Failed to update notification setting",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const loadLinkedAccounts = async () => {
    try {
      setLinkedAccountsLoading(true);
      const response = await (await apiRequest('GET', '/api/auth/linked-accounts')).json();
      // Ensure response is always an array
      setLinkedAccounts(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error loading linked accounts:', error);
      // Set to empty array on error
      setLinkedAccounts([]);
      toast({
        title: "Error",
        description: "Failed to load linked accounts",
        variant: "destructive",
      });
    } finally {
      setLinkedAccountsLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    try {
      // Redirect to Google OAuth for account linking
      const authUrl = `/api/auth/google?link=true`;
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error linking Google account:', error);
      toast({
        title: "Error",
        description: "Failed to link Google account",
        variant: "destructive",
      });
    }
  };

  const handleAddPassword = async () => {
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.password.length < 6) {
      toast({
        title: "Error", 
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating('email');
      await apiRequest('POST', '/api/auth/link-email', {
        password: passwordForm.password,
        confirmPassword: passwordForm.confirmPassword,
      });

      // Add to local state
      const newAccount = {
        id: Date.now(), // Temporary ID
        provider: 'email' as const,
        email: (user as any)?.email || '',
        linkedAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        isActive: true,
      };
      setLinkedAccounts(prev => [...prev, newAccount]);

      // Reset form and close modal
      setPasswordForm({ password: '', confirmPassword: '' });
      setShowAddPasswordModal(false);

      toast({
        title: "Password Added",
        description: "Email and password authentication has been added to your account",
      });
    } catch (error) {
      console.error('Error adding password:', error);
      toast({
        title: "Error",
        description: "Failed to add password authentication",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      toast({
        title: "Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    if (!profileForm.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating('profile');
      await apiRequest('PUT', '/api/auth/user', {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email.trim(),
      });

      setShowUpdateProfileModal(false);

      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated",
      });

      // User data will be refreshed automatically by the query client
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleUnlinkAccount = async (provider: string) => {
    if (linkedAccounts.length <= 1) {
      toast({
        title: "Cannot Unlink",
        description: "You must have at least one authentication method",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating(provider);
      await apiRequest('DELETE', `/api/auth/unlink/${provider}`);
      
      // Remove from local state
      setLinkedAccounts(prev => prev.filter(account => account.provider !== provider));
      
      toast({
        title: "Account Unlinked",
        description: `${provider} authentication has been removed`,
      });
    } catch (error) {
      console.error('Error unlinking account:', error);
      toast({
        title: "Error",
        description: "Failed to unlink account",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-600 via-gray-700 to-slate-800 text-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/dashboard')}
              className="flex items-center gap-2 text-slate-200 hover:text-white hover:bg-white/10 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-slate-100 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-slate-200">Manage your account preferences and privacy settings</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-border/20 mb-8">
            <TabsList className="grid w-full grid-cols-4 bg-transparent gap-2">
              <TabsTrigger 
                value="account" 
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all duration-200 px-3"
              >
                <User className="h-4 w-4" />
                Account
              </TabsTrigger>
              <TabsTrigger 
                value="privacy" 
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all duration-200 px-3"
              >
                <Shield className="h-4 w-4" />
                Privacy
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all duration-200 px-3"
              >
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="email" 
                className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all duration-200 px-3"
              >
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm shadow-xl border border-border/20 rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-border/10">
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <User className="h-5 w-5 text-blue-600" />
                  Account Information
                </CardTitle>
                <CardDescription className="text-gray-600">
                  View and manage your account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                  <p className="text-base font-medium text-gray-900">{(user as any)?.email}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
                  <p className="text-base font-medium text-gray-900">{(user as any)?.firstName && (user as any)?.lastName ? `${(user as any).firstName} ${(user as any).lastName}` : 'Not set'}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary Authentication</label>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={(user as any)?.authProvider === 'google' ? 'default' : 'secondary'}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 px-3 py-1"
                    >
                      {(user as any)?.authProvider === 'google' ? 'Google' : 'Email'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Member Since</label>
                  <p className="text-base font-medium text-gray-900">
                    {(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <Button
                  onClick={() => setShowUpdateProfileModal(true)}
                  disabled={updating === 'profile'}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-md hover:shadow-xl transition-all duration-200 px-6"
                >
                  {updating === 'profile' ? 'Updating...' : 'Update Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border border-border/20 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b border-border/10">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Link className="h-5 w-5 text-green-600" />
                Linked Accounts
              </CardTitle>
              <CardDescription className="text-gray-600">
                Manage your authentication methods. You can sign in with any of these methods.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              {linkedAccountsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-3">Loading linked accounts...</p>
                </div>
              ) : (
                <>
                  {linkedAccounts.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No linked accounts found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {linkedAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200 bg-gradient-to-r from-white to-gray-50/50"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                              {account.provider === 'google' ? (
                                <span className="text-xl font-bold text-blue-600">G</span>
                              ) : (
                                <Mail className="h-6 w-6 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5">
                                <h4 className="font-semibold text-gray-900">
                                  {account.provider === 'google' ? 'Google' : 'Email & Password'}
                                </h4>
                                <Badge variant="outline" className="text-xs capitalize bg-white border-gray-300">
                                  {account.provider}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 font-mono mt-0.5">{account.email}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                Last used: {new Date(account.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {linkedAccounts.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUnlinkAccount(account.provider)}
                                disabled={updating === account.provider}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                              >
                                <Unlink className="h-4 w-4 mr-1.5" />
                                {updating === account.provider ? 'Unlinking...' : 'Unlink'}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new authentication method */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex flex-wrap gap-3">
                      {!linkedAccounts.some(acc => acc.provider === 'google') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleLinkGoogle}
                          disabled={updating === 'google'}
                          className="flex items-center gap-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50"
                        >
                          <Plus className="h-4 w-4" />
                          Link Google Account
                        </Button>
                      )}
                      {!linkedAccounts.some(acc => acc.provider === 'email') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddPasswordModal(true)}
                          disabled={updating === 'email'}
                          className="flex items-center gap-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50"
                        >
                          <Plus className="h-4 w-4" />
                          Add Email & Password
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                      💡 Having multiple authentication methods makes your account more secure and easier to access.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Privacy Tab - This is where the blacklist manager goes */}
        <TabsContent value="privacy" className="space-y-6">
          <BlacklistManager />

          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border border-border/20 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-border/10">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Shield className="h-5 w-5 text-green-600" />
                Data & Privacy
              </CardTitle>
              <CardDescription className="text-gray-600">
                Control how your data is used and stored
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-8">
              <div className="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-sm transition-all duration-200 bg-gradient-to-r from-white to-green-50/30">
                <div>
                  <h4 className="font-semibold text-gray-900">Email Processing</h4>
                  <p className="text-sm text-gray-600 mt-0.5">Allow InboxLeap to process your emails for task creation</p>
                </div>
                <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 px-3 py-1">
                  Enabled
                </Badge>
              </div>

              <div className="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                <div>
                  <h4 className="font-semibold text-gray-900">Data Export</h4>
                  <p className="text-sm text-gray-600 mt-0.5">Download all your data from InboxLeap</p>
                </div>
                <Button variant="outline" size="sm" className="border-blue-200 hover:border-blue-300 hover:bg-blue-50">
                  Request Export
                </Button>
              </div>

              <div className="flex items-center justify-between p-5 border border-red-200 rounded-xl hover:border-red-300 hover:shadow-sm transition-all duration-200 bg-red-50/50">
                <div>
                  <h4 className="font-semibold text-gray-900">Account Deletion</h4>
                  <p className="text-sm text-gray-600 mt-0.5">Permanently delete your account and all data</p>
                </div>
                <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border border-border/20 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b border-border/10">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Bell className="h-5 w-5 text-orange-600" />
                Notification Preferences
              </CardTitle>
              <CardDescription className="text-gray-600">
                Choose when and how you want to be notified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-8">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-3">Loading preferences...</p>
                </div>
              ) : notifications ? (
                <>
                  {/* Master Email Notifications Toggle */}
                  <div className="flex items-center justify-between p-5 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl shadow-sm">
                    <div>
                      <h4 className="font-semibold text-orange-900">Email Notifications</h4>
                      <p className="text-sm text-orange-700 mt-0.5">Master setting for all email notifications</p>
                    </div>
                    <Switch
                      checked={notifications.emailNotifications}
                      onCheckedChange={(checked) => updateNotificationSetting('emailNotifications', checked)}
                      disabled={updating === 'emailNotifications'}
                    />
                  </div>

                  {/* Individual Notification Settings */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                      <div>
                        <h4 className="font-semibold text-gray-900">New Task Alerts</h4>
                        <p className="text-sm text-gray-600 mt-0.5">Get notified when tasks are assigned to you</p>
                      </div>
                      <Switch
                        checked={notifications.newTaskAlerts && notifications.emailNotifications}
                        onCheckedChange={(checked) => updateNotificationSetting('newTaskAlerts', checked)}
                        disabled={!notifications.emailNotifications || updating === 'newTaskAlerts'}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                      <div>
                        <h4 className="font-semibold text-gray-900">Task Assignments</h4>
                        <p className="text-sm text-gray-600 mt-0.5">Notifications when you're assigned to tasks</p>
                      </div>
                      <Switch
                        checked={notifications.taskAssignments && notifications.emailNotifications}
                        onCheckedChange={(checked) => updateNotificationSetting('taskAssignments', checked)}
                        disabled={!notifications.emailNotifications || updating === 'taskAssignments'}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                      <div>
                        <h4 className="font-semibold text-gray-900">Task Status Changes</h4>
                        <p className="text-sm text-gray-600 mt-0.5">Notifications when task status is updated</p>
                      </div>
                      <Switch
                        checked={notifications.taskStatusChanges && notifications.emailNotifications}
                        onCheckedChange={(checked) => updateNotificationSetting('taskStatusChanges', checked)}
                        disabled={!notifications.emailNotifications || updating === 'taskStatusChanges'}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                      <div>
                        <h4 className="font-semibold text-gray-900">Project Updates</h4>
                        <p className="text-sm text-gray-600 mt-0.5">Notifications for project changes and comments</p>
                      </div>
                      <Switch
                        checked={notifications.projectUpdates && notifications.emailNotifications}
                        onCheckedChange={(checked) => updateNotificationSetting('projectUpdates', checked)}
                        disabled={!notifications.emailNotifications || updating === 'projectUpdates'}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                      <div>
                        <h4 className="font-semibold text-gray-900">Task Due Reminders</h4>
                        <p className="text-sm text-gray-600 mt-0.5">Reminders for tasks that are due soon</p>
                      </div>
                      <Switch
                        checked={notifications.taskDueReminders && notifications.emailNotifications}
                        onCheckedChange={(checked) => updateNotificationSetting('taskDueReminders', checked)}
                        disabled={!notifications.emailNotifications || updating === 'taskDueReminders'}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                      <div>
                        <h4 className="font-semibold text-gray-900">Weekly Digest</h4>
                        <p className="text-sm text-gray-600 mt-0.5">Weekly summary of your tasks and activity</p>
                      </div>
                      <Switch
                        checked={notifications.weeklyDigest && notifications.emailNotifications}
                        onCheckedChange={(checked) => updateNotificationSetting('weeklyDigest', checked)}
                        disabled={!notifications.emailNotifications || updating === 'weeklyDigest'}
                      />
                    </div>
                  </div>

                  {!notifications.emailNotifications && (
                    <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 shadow-sm">
                      <p className="text-sm text-orange-900">
                        <strong>⚠️ Note:</strong> All email notifications are disabled. Enable "Email Notifications" above to receive alerts.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-3">Failed to load notification preferences</p>
                  <Button onClick={loadNotificationPreferences} variant="outline" className="border-blue-200 hover:border-blue-300 hover:bg-blue-50">
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm shadow-xl border border-border/20 rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-border/10">
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Mail className="h-5 w-5 text-indigo-600" />
                Email Integration
              </CardTitle>
              <CardDescription className="text-gray-600">
                Manage your email connections and processing preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-8">
              <div className="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-sm transition-all duration-200 bg-gradient-to-r from-white to-green-50/30">
                <div>
                  <h4 className="font-semibold text-gray-900">Email Processing Status</h4>
                  <p className="text-sm text-gray-600 mt-0.5">Current status of email processing</p>
                </div>
                <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 px-3 py-1">
                  Active
                </Badge>
              </div>

              <div className="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all duration-200">
                <div>
                  <h4 className="font-semibold text-gray-900">Supported Agents</h4>
                  <p className="text-sm text-gray-600 mt-0.5">Email agents that can process your emails</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">Todo</Badge>
                  <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">Alex</Badge>
                  <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">Tanya</Badge>
                  <Badge variant="outline" className="bg-orange-50 border-orange-200 text-orange-700">FAQ</Badge>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-sm">
                <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  How to use InboxLeap agents:
                </h4>
                <ul className="space-y-3 text-sm text-blue-900">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span><strong className="text-blue-700">Todo (todo@inboxleap.com):</strong> Task management and project organization</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span><strong className="text-purple-700">Alex (alex@inboxleap.com):</strong> Document analysis and attachment processing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span><strong className="text-green-700">Tanya (t5t@inboxleap.com):</strong> Team intelligence and feedback analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 font-bold">•</span>
                    <span><strong className="text-orange-700">FAQ (faq@inboxleap.com):</strong> Knowledge base and question answering</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>

      {/* Update Profile Modal */}
      <Dialog open={showUpdateProfileModal} onOpenChange={setShowUpdateProfileModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Profile</DialogTitle>
            <DialogDescription>
              Update your personal information and account details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="Enter your first name"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Enter your last name"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileEmail">Email Address</Label>
              <Input
                id="profileEmail"
                type="email"
                placeholder="Enter your email"
                value={profileForm.email}
                onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // Reset form to original user data
                if (user) {
                  setProfileForm({
                    firstName: (user as any).firstName || '',
                    lastName: (user as any).lastName || '',
                    email: (user as any).email || ''
                  });
                }
                setShowUpdateProfileModal(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateProfile}
              disabled={!profileForm.firstName || !profileForm.lastName || !profileForm.email || updating === 'profile'}
            >
              {updating === 'profile' ? 'Updating...' : 'Update Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Password Modal */}
      <Dialog open={showAddPasswordModal} onOpenChange={setShowAddPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Email & Password</DialogTitle>
            <DialogDescription>
              Add email and password authentication to your account for additional security.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded border">
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {(user as any)?.email}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Password authentication will be linked to your current email address.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordForm({ password: '', confirmPassword: '' });
                setShowAddPasswordModal(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPassword}
              disabled={!passwordForm.password || !passwordForm.confirmPassword || updating === 'email'}
            >
              {updating === 'email' ? 'Adding...' : 'Add Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}
