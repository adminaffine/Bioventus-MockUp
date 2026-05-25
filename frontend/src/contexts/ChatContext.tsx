import { createContext, useContext, useState } from "react";

type ChatContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
  uploadSessionId: string | null;
  setUploadSessionId: (v: string | null) => void;
};

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  return (
    <ChatContext.Provider value={{ open, setOpen, uploadSessionId, setUploadSessionId }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) return { open: false, setOpen: () => {}, uploadSessionId: null, setUploadSessionId: () => {} };
  return ctx;
}
