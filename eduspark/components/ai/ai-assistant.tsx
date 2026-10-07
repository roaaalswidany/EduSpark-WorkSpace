"use client";

import { useState } from "react";
import { AiAssistantButton } from "./ai-assistant-button";
import { AiAssistantPanel } from "./ai-assistant-panel";

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AiAssistantButton
        onClick={() => setIsOpen(true)}
        isOpen={isOpen}
      />
      {isOpen && <AiAssistantPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}