import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

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

  if (href) {
    // Parse href to extract path and hash
    const [path, hash] = href.split("#");

    return (
      <Link
        to={path}
        hash={hash}
        className={`border-2 p-6 ${gradientClass} hover:border-color-primary flex h-full cursor-pointer flex-col no-underline transition-all`}
      >
        {content}
      </Link>
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
