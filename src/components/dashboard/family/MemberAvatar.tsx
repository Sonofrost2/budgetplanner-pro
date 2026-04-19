import { avatarColor, avatarInitials } from '@/lib/familyAvatar';
import { cn } from '@/lib/utils';

interface Props {
  userId: string;
  displayName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
};

export const MemberAvatar = ({ userId, displayName, size = 'md', className }: Props) => {
  const color = avatarColor(userId);
  const initials = avatarInitials(displayName);
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-background',
        sizeMap[size],
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${color}, ${color.replace('55%)', '40%)')})` }}
      title={displayName || 'Membre'}
    >
      {initials}
    </div>
  );
};
