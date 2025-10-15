import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Info } from 'lucide-react';

interface DismissibleHintProps {
  id: string; // Unique identifier for localStorage
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function DismissibleHint({ id, title, children, className = '' }: DismissibleHintProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if hint has been dismissed
    const dismissed = localStorage.getItem(`hint-dismissed-${id}`);
    setIsVisible(!dismissed);
  }, [id]);

  const handleDismiss = () => {
    localStorage.setItem(`hint-dismissed-${id}`, 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-blue-900 mb-1">{title}</h4>
            <div className="text-sm text-blue-800">
              {children}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 p-1 h-auto"
            aria-label="Dismiss hint"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}