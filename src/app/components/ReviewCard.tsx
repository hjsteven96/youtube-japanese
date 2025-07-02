import React from 'react';

interface ReviewCardProps {
    name: string;
    role: string;
    avatar: string;
    review: string;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ name, role, avatar, review }) => (
    <div className="relative w-72 h-64 shrink-0 overflow-hidden rounded-2xl border bg-white p-6 shadow-lg flex flex-col">
        <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-gray-100 text-2xl">{avatar}</div>
            <div className="flex-1">
                <p className="font-semibold text-gray-800">{name}</p>
                <p className="text-sm text-gray-500">{role}</p>
                <div className="flex gap-0.5 mt-1">
                    {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                    ))}
                </div>
            </div>
        </div>
        <p className="mt-4 text-gray-600 leading-relaxed flex-1 overflow-hidden">"{review}"</p>
    </div>
);

export default ReviewCard; 