import Link from "next/link";

interface RecentVideoItemProps {
    videoId: string;
    title: string;
    channelName?: string;
    summary?: string;
}

export default function RecentVideoItem({
    videoId,
    title,
    channelName,
    summary,
}: RecentVideoItemProps) {
    console.log("RecentVideoItem: received summary prop:", summary);
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    return (
        <Link href={`/analysis/${videoId}`}>
            <div className="flex flex-col items-center p-1 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                <div className="relative w-full pt-[56.25%] mb-2">
                    <img
                        src={thumbnailUrl}
                        alt={title}
                        className="absolute inset-0 w-full h-full object-cover rounded-md"
                    />
                </div>
                <p className="text-sm font-medium text-gray-700 text-center line-clamp-2">
                    {title}
                </p>
                {channelName && (
                    <p className="text-xs text-gray-500 mt-1 text-center line-clamp-1">
                        {channelName}
                    </p>
                )}
                {summary && (
                    <p className="text-xs text-gray-500 text-center mt-1 line-clamp-2">
                        {summary}
                    </p>
                )}
            </div>
        </Link>
    );
}
