import { useState } from "react";

export function ProductImage({
    name,
    src,
    className = "h-36 w-full",
}: {
    name: string;
    src?: string | null;
    className?: string;
}) {
    const [failedSource, setFailedSource] = useState<string | null>(null);
    const showImage = !!src && failedSource !== src;

    return (
        <div
            className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 text-blue-300 ${className}`}
            role={showImage ? undefined : "img"}
            aria-label={showImage ? undefined : `Imagem de ${name} não disponível`}
        >
            {showImage ? (
                <img src={src} alt={`Imagem de ${name}`} onError={() => setFailedSource(src)} className="h-full w-full object-contain" />
            ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 4 8-4M12 11v10m-5-12 8-4" />
                </svg>
            )}
        </div>
    );
}
