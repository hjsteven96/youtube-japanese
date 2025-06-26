import React from "react";

interface ToastProps {
    message: string;
    isVisible: boolean;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl shadow-lg bg-white bg-opacity-75 backdrop-filter backdrop-blur-xl border border-opacity-20 border-white text-gray-800 text-center font-semibold animate-fade-in-up">
            {message}
        </div>
    );
};

export default Toast;
