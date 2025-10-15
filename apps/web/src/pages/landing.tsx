import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageCircle, FileText, BarChart3, Users, CheckCircle, ArrowRight } from "lucide-react";

export default function Landing() {
  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleEmailLogin = () => {
    // Redirect to email sign in/up page
    window.location.href = "/auth/email";
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-gray-900">InboxLeap</div>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 py-2">Features</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 py-2">How It Works</a>
              <a href="#agents" className="text-gray-600 hover:text-gray-900 py-2">Agents</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 py-2">Pricing</a>
              <Button variant="ghost" onClick={handleGoogleLogin} className="h-10">Sign In</Button>
              <Button onClick={handleGoogleLogin} className="bg-blue-600 hover:bg-blue-700 h-10">
                Get Started
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Supercharge Your <br />
            Inbox with <span className="text-blue-600">AI</span> <br />
            <span className="text-blue-600">Email Agents</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            <span className="font-semibold">Just email the agent.</span> That's it.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button 
              variant="outline"
              onClick={handleGoogleLogin}
              className="flex items-center gap-2 text-gray-700 border-gray-300 hover:bg-gray-50"
            >
              <div className="w-5 h-5 bg-red-500 rounded flex items-center justify-center text-white text-xs font-bold">G</div>
              Start with Google
            </Button>
            <Button 
              onClick={handleEmailLogin}
              className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
            >
              Start with email
            </Button>
          </div>
        </div>
      </section>

      {/* Meet Your Agents Section */}
      <section id="agents" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Meet Your <span className="text-blue-600">Agents</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Each agent has a name, a role, and a simple goal. <br />
              Get things done for you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Todo - Task Management */}
            <Card className="p-8 hover:shadow-lg transition-shadow bg-blue-50/30 border-blue-100">
              <div className="text-center">
                {/* Profile Image with Badge */}
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-400">👩‍💼</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                    <span className="text-white text-sm font-bold">T</span>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Todo</h3>
                <p className="text-blue-600 font-medium mb-6">Task Management</p>
                
                <ul className="text-left space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Extracts to-dos, priorities, and deadlines</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Auto-assigns tasks to recipients</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Turns threads into project lists</span>
                  </li>
                </ul>
                
                <div className="bg-blue-50 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 italic">
                    "Don't let tasks slip — Todo keeps them in check."
                  </p>
                </div>
                
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" size="sm" className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50">
                    <MessageCircle className="w-4 h-4" />
                    Chat with Todo
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => window.location.href = "mailto:todo@inboxleap.com"}>
                    📧 Email Todo
                  </Button>
                </div>
              </div>
            </Card>

            {/* Polly - Fast Polling */}
            <Card className="p-8 hover:shadow-lg transition-shadow bg-purple-50/30 border-purple-100">
              <div className="text-center">
                {/* Profile Image with Badge */}
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-400">👩‍💼</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white">
                    <span className="text-white text-sm font-bold">P</span>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Polly</h3>
                <p className="text-purple-600 font-medium mb-6">Fast Polling</p>
                
                <ul className="text-left space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Creates polls from questions in your emails</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Collects votes and shares real-time results</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Great for scheduling, approvals, decisions</span>
                  </li>
                </ul>
                
                <div className="bg-purple-50 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 italic">
                    "No more back-and-forth. Just answers."
                  </p>
                </div>
                
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" size="sm" className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50">
                    <MessageCircle className="w-4 h-4" />
                    Chat with Polly
                  </Button>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => window.location.href = "mailto:polly@inboxleap.com"}>
                    📧 Email Polly
                  </Button>
                </div>
              </div>
            </Card>

            {/* Dina - Document Intelligence */}
            <Card className="p-8 hover:shadow-lg transition-shadow bg-orange-50/30 border-orange-100">
              <div className="text-center">
                {/* Profile Image with Badge */}
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-400">👩‍💼</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center border-2 border-white">
                    <span className="text-white text-sm font-bold">D</span>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Dina</h3>
                <p className="text-orange-600 font-medium mb-6">Document Intelligence</p>
                
                <ul className="text-left space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Summarizes contracts and attachments</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Extracts insights, risks, and actions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Links summaries to dashboards</span>
                  </li>
                </ul>
                
                <div className="bg-orange-50 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 italic">
                    "She highlights what matters — so you don't have to."
                  </p>
                </div>
                
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" size="sm" className="flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
                    <MessageCircle className="w-4 h-4" />
                    Chat with Dina
                  </Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => window.location.href = "mailto:intelligence@inboxleap.com"}>
                    📧 Email Dina
                  </Button>
                </div>
              </div>
            </Card>

            {/* Cara - Conversational AI */}
            <Card className="p-8 hover:shadow-lg transition-shadow bg-green-50/30 border-green-100">
              <div className="text-center">
                {/* Profile Image with Badge */}
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-400">👩‍💼</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center border-2 border-white">
                    <span className="text-white text-sm font-bold">C</span>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-1">Cara</h3>
                <p className="text-green-600 font-medium mb-6">Conversational AI, On Call</p>
                
                <ul className="text-left space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Handles chat-like email threads and inbox discussions</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Flags unanswered questions and open issues</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">Summarizes key points and next steps</span>
                  </li>
                </ul>
                
                <div className="bg-green-50 p-4 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 italic">
                    "From chatter to clarity — Cara keeps it clean."
                  </p>
                </div>
                
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" size="sm" className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50">
                    <MessageCircle className="w-4 h-4" />
                    Chat with Cara
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => window.location.href = "mailto:t5t@inboxleap.com"}>
                    📧 Email Cara
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It <span className="text-blue-600">Works</span>
            </h2>
            <p className="text-lg text-gray-600">Just email the agent.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">1</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Sign Up</h3>
              <p className="text-gray-600 mb-6">
                Create your InboxLeap account — no download required.
              </p>
              <Button variant="outline" onClick={handleGoogleLogin}>Sign Up</Button>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">2</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Send Your First Email</h3>
              <p className="text-gray-600 mb-6">
                Email any agent (e.g., todo@inboxleap.com) and get instant results.
              </p>
              <Button variant="outline" onClick={() => window.location.href = "mailto:todo@inboxleap.com"}>Send Email</Button>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl font-bold text-white">3</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">Let the Agents Work</h3>
              <p className="text-gray-600 mb-6">
                Tasks, polls, documents, and threads — handled.
              </p>
              <div className="text-sm text-gray-500">
                Your agents will respond with organized results and next steps.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Can Do Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              What You Can <span className="text-blue-600">Do</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4 p-6 bg-white rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Assign and manage tasks</h3>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-white rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Run team polls</h3>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 bg-white rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Analyze PDFs and contracts</h3>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-lg border border-green-200">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-700">Use your own email domain if you prefer</span>
            </div>
          </div>
        </div>
      </section>

      {/* Where Email Means Action Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Where Email Means <br />
            <span className="text-blue-600">Action</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Let Todo, Polly, Dina, and Cara bring order to your inbox — just email them.
          </p>
          <Button 
            onClick={handleGoogleLogin}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-4"
          >
            Get Started
          </Button>
          <p className="text-sm text-gray-500 mt-4">
            You don't need to set up anything. Just email an agent.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="text-xl font-bold">InboxLeap</div>
          </div>
          <p className="text-gray-400">
            AI Email Agents that supercharge your inbox
          </p>
        </div>
      </footer>
    </div>
  );
}
