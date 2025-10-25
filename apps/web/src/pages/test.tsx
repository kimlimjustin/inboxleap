import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Mail, Zap, Users, MessageSquare, AlertTriangle, CheckCircle, ListTodo } from 'lucide-react';

const EMAIL_TYPES = [
  { id: 'task-request', name: 'Task Request', icon: CheckCircle, description: 'Emails requesting specific tasks or actions' },
  { id: 'team-collaboration', name: 'Team Collaboration', icon: Users, description: 'Emails about team projects and coordination' },
  { id: 'question-inquiry', name: 'Questions & Inquiries', icon: MessageSquare, description: 'FAQ-style questions and information requests' },
  { id: 'urgent-issue', name: 'Urgent Issues', icon: AlertTriangle, description: 'High-priority problems requiring immediate attention' },
  { id: 'project-update', name: 'Project Updates', icon: Zap, description: 'Status updates and progress reports' },
  { id: 'meeting-schedule', name: 'Meeting & Scheduling', icon: Users, description: 'Meeting requests and calendar coordination' }
];


export default function TestPage() {
  const { toast } = useToast();

  // Set page title
  useEffect(() => {
    document.title = 'Email Testing - InboxLeap';
  }, []);
  const [emailCount, setEmailCount] = useState(10);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['task-request', 'team-collaboration']);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customFromEmail, setCustomFromEmail] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customTargetEmail, setCustomTargetEmail] = useState('');
  const [useAutoEmails, setUseAutoEmails] = useState(true);
  const [todoTaskCount, setTodoTaskCount] = useState(5);

  const generateEmailsMutation = useMutation({
    mutationFn: async (data: {
      count: number;
      types: string[];
      emails?: string[];
      customFromEmail?: string;
      customSubject?: string;
    }) => {
      const response = await apiRequest('POST', '/api/test/generate-emails', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Emails Generated Successfully",
        description: `Generated ${data.count} test emails and processed them through the system`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate test emails",
        variant: "destructive",
      });
    },
  });

  const clearEmailsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/test/clear-emails');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Test Emails Cleared',
        description: `Cleared ${data.data.deleted} test emails from your account`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Clear Emails',
        description: error.message || 'Unable to clear test emails',
        variant: 'destructive',
      });
    },
  });

  const sendTodoSampleMutation = useMutation({
    mutationFn: async (count: number) => {
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(
          apiRequest('POST', '/api/test/send-todo-sample', {}).then(r => r.json())
        );
      }
      const results = await Promise.all(promises);
      return { count, results };
    },
    onSuccess: (data) => {
      toast({
        title: 'Todo Samples Queued',
        description: `Queued ${data.count} task email${data.count > 1 ? 's' : ''} to your Todo instance`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Send Todo Samples',
        description: error.message || 'Unable to queue the Todo sample emails',
        variant: 'destructive',
      });
    },
  });

  const handleTypeToggle = (typeId: string) => {
    setSelectedTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  };

  const handleEmailRemove = (emailId: string) => {
    setSelectedEmails(prev => prev.filter(id => id !== emailId));
  };

  const handleCustomEmailAdd = () => {
    if (customTargetEmail && !selectedEmails.includes(customTargetEmail)) {
      setSelectedEmails(prev => [...prev, customTargetEmail]);
      setCustomTargetEmail('');
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedTypes.length === 0) {
      toast({
        title: "Select Email Types",
        description: "Please select at least one email type to generate",
        variant: "destructive",
      });
      return;
    }

    if (!useAutoEmails && selectedEmails.length === 0) {
      toast({
        title: "Select Target Emails",
        description: "Please select at least one email address to send emails to",
        variant: "destructive",
      });
      return;
    }

    generateEmailsMutation.mutate({
      count: emailCount,
      types: selectedTypes,
      emails: useAutoEmails ? undefined : selectedEmails,
      customFromEmail: customFromEmail || undefined,
      customSubject: customSubject || undefined,
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Email Testing Generator
        </h1>
        <p className="text-lg text-muted-foreground">
          Generate bulk test emails to specific email addresses for testing agent processing and collaboration features
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Quick Todo Tester
          </CardTitle>
          <CardDescription>
            Generate test task emails directly to your Todo instance (todo@inboxleap.com).
            Perfect for testing the Todo agent's task extraction and organization features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="todoCount">Number of Task Emails</Label>
            <Select value={todoTaskCount.toString()} onValueChange={(value) => setTodoTaskCount(parseInt(value))}>
              <SelectTrigger id="todoCount" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 task</SelectItem>
                <SelectItem value="3">3 tasks</SelectItem>
                <SelectItem value="5">5 tasks</SelectItem>
                <SelectItem value="10">10 tasks</SelectItem>
                <SelectItem value="20">20 tasks</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              All emails will be sent to your todo@inboxleap.com instance
            </p>
          </div>

          <Button
            type="button"
            onClick={() => sendTodoSampleMutation.mutate(todoTaskCount)}
            disabled={sendTodoSampleMutation.isPending}
            className="w-full sm:w-auto"
          >
            {sendTodoSampleMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending {todoTaskCount} Task{todoTaskCount > 1 ? 's' : ''}...
              </>
            ) : (
              <>
                <ListTodo className="h-4 w-4 mr-2" />
                Generate {todoTaskCount} Todo Task{todoTaskCount > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Bulk Email Generation
          </CardTitle>
          <CardDescription>
            Generate realistic test emails and automatically send them to all your agent instances.
            The emails will be processed as if they were retrieved from an email provider.
            Perfect for testing intelligence analysis and agent coordination features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Count */}
            <div className="space-y-2">
              <Label htmlFor="count">Number of Emails</Label>
              <Select value={emailCount.toString()} onValueChange={(value) => setEmailCount(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 emails</SelectItem>
                  <SelectItem value="10">10 emails</SelectItem>
                  <SelectItem value="25">25 emails</SelectItem>
                  <SelectItem value="50">50 emails</SelectItem>
                  <SelectItem value="100">100 emails</SelectItem>
                  <SelectItem value="250">250 emails</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email Types */}
            <div className="space-y-3">
              <Label>Email Types to Generate</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {EMAIL_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.id}
                      className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTypes.includes(type.id) 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleTypeToggle(type.id)}
                    >
                      <Checkbox 
                        checked={selectedTypes.includes(type.id)}
                        onChange={() => handleTypeToggle(type.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{type.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Target Email Selection */}
            <div className="space-y-4">
              <Label>Target Emails</Label>

              {/* Toggle between auto and manual */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="auto-emails"
                    name="email-mode"
                    checked={useAutoEmails}
                    onChange={() => setUseAutoEmails(true)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <Label htmlFor="auto-emails" className="text-sm cursor-pointer">
                    Send to all my agent instances
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="manual-emails"
                    name="email-mode"
                    checked={!useAutoEmails}
                    onChange={() => setUseAutoEmails(false)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <Label htmlFor="manual-emails" className="text-sm cursor-pointer">
                    Choose specific instances
                  </Label>
                </div>
              </div>

              {useAutoEmails ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    Test emails will be sent to all your agent email addresses
                    (t5t@inboxleap.com, todo@inboxleap.com, analyzer@inboxleap.com, polly@inboxleap.com, faq@inboxleap.com instances).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Manual email selection */}
                  <div className="space-y-2">
                    <Label className="text-sm">Enter Agent Email Address</Label>
                    <div className="flex gap-2">
                      <Input
                        value={customTargetEmail}
                        onChange={(e) => setCustomTargetEmail(e.target.value)}
                        placeholder="t5t@inboxleap.com"
                        type="email"
                      />
                      <Button
                        type="button"
                        onClick={handleCustomEmailAdd}
                        variant="outline"
                        disabled={!customTargetEmail}
                      >
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Only your own agent instance emails will work
                    </p>
                  </div>

                  {/* Show selected emails */}
                  {selectedEmails.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Selected Email Addresses:</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedEmails.map(email => (
                          <div
                            key={email}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm"
                          >
                            {email}
                            <button
                              type="button"
                              onClick={() => handleEmailRemove(email)}
                              className="text-red-500 hover:text-red-700 ml-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional Customization */}
            <div className="space-y-4">
              <Label>Optional Customization</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customFrom" className="text-sm">Custom From Email</Label>
                  <Input
                    id="customFrom"
                    value={customFromEmail}
                    onChange={(e) => setCustomFromEmail(e.target.value)}
                    placeholder="test@example.com (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customSubject" className="text-sm">Custom Subject Prefix</Label>
                  <Input
                    id="customSubject"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="[TEST] (optional)"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={generateEmailsMutation.isPending}
              >
                {generateEmailsMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating Emails...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate {emailCount} Test Emails
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={clearEmailsMutation.isPending}
                onClick={() => clearEmailsMutation.mutate()}
              >
                {clearEmailsMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                    Clearing Emails...
                  </>
                ) : (
                  <>
                    Clear My Test Emails
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="mt-6 border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-800">Testing Environment Only</h3>
              <p className="text-sm text-orange-700 mt-1">
                This tool is for testing purposes only. It simulates incoming emails without actually sending them through Postmark.
                The generated emails will be processed by the agent system as if they were real incoming messages.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}