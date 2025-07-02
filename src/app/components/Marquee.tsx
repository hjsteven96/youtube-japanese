import React from 'react';

interface MarqueeProps {
    children: React.ReactNode;
    speed?: number;
}

const Marquee: React.FC<MarqueeProps> = ({ children, speed = 60 }) => {
    const animationDuration = `${speed}s`;
    
    return (
        <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]">
            <div 
                className="flex w-max"
                style={{
                    animation: `scroll ${animationDuration} linear infinite`,
                }}
            >
                <div className="flex shrink-0 gap-4 pr-4">
                    {children}
                </div>
                <div className="flex shrink-0 gap-4 pr-4">
                    {children}
                </div>
            </div>
            <style jsx>{`
                @keyframes scroll {
                    0% {
                        transform: translateX(0);
                    }
                    100% {
                        transform: translateX(-50%);
                    }
                }
            `}</style>
        </div>
    );
};

export default Marquee; 