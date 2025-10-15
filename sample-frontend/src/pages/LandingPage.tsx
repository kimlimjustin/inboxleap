import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Zap, 
  Shield, 
  Rocket, 
  BarChart3, 
  MessageCircle, 
  FileText, 
  Paperclip, 
  HelpCircle, 
  Vote,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import Header from '@/components/layout/Header';
import heroImage from '@/assets/hero-image.jpg';

const agents = [
  {
    name: 'Tanya',
    icon: BarChart3,
    color: 'agent-tanya',
    lightColor: 'agent-tanya-light',
    description: 'Top Five Things',
    features: ['Trend Analysis', 'Email Insights', 'Topic Tracking'],
    type: 'Intelligence'
  },
  {
    name: 'Sally',
    icon: MessageCircle,
    color: 'agent-sally',
    lightColor: 'agent-sally-light',
    description: 'Survey & Sentiment',
    features: ['Sentiment Analysis', 'Survey Creation', 'Feedback Collection'],
    type: 'Intelligence'
  },
  {
    name: 'Todo',
    icon: FileText,
    color: 'agent-todo',
    lightColor: 'agent-todo-light',
    description: 'Task Management',
    features: ['Todo Extraction', 'Task Tracking', 'Project Coordination'],
    type: 'Team'
  },
  {
    name: 'Alex',
    icon: Paperclip,
    color: 'agent-alex',
    lightColor: 'agent-alex-light',
    description: 'Attachment Analyzer',
    features: ['File Analysis', 'Content Extraction', 'Document Processing'],
    type: 'Team'
  },
  {
    name: 'FAQ',
    icon: HelpCircle,
    color: 'agent-faq',
    lightColor: 'agent-faq-light',
    description: 'Knowledge Base',
    features: ['SOP Management', 'Q&A Automation', 'Knowledge Sharing'],
    type: 'Team'
  },
  {
    name: 'Polly',
    icon: Vote,
    color: 'agent-polly',
    lightColor: 'agent-polly-light',
    description: 'Fast Polling',
    features: ['Quick Polls', 'Team Voting', 'Decision Making'],
    type: 'Team'
  }
];

const features = [
  {
    icon: Mail,
    title: 'Email-First Approach',
    description: 'No new tools to learn. Just email your AI agents like you would email a colleague.'
  },
  {
    icon: Zap,
    title: 'Instant Processing',
    description: 'Get immediate responses and actions from your AI agents the moment you send an email.'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-level security with end-to-end encryption and compliance with industry standards.'
  },
  {
    icon: Rocket,
    title: 'Scale Effortlessly',
    description: 'From solo entrepreneurs to enterprise teams, InboxLeap grows with your business.'
  }
];

const LandingPage = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        
        {/* Hero Image */}
        <div className="container relative mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left"
            >
              <Badge variant="secondary" className="mb-6 px-4 py-2">
                🚀 The Future of Email Automation
              </Badge>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-6">
                Supercharge Your Inbox with AI Email Agents
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto lg:mx-0">
                Just email the agent. That's it. No complex workflows, no training required. 
                Your AI team is ready to work.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
                  onClick={() => setLocation('/auth/email')}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" className="hover-lift">
                  Watch Demo
                </Button>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <img 
                src={heroImage} 
                alt="InboxLeap AI Email Agents Dashboard" 
                className="w-full rounded-2xl shadow-2xl hover-lift"
              />
              <div className="absolute inset-0 bg-gradient-hero opacity-20 rounded-2xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose InboxLeap?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transform your email workflow with intelligent automation that feels natural.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full hover-lift border-0 shadow-soft">
                  <CardHeader>
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents Showcase */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Meet Your AI Team
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Each agent specializes in different aspects of your workflow. 
              Email them directly to get things done.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full hover-lift border-0 shadow-soft overflow-hidden">
                  <CardHeader className="relative">
                    <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-xs font-medium ${agent.lightColor}`}>
                      {agent.type}
                    </div>
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${agent.color}`}>
                      <agent.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl">{agent.name}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {agent.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {agent.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {agent.name.toLowerCase()}@inboxleap.com
                      </code>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Transform Your Inbox?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of teams already using InboxLeap to automate their email workflows.
            </p>
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              onClick={() => setLocation('/auth/email')}
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
