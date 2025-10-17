import type { ReactNode } from "react";

interface FeatureCardProps {
  icon?: string;
  title: string;
  children: ReactNode;
  href?: string;
  variant?: "left" | "right";
}

export function FeatureCard({
  icon,
  title,
  children,
  href,
  variant = "left",
}: FeatureCardProps) {
  const gradientClass =
    variant === "right"
      ? "bg-gradient-to-tl from-[#FF572D]/25 via-[#FF572D]/10 via-25% to-white to-70% hover:from-[#FF572D]/35 hover:via-[#FF572D]/15"
      : "bg-gradient-to-tr from-[#FF572D]/25 via-[#FF572D]/10 via-25% to-white to-70% hover:from-[#FF572D]/35 hover:via-[#FF572D]/15";

  const content = (
    <>
      <div className="flex items-center gap-2 pb-3 text-lg font-bold">
        {icon && <span className="text-xl">{icon}</span>}
        {title}
      </div>
      <div className="text-[0.875rem]">{children}</div>
    </>
  );

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!href) return;

    e.preventDefault();

    const currentPath = window.location.pathname;
    const [pathname, hash] = href.split("#");
    const isSamePage = pathname === currentPath || pathname === "";

    if (isSamePage && hash) {
      // Same page with hash - just update the hash
      window.location.hash = hash;
    } else {
      // Cross-page navigation - clear sidebar scroll position so it auto-scrolls to active item
      sessionStorage.removeItem("sidebar-scroll-pos");
      // Use window.location for full page navigation
      // This is needed because FeatureCard is rendered outside router context
      window.location.href = href;
    }
  };

  if (href) {
    return (
      <a
        href={href}
        onClick={handleClick}
        className={`border-2 p-6 ${gradientClass} hover:border-color-primary flex h-full cursor-pointer flex-col no-underline transition-all`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={`border-2 p-6 ${gradientClass} hover:border-color-primary flex h-full flex-col transition-all`}
    >
      {content}
    </div>
  );
}
