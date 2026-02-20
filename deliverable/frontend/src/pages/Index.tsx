
import React from 'react';
import AppGenerator from '@/components/AppGenerator';
import { useProjects } from '@/hooks/useProjects';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';

const Index = () => {
  const { isError, error, refetch } = useProjects();
  
  return (
    <>
      {isError && (
        <Alert variant="destructive" className="mb-4 mx-4 mt-4">
          <AlertTitle>Error fetching projects</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error?.message || 'Failed to load projects'}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="ml-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <AppGenerator />
    </>
  );
};

export default Index;
