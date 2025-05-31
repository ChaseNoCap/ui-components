import React, { useState } from 'react';
import { Terminal } from 'lucide-react';

export const SimpleConsole: React.FC = () => {
  const [messages, setMessages] = useState<string[]>([
    'Welcome to Claude Console',
    'Type a message and press Enter to send'
  ]);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setMessages([...messages, `> ${input}`, 'Processing...']);
      setInput('');
      // Simulate response
      setTimeout(() => {
        setMessages(prev => [...prev.slice(0, -1), 'Response: This is a test response']);
      }, 1000);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center space-x-2 border-b border-gray-700">
        <Terminal className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Claude Console (Simple)</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {messages.map((msg, i) => (
          <div key={i} className="mb-2">
            {msg}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          placeholder="Enter command..."
          autoFocus
        />
      </form>
    </div>
  );
};