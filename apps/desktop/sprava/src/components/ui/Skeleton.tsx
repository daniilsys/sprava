export function MessageSkeleton() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="w-10 h-10 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="flex gap-2 items-center">
          <div className="h-3.5 w-24 rounded skeleton" />
          <div className="h-3 w-12 rounded skeleton" />
        </div>
        <div className="h-3.5 w-3/4 rounded skeleton" />
        <div className="h-3.5 w-1/2 rounded skeleton" />
      </div>
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="flex-1 flex flex-col justify-end">
      {Array.from({ length: 6 }, (_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </div>
  );
}

export function MemberSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
      <div className="h-3.5 rounded skeleton" style={{ width: `${60 + Math.random() * 40}%` }} />
    </div>
  );
}

export function MemberListSkeleton() {
  return (
    <div className="space-y-1">
      <div className="h-3 w-20 rounded skeleton mx-2 mb-2" />
      {Array.from({ length: 8 }, (_, i) => (
        <MemberSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChannelSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <div className="w-4 h-4 rounded skeleton flex-shrink-0" />
      <div className="h-3.5 rounded skeleton" style={{ width: `${50 + Math.random() * 40}%` }} />
    </div>
  );
}

export function ChannelListSkeleton() {
  return (
    <div className="space-y-0.5 px-2 py-2">
      {Array.from({ length: 6 }, (_, i) => (
        <ChannelSkeleton key={i} />
      ))}
    </div>
  );
}
