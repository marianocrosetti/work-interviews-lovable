import React from 'react';
import { useUserSettings } from '@/context/UserSettingsContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export const ChatSettings: React.FC = () => {
  const { settings, updateSettings } = useUserSettings();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings size={16} className="text-slate-400 hover:text-white" />
          <span className="sr-only">Chat Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-slate-800 border-slate-700 text-white" align="end">
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Chat Display Settings</h3>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="showToolParameters" className="text-sm text-slate-300">
              Show tool parameters
            </Label>
            <Switch
              id="showToolParameters"
              checked={settings.showToolParameters}
              onCheckedChange={(checked) => updateSettings({ showToolParameters: checked })}
              className="data-[state=checked]:bg-blue-500"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="collapseThinking" className="text-sm text-slate-300">
              Auto-collapse thinking steps
            </Label>
            <Switch
              id="collapseThinking"
              checked={settings.collapseThinkingByDefault}
              onCheckedChange={(checked) => updateSettings({ collapseThinkingByDefault: checked })}
              className="data-[state=checked]:bg-blue-500"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="showTimestamps" className="text-sm text-slate-300">
              Show timestamps
            </Label>
            <Switch
              id="showTimestamps"
              checked={settings.showTimestamps}
              onCheckedChange={(checked) => updateSettings({ showTimestamps: checked })}
              className="data-[state=checked]:bg-blue-500"
            />
          </div>
          
          <div className="pt-2 border-t border-slate-700">
            <h3 className="font-medium text-sm mb-2">Theme</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={settings.theme === 'light' ? 'default' : 'outline'}
                className={`flex-1 ${settings.theme === 'light' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                onClick={() => updateSettings({ theme: 'light' })}
              >
                Light
              </Button>
              <Button
                size="sm"
                variant={settings.theme === 'dark' ? 'default' : 'outline'}
                className={`flex-1 ${settings.theme === 'dark' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                onClick={() => updateSettings({ theme: 'dark' })}
              >
                Dark
              </Button>
              <Button
                size="sm"
                variant={settings.theme === 'system' ? 'default' : 'outline'}
                className={`flex-1 ${settings.theme === 'system' ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}
                onClick={() => updateSettings({ theme: 'system' })}
              >
                System
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}; 