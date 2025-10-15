import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Mail, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: EmailData) => void;
}

interface EmailData {
  to: string[];
  cc: string[];
  subject: string;
  message: string;
}

export default function ComposeEmailModal({ isOpen, onClose, onSend }: ComposeEmailModalProps) {
  const [to, setTo] = useState<string[]>(["todo@inboxleap.com"]);
  const [cc, setCc] = useState<string[]>([]);
  const [currentToEmail, setCurrentToEmail] = useState("");
  const [currentCcEmail, setCurrentCcEmail] = useState("");
  const [subject, setSubject] = useState("[Project Name Here]");
  const [message, setMessage] = useState("Assigned by joseph if not stated\n[Task information]");
  
  // Fetch projects for autocomplete
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    retry: false,
  });

  const handleAddToEmail = (email: string) => {
    if (email && !to.includes(email)) {
      setTo([...to, email]);
      setCurrentToEmail("");
    }
  };

  const handleAddCcEmail = (email: string) => {
    if (email && !cc.includes(email)) {
      setCc([...cc, email]);
      setCurrentCcEmail("");
    }
  };

  const handleRemoveToEmail = (index: number) => {
    setTo(to.filter((_, i) => i !== index));
  };

  const handleRemoveCcEmail = (index: number) => {
    setCc(cc.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    onSend({
      to,
      cc,
      subject,
      message
    });
    onClose();
  };

  const projectNames = (projects as any[]).map((p: any) => ({
    value: p.name,
    label: p.name
  }));

  const handleProjectSelect = (projectName: string) => {
    setSubject(projectName);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <div>
                <DialogTitle className="text-xl font-semibold">Compose Email</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Draft email with task information
                </DialogDescription>
              </div>
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
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* To Field */}
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 min-h-[38px] p-2 border rounded-md bg-background">
                {to.map((email, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm"
                  >
                    <span>{email}</span>
                    {email !== "todo@inboxleap.com" && (
                      <button
                        onClick={() => handleRemoveToEmail(index)}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <Input
                  id="to"
                  type="email"
                  placeholder="Add email..."
                  value={currentToEmail}
                  onChange={(e) => setCurrentToEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddToEmail(currentToEmail);
                    }
                  }}
                  className="flex-1 min-w-[200px] border-0 p-0 h-auto focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          {/* CC Field */}
          <div className="space-y-2">
            <Label htmlFor="cc">CC</Label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 min-h-[38px] p-2 border rounded-md bg-background">
                {cc.map((email, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => handleRemoveCcEmail(index)}
                      className="hover:text-gray-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <Input
                  id="cc"
                  type="email"
                  placeholder="Add email..."
                  value={currentCcEmail}
                  onChange={(e) => setCurrentCcEmail(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCcEmail(currentCcEmail);
                    }
                  }}
                  className="flex-1 min-w-[200px] border-0 p-0 h-auto focus-visible:ring-0"
                />
              </div>
            </div>
          </div>

          {/* Subject Field with Project Autocomplete */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <div className="flex gap-2">
              <Combobox
                options={projectNames}
                value={subject}
                onValueChange={handleProjectSelect}
                placeholder="Select or type project name..."
                className="flex-1"
              />
            </div>
          </div>

          {/* Message Field */}
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="resize-none"
              placeholder="Enter task details..."
            />
          </div>
        </div>
        
        <div className="pt-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} className="gap-2">
            <Send className="w-4 h-4" />
            Send Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}