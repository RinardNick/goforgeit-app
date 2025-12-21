import Link from 'next/link';

interface AgentCardProps {
  id: string;
  name: string;
  onDelete: () => void;
}

export function AgentCard({ id, name, onDelete }: AgentCardProps) {
  return (
    <div className="group relative bg-card/50 backdrop-blur-sm border border-border rounded-sm p-6 transition-all duration-500 hover:scale-[1.02] hover:bg-card/80 overflow-hidden shadow-lg hover:shadow-2xl">
      {/* Ignition Borders */}
      {/* Top */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center" />
      {/* Bottom */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-center" />
      {/* Left */}
      <div className="absolute top-0 left-0 w-[1px] h-full bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-center" />
      {/* Right */}
      <div className="absolute top-0 right-0 w-[1px] h-full bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-center" />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
             {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-500">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-widest font-medium text-forgeGreen bg-forgeGreen/10 rounded-full border border-forgeGreen/20">
              Active
            </span>
          </div>
          <h3 className="text-xl font-heading text-foreground group-hover:text-primary transition-colors break-words">{name}</h3>
          <p className="text-sm text-muted-foreground/60 font-mono mt-1 break-all">{id}</p>
        </div>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className="text-muted-foreground/40 hover:text-destructive transition-colors"
          title="Delete Agent"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-2 relative z-10">
        <Link
          href={`/${id}/compose`}
          className="col-span-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-sm hover:opacity-90 transition-colors text-center shadow-lg group-hover:shadow-xl"
        >
          Launch Composer
        </Link>
        <Link
          href={`/${id}/chat`}
          className="px-3 py-2 border border-border text-muted-foreground text-sm font-medium rounded-sm hover:bg-accent hover:text-foreground transition-colors text-center"
        >
          Chat
        </Link>
        <Link
          href={`/${id}/evaluations`}
          className="px-3 py-2 border border-border text-muted-foreground text-sm font-medium rounded-sm hover:bg-accent hover:text-foreground transition-colors text-center"
        >
          Evals
        </Link>
      </div>
    </div>
  );
}