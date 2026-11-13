import Image from 'next/image';

type BrandLogoProps = {
  inverse?: boolean;
  size?: 'sm' | 'md';
};

const sizes = {
  sm: 'h-9 w-auto',
  md: 'h-11 w-auto',
};

export function BrandLogo({ inverse = false, size = 'md' }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center" aria-label="ResortPro" role="img">
      <Image
        src={inverse ? '/logo/resortpro-logo-reversed.png' : '/logo/resortpro-logo-web.png'}
        alt=""
        width={1280}
        height={360}
        sizes={size === 'sm' ? '128px' : '157px'}
        className={`${sizes[size]} object-contain`}
      />
    </span>
  );
}
