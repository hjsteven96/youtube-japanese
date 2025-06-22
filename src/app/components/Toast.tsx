import React, { useEffect } from "react";

interface ToastProps {
    message: string;
    isVisible: boolean;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose }) => {
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, 1300); // 1초 후 사라짐
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    if (!isVisible) return null;

    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 p-4 rounded-2xl shadow-lg bg-white bg-opacity-50 backdrop-filter backdrop-blur-lg border border-opacity-20 border-white text-gray-800 text-center font-semibold animate-fade-in-up">
            {message}
        </div>
    );
};

export default Toast;
