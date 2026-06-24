"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SpeedDialItem {
  id: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  badge?: number;
  color?: string;
  disabled?: boolean;
  children?: SpeedDialItem[];
  component?: "button" | React.ReactNode;
  buttonClassName?: string;
}

interface SpeedDialProps {
  items: SpeedDialItem[];
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  direction?: "vertical" | "horizontal";
  triggerIcon?: LucideIcon;
  triggerColor?: string;
  className?: string;
  positioning?: "fixed" | "absolute";
  tooltipDirection?: "left" | "right";
  triggerClassName?: string;
  forceOpen?: boolean;
}

export function SpeedDial({
  items,
  position = "bottom-right",
  direction = "vertical",
  triggerIcon: TriggerIcon = Plus,
  triggerColor = "bg-primary hover:bg-primary/90 text-primary-foreground",
  className,
  positioning = "fixed",
  tooltipDirection,
  triggerClassName,
  forceOpen = false,
}: SpeedDialProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChildRailId, setActiveChildRailId] = useState<string | null>(null);
  const [pinnedChildRailId, setPinnedChildRailId] = useState<string | null>(null);
  const menuOpen = forceOpen || isOpen;
  const visibleChildRailId = pinnedChildRailId ?? activeChildRailId;

  const closeMenu = () => {
    setIsOpen(false);
    setActiveChildRailId(null);
    setPinnedChildRailId(null);
  };

  // Calculate position classes
  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  // Calculate item positioning based on direction and position
  const getItemsContainerClasses = () => {
    const baseClasses = "absolute";

    if (direction === "vertical") {
      if (position.includes("top")) {
        // Center items relative to trigger button
        if (position.includes("right")) {
          return `${baseClasses} top-14 right-1 space-y-2`; // Offset to center with trigger
        } else {
          return `${baseClasses} top-14 left-1 space-y-2`; // Offset to center with trigger
        }
      } else {
        // For bottom positions, center items relative to trigger button
        if (position.includes("right")) {
          return `${baseClasses} bottom-14 right-1 space-y-2`; // Offset to center with trigger
        } else {
          return `${baseClasses} bottom-14 left-1 space-y-2`; // Offset to center with trigger
        }
      }
    } else {
      if (position.includes("left")) {
        return `${baseClasses} left-14 space-x-2 flex`;
      } else {
        return `${baseClasses} right-14 space-x-2 flex`;
      }
    }
  };

  // Calculate animation direction
  const getItemAnimation = (index: number) => {
    // Reverse animation order for bottom positions (bottom items appear first)
    const animateDelay = position.includes("bottom")
      ? (items.length - 1 - index) * 0.05
      : index * 0.05;
    const exitDelay = position.includes("bottom")
      ? index * 0.05
      : (items.length - 1 - index) * 0.05;

    if (direction === "vertical") {
      const yDirection = position.includes("top") ? 20 : -20;
      return {
        initial: { opacity: 0, y: yDirection, scale: 0.8 },
        animate: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            delay: animateDelay,
            type: "spring" as const,
            stiffness: 400,
            damping: 30,
          },
        },
        exit: {
          opacity: 0,
          y: yDirection,
          scale: 0.8,
          transition: {
            delay: exitDelay,
            duration: 0.1,
          },
        },
      };
    } else {
      const xDirection = position.includes("left") ? 20 : -20;
      return {
        initial: { opacity: 0, x: xDirection, scale: 0.8 },
        animate: {
          opacity: 1,
          x: 0,
          scale: 1,
          transition: {
            delay: animateDelay,
            type: "spring" as const,
            stiffness: 400,
            damping: 30,
          },
        },
        exit: {
          opacity: 0,
          x: xDirection,
          scale: 0.8,
          transition: {
            delay: exitDelay,
            duration: 0.1,
          },
        },
      };
    }
  };

  // Get total badge count for main button
  const totalBadgeCount = items.reduce((total, item) => total + getItemBadgeCount(item), 0);

  return (
    <div className={cn(positioning, "z-50", positionClasses[position], className)}>
      <div className="relative">
        {/* Main FAB Button */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={() => setIsOpen(!isOpen)}
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full shadow-lg transition-all duration-200",
              triggerColor,
              menuOpen && "rotate-45",
              triggerClassName,
            )}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <TriggerIcon className="h-5 w-5" />}
          </Button>
        </motion.div>

        {/* Notification Badge for total items */}
        <AnimatePresence>
          {totalBadgeCount > 0 && !menuOpen && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2"
            >
              <Badge
                variant="destructive"
                className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs animate-pulse"
              >
                {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Speed Dial Items */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={getItemsContainerClasses()}
            >
              {items.map((item, index) => {
                const hasChildren = Boolean(item.children?.length);
                const isChildRailVisible = hasChildren && visibleChildRailId === item.id;
                const openToLeft =
                  direction === "vertical" &&
                  (tooltipDirection === "left" || position.includes("right"));

                return (
                  <motion.div
                    key={item.id}
                    {...getItemAnimation(index)}
                    className={cn(
                      "group/item",
                      direction === "vertical" ? "" : "flex items-center gap-3",
                    )}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setActiveChildRailId(null);
                        setPinnedChildRailId((current) => (current === item.id ? null : current));
                      }
                    }}
                    onFocus={() => {
                      if (hasChildren) setActiveChildRailId(item.id);
                    }}
                    onMouseEnter={() => {
                      if (hasChildren) setActiveChildRailId(item.id);
                    }}
                    onMouseLeave={() => {
                      if (pinnedChildRailId !== item.id) setActiveChildRailId(null);
                    }}
                  >
                    <div
                      className={cn(
                        "relative flex items-center",
                        // For right-side positions or explicit left tooltip, reverse the layout
                        openToLeft ? "flex-row-reverse" : "",
                      )}
                    >
                      <div className="relative">
                        {typeof item.component === "object" && item.component !== null ? (
                          item.component
                        ) : (
                          <Button
                            onClick={() => {
                              if (item.disabled) return;
                              if (hasChildren) {
                                setPinnedChildRailId((current) =>
                                  current === item.id ? null : item.id,
                                );
                                setActiveChildRailId(item.id);
                                return;
                              }
                              item.onClick?.();
                              closeMenu();
                            }}
                            size="icon"
                            disabled={item.disabled}
                            className={cn(
                              "h-10 w-10 rounded-full shadow-lg transition-all duration-200",
                              item.color ||
                                "bg-primary hover:bg-primary/90 text-primary-foreground",
                              item.disabled && "opacity-50 cursor-not-allowed",
                              item.buttonClassName,
                            )}
                          >
                            <item.icon className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Item Badge */}
                        {item.badge && (
                          <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                          >
                            {item.badge > 99 ? "99+" : item.badge}
                          </Badge>
                        )}
                      </div>

                      <div
                        className={cn(
                          "pointer-events-none absolute bottom-12 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background/95 px-3 py-1 text-sm font-medium opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{item.label}</span>
                          {hasChildren && (
                            <span className="text-xs text-muted-foreground">
                              {item.children?.length}
                            </span>
                          )}
                          {item.disabled && (
                            <span className="text-xs text-muted-foreground">(Coming Soon)</span>
                          )}
                        </div>
                      </div>
                      <AnimatePresence>
                        {isChildRailVisible ? (
                          <motion.div
                            initial={{ opacity: 0, x: -6, scale: 0.98 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -6, scale: 0.98 }}
                            transition={{ duration: 0.12 }}
                            className={cn(
                              "absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-2",
                              openToLeft ? "right-12 mr-3" : "left-12 ml-3",
                            )}
                          >
                            {item.children?.map((child) => (
                              <div
                                key={child.id}
                                className="group/child relative flex items-center"
                              >
                                <Button
                                  aria-label={child.label}
                                  onClick={() => {
                                    if (child.disabled) return;
                                    child.onClick?.();
                                    closeMenu();
                                  }}
                                  size="icon"
                                  disabled={child.disabled}
                                  className={cn(
                                    "h-10 w-10 rounded-full shadow-lg transition-all duration-200",
                                    child.color ||
                                      "bg-primary hover:bg-primary/90 text-primary-foreground",
                                    child.disabled && "cursor-not-allowed opacity-50",
                                    child.buttonClassName,
                                  )}
                                >
                                  <child.icon className="h-4 w-4" />
                                </Button>
                                {child.badge ? (
                                  <Badge
                                    variant="destructive"
                                    className="-right-1 -top-1 absolute h-5 min-w-5 rounded-full px-1 text-[10px]"
                                  >
                                    {child.badge > 99 ? "99+" : child.badge}
                                  </Badge>
                                ) : null}
                                <span className="pointer-events-none absolute top-12 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background/95 px-2 py-1 text-xs font-medium opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover/child:opacity-100 group-focus-within/child:opacity-100">
                                  {child.label}
                                </span>
                              </div>
                            ))}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function getItemBadgeCount(item: SpeedDialItem): number {
  return (
    (item.badge || 0) +
    (item.children?.reduce((total, child) => total + getItemBadgeCount(child), 0) ?? 0)
  );
}
