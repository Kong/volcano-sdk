import { useNavigate, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useRef, useEffect } from "react";

interface SidebarItemProps {
  title: string;
  href: string;
  // icon: LucideIcon;
  isActive: boolean;
  onPreserveScroll: () => void;
}

export function SidebarItem({
  title,
  href,
  // icon: Icon,
  isActive,
  onPreserveScroll,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const itemRef = useRef<HTMLLIElement>(null);
  const prevActiveRef = useRef<boolean>(isActive);

  // Auto-scroll into view when becoming active
  useEffect(() => {
    // Only scroll if transitioning from false to true
    if (isActive && !prevActiveRef.current && itemRef.current) {
      // Use requestAnimationFrame for better performance and reduced delay
      const scrollAnimationFrame = requestAnimationFrame(() => {
        // Find the scrollable sidebar container (now it's a div with class sidebar-scroll-container)
        const sidebarContainer = itemRef.current?.closest(
          ".sidebar-scroll-container"
        );

        if (sidebarContainer && itemRef.current) {
          const itemRect = itemRef.current.getBoundingClientRect();
          const containerRect = sidebarContainer.getBoundingClientRect();

          // Calculate if item is out of view
          const itemTop =
            itemRect.top - containerRect.top + sidebarContainer.scrollTop;
          const itemBottom = itemTop + itemRect.height;
          const visibleTop = sidebarContainer.scrollTop;
          const visibleBottom = visibleTop + containerRect.height;

          // Only scroll if item is not fully visible
          if (itemTop < visibleTop || itemBottom > visibleBottom) {
            // Calculate the optimal scroll position to center the item
            const targetScroll =
              itemTop - containerRect.height / 2 + itemRect.height / 2;

            sidebarContainer.scrollTo({
              top: Math.max(0, targetScroll),
              behavior: "smooth",
            });
          }
        }
      });

      // Cleanup animation frame
      return () => cancelAnimationFrame(scrollAnimationFrame);
    }
    // Update previous value
    prevActiveRef.current = isActive;
  }, [isActive, title]);

  const handleClick = (e: React.MouseEvent) => {
    // Prevent any default behavior
    e.preventDefault();

    // Always preserve sidebar scroll position before navigation
    onPreserveScroll();

    if (href.includes("#")) {
      const [pathname, hash] = href.split("#");

      if (pathname === currentPath || pathname === "") {
        // Same page, just navigate with hash (non-blocking)
        navigate({
          to: currentPath,
          hash: hash,
        });

        // Scroll to element immediately using requestAnimationFrame
        requestAnimationFrame(() => {
          const element = document.getElementById(hash);
          const contentContainer = document.getElementById("docs-content");
          if (element && contentContainer) {
            const containerRect = contentContainer.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            const relativeTop =
              elementRect.top - containerRect.top + contentContainer.scrollTop;

            contentContainer.scrollTo({
              top: relativeTop - 32,
              behavior: "smooth",
            });
          }
        });
      } else {
        // Different page, navigate with hash (non-blocking)
        navigate({
          to: pathname,
          hash: hash,
        });

        // Scroll after a minimal delay for page load
        setTimeout(() => {
          const element = document.getElementById(hash);
          const contentContainer = document.getElementById("docs-content");
          if (element && contentContainer) {
            const containerRect = contentContainer.getBoundingClientRect();
            const elementRect = element.getBoundingClientRect();
            const relativeTop =
              elementRect.top - containerRect.top + contentContainer.scrollTop;

            contentContainer.scrollTo({
              top: relativeTop - 32,
              behavior: "smooth",
            });
          }
        }, 100);
      }
    } else {
      // Regular page navigation (no hash, non-blocking)
      navigate({ to: href });

      // Scroll to top immediately using requestAnimationFrame
      requestAnimationFrame(() => {
        const contentContainer = document.getElementById("docs-content");
        if (contentContainer) {
          contentContainer.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }
      });
    }
  };

  return (
    <li ref={itemRef} key={href}>
      <button
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
          isActive
            ? "text-color-primary bg-[#FF572D]/20 font-semibold"
            : "hover:bg-[#FF572D]/10"
        )}
        onClick={handleClick}
      >
        {/* <Icon className="h-4 w-4" /> */}
        {title}
      </button>
    </li>
  );
}
