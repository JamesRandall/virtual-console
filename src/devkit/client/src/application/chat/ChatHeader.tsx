import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faCircle } from '@fortawesome/free-solid-svg-icons';

interface ChatHeaderProps {
  isChatConnected: boolean;
  onNewChat: () => void;
}

export function ChatHeader({ isChatConnected, onNewChat }: ChatHeaderProps) {
  return (
    <div className="dk-layout-header dk-bg-primary flex-shrink-0">
      <div className="flex items-center dk-gap-small">
        <h2 className="dk-subsection-header">AI Assistant</h2>
        <div className="flex items-center dk-gap-tight">
          <FontAwesomeIcon
            icon={faCircle}
            className={`text-xs ${isChatConnected ? 'text-green-500' : 'text-red-500'}`}
          />
          <span className="dk-secondary-text">
            {isChatConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      <button
        onClick={onNewChat}
        disabled={!isChatConnected}
        className="dk-icon-text dk-body-text disabled:dk-text-muted"
        title="Start new chat"
      >
        <FontAwesomeIcon icon={faPlus} className="text-xs" />
        New Chat
      </button>
    </div>
  );
}
