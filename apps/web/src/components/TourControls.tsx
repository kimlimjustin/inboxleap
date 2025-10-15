import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function TourControls() {
  const resetTours = () => {
    localStorage.removeItem('has-visited-app');
    localStorage.removeItem('tour-completed-intelligence');
    localStorage.removeItem('tour-completed-teams');
    localStorage.removeItem('tour-skipped-intelligence');
    localStorage.removeItem('tour-skipped-teams');
    window.location.reload();
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <Button
        onClick={resetTours}
        variant="outline"
        size="sm"
        className="bg-white/90 backdrop-blur-sm shadow-lg border-gray-300"
        title="Reset tours for testing (dev only)"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reset Tours
      </Button>
    </div>
  );
}