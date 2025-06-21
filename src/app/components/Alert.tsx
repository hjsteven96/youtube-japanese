import React from "react";

interface AlertButtonProps {
    text: string;
    onClick: () => void;
    isPrimary?: boolean;
}

interface AlertProps {
    title: string;
    subtitle?: string;
    buttons: AlertButtonProps[];
    onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ title, subtitle, buttons, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {title}
                </h2>
                {subtitle && (
                    <p className="text-sm text-gray-500 mb-4">{subtitle}</p>
                )}
                <div
                    className={`flex justify-end ${
                        buttons.length > 1 ? "space-x-3" : ""
                    }`}
                >
                    {buttons.map((button, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                button.onClick();
                                if (onClose) onClose();
                            }}
                            className={`px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-opacity-75
                ${
                    button.isPrimary
                        ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400"
                }`}
                        >
                            {" "}
                            {button.text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Alert;
