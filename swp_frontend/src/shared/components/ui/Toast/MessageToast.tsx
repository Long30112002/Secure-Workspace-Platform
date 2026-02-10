import { useEffect, useState } from 'react';
import './MessageToast.css';

interface MessageToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  title?: string;
  duration?: number;
  onClose?: () => void;
  showProgress?: boolean;
}

function MessageToast({
  type,
  message,
  title,
  duration = 5000,
  onClose,
  showProgress = true
}: MessageToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      setTimeout(onClose);
    }
  };

  if (!isVisible) return null;

  const defaultTitle =
    type === 'success' ? 'Success!' :
      type === 'error' ? 'Oops!' :
        'Info';

  const icon =
    type === 'success' ? '✓' :
      type === 'error' ? '!' :
        'i';

  return (
    <div className={`message-toast ${type} ${isVisible ? 'visible' : ''}`}>
      <div className="message-icon">{icon}</div>
      <div className="message-content">
        <h4>{title || defaultTitle}</h4>
        <p>{message}</p>
        {showProgress && duration > 0 && (
          <div className="message-progress">
            <div
              className="progress-bar"
              style={{ animationDuration: `${duration}ms` }}
            ></div>
          </div>
        )}
      </div>
      <button
        className="message-close"
        onClick={handleClose}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

export default MessageToast;