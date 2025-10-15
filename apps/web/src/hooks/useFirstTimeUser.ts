import { useState, useEffect } from 'react';

export function useFirstTimeUser() {
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFirstTimeUser = () => {
      const hasVisited = localStorage.getItem('has-visited-app');
      const hasSeenIntelligenceTour = localStorage.getItem('tour-completed-intelligence');
      const hasSeenTeamsTour = localStorage.getItem('tour-completed-teams');

      const isNewUser = !hasVisited && !hasSeenIntelligenceTour && !hasSeenTeamsTour;

      setIsFirstTime(isNewUser);
      setLoading(false);

      if (isNewUser) {
        localStorage.setItem('has-visited-app', 'true');
      }
    };

    checkFirstTimeUser();
  }, []);

  const markTourCompleted = (workspace: 'intelligence' | 'teams') => {
    localStorage.setItem(`tour-completed-${workspace}`, 'true');
    setIsFirstTime(false);
  };

  return {
    isFirstTime,
    loading,
    markTourCompleted
  };
}