import { useNotification } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import './Notifications.css';

export function ToastContainer() {
    const { toasts, removeToast } = useNotification();
    const navigate = useNavigate();

    const handleToastAction = (toast: any) => {
        if (toast.action) {
            toast.action.onClick();
        }
        removeToast(toast.id);
    };

    const handleToastClick = (toast: any) => {
        if (toast.message.includes('invited to join')) {
            navigate('/workspace/invitations');
        }
        removeToast(toast.id);
    };

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`toast toast-${toast.type}`}
                    onClick={() => handleToastClick(toast)}
                >
                    <div className="toast-icon">
                        {toast.type === 'success' && '✅'}
                        {toast.type === 'error' && '❌'}
                        {toast.type === 'info' && 'ℹ️'}
                    </div>
                    <div className="toast-content">
                        <div className="toast-message">{toast.message}</div>
                        {toast.action && (
                            <button
                                className="toast-action-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleToastAction(toast);
                                }}
                            >
                                {toast.action.label}
                            </button>
                        )}
                    </div>
                    <button
                        className="toast-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeToast(toast.id);
                        }}>
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}