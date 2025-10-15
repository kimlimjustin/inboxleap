import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, ArrowRight, FileText, Users, Brain, MessageCircle, BarChart3, Vote, Paperclip, HelpCircle } from 'lucide-react';
import { detectBestAgent, getRoutingExplanation, TEST_CASES, EmailContent } from '@/lib/agentAutoDetection';
import { AGENTS } from '@/config/agents';
import DismissibleHint from '@/components/DismissibleHint';

const getAgentIcon = (agentId: string) => {
  const iconMap: Record<string, any> = {
    todo: FileText,
    polly: Vote,
    alex: Paperclip,
    faq: HelpCircle,
    t5t: BarChart3,
    sally: MessageCircle,
  };
  return iconMap[agentId] || Bot;
};

const getAgentColor = (agentId: string) => {
  const agent = AGENTS.find(a => a.id === agentId);
  return agent?.color || 'gray';
};

export default function AutoRouterPage() {
  const [testEmail, setTestEmail] = useState({
    subject: '',
    body: '',
    attachments: [] as string[]
  });
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [attachmentInput, setAttachmentInput] = useState('');

  const handleDetection = () => {
    const result = detectBestAgent(testEmail);
    setDetectionResult(result);
  };

  const runTestCase = (testCase: any) => {
    setTestEmail(testCase.email);
    const result = detectBestAgent(testCase.email);
    setDetectionResult(result);
  };

  const addAttachment = () => {
    if (attachmentInput.trim()) {
      setTestEmail(prev => ({
        ...prev,
        attachments: [...prev.attachments, attachmentInput.trim()]
      }));
      setAttachmentInput('');
    }
  };

  const removeAttachment = (index: number) => {
    setTestEmail(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Auto Router</h1>
              <p className="text-gray-600">Smart email routing to specialist agents</p>
            </div>
          </div>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto">
            Send emails to <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">agent@inboxleap.com</code> and
            I'll automatically analyze the content to route your message to the most appropriate specialist agent.
          </p>
        </div>

        <DismissibleHint
          id="auto-router-getting-started"
          title="How Auto Router Works"
          className="mb-6"
        >
          <p>
            Can't decide which agent to use? Send your email to <strong>agent@inboxleap.com</strong> and I'll analyze the content to automatically route it to the best specialist agent based on keywords, attachments, and context.
          </p>
        </DismissibleHint>

        <Tabs defaultValue="demo" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="demo">Try Demo</TabsTrigger>
            <TabsTrigger value="examples">Test Cases</TabsTrigger>
            <TabsTrigger value="agents">Available Agents</TabsTrigger>
          </TabsList>

          {/* Demo Tab */}
          <TabsContent value="demo" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Content</CardTitle>
                  <CardDescription>
                    Enter your email content below to see which agent would handle it
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      placeholder="Enter email subject..."
                      value={testEmail.subject}
                      onChange={(e) => setTestEmail(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body">Email Body</Label>
                    <Textarea
                      id="body"
                      placeholder="Enter email content..."
                      value={testEmail.body}
                      onChange={(e) => setTestEmail(prev => ({ ...prev, body: e.target.value }))}
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Attachments</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="filename.pdf"
                        value={attachmentInput}
                        onChange={(e) => setAttachmentInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addAttachment()}
                      />
                      <Button onClick={addAttachment} size="sm">Add</Button>
                    </div>
                    {testEmail.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {testEmail.attachments.map((file, index) => (
                          <Badge key={index} variant="outline" className="gap-1">
                            {file}
                            <button onClick={() => removeAttachment(index)} className="ml-1">×</button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleDetection}
                    className="w-full"
                    disabled={!testEmail.subject && !testEmail.body}
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    Analyze & Route
                  </Button>
                </CardContent>
              </Card>

              {/* Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Routing Result</CardTitle>
                  <CardDescription>
                    Analysis and recommended agent routing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {detectionResult ? (
                    <div className="space-y-4">
                      {/* Recommended Agent */}
                      <div className="flex items-center gap-3 p-4 border rounded-lg bg-gray-50">
                        <div className={`w-10 h-10 bg-${getAgentColor(detectionResult.agentId)}-600 rounded-lg flex items-center justify-center`}>
                          {React.createElement(getAgentIcon(detectionResult.agentId), {
                            className: "w-5 h-5 text-white"
                          })}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{detectionResult.agent?.name}</h3>
                          <p className="text-sm text-gray-600">{detectionResult.agent?.type}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={detectionResult.confidence >= 0.7 ? 'default' : 'secondary'}>
                            {Math.round(detectionResult.confidence * 100)}% match
                          </Badge>
                        </div>
                      </div>

                      {/* Explanation */}
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">Why this agent?</h4>
                        <p className="text-sm text-blue-800">
                          {getRoutingExplanation(detectionResult)}
                        </p>
                      </div>

                      {/* Detection Reasons */}
                      {detectionResult.reasons.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Detection Factors:</h4>
                          <ul className="space-y-1">
                            {detectionResult.reasons.map((reason: string, index: number) => (
                              <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Next Steps */}
                      <div className="pt-4 border-t">
                        <p className="text-sm text-gray-600 mb-3">
                          In practice, your email would be automatically forwarded to:
                        </p>
                        <div className="flex items-center gap-2 text-sm font-mono bg-gray-100 p-2 rounded">
                          <span>{detectionResult.agent?.email}</span>
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                          <span className="text-green-600">Routed automatically</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Enter email content and click "Analyze & Route" to see the magic happen!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Test Cases Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pre-built Test Cases</CardTitle>
                <CardDescription>
                  Try these example emails to see how the auto-router works
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {TEST_CASES.map((testCase, index) => (
                    <Card key={index} className="border-2 border-dashed hover:border-solid transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{testCase.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {AGENTS.find(a => a.id === testCase.expectedAgent)?.name}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">
                            <strong>Subject:</strong> {testCase.email.subject}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            <strong>Body:</strong> {testCase.email.body.substring(0, 100)}...
                          </p>
                          {testCase.email.attachments.length > 0 && (
                            <p className="text-xs text-gray-600">
                              <strong>Attachments:</strong> {testCase.email.attachments.join(', ')}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="w-full mt-3"
                          onClick={() => runTestCase(testCase)}
                        >
                          Test This Case
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Available Agents Tab */}
          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Specialist Agents</CardTitle>
                <CardDescription>
                  These are the agents that Auto Router can intelligently route your emails to
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {AGENTS.filter(agent => agent.id !== 'agent').map((agent) => (
                    <Card key={agent.id} className="border">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 bg-${agent.color}-600 rounded-lg flex items-center justify-center`}>
                            {React.createElement(agent.icon, { className: "w-4 h-4 text-white" })}
                          </div>
                          <div>
                            <CardTitle className="text-sm">{agent.name}</CardTitle>
                            <Badge variant="outline" className="text-xs">{agent.type}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-gray-600 mb-2">{agent.description}</p>
                        <div className="space-y-1">
                          {agent.features.slice(0, 2).map((feature, index) => (
                            <p key={index} className="text-xs text-gray-500">• {feature}</p>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-gray-400 font-mono">{agent.email}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}