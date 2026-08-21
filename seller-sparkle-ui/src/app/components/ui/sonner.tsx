import { useEffect, useState } from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function readAppTheme(): NonNullable<ToasterProps["theme"]> {
  if (typeof document === "undefined") return "system";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const Toaster = ({ ...props }: ToasterProps) => {
  // App theme is toggled via documentElement.classList (not next-themes ThemeProvider).
  const [theme, setTheme] = useState<NonNullable<ToasterProps["theme"]>>(readAppTheme);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(readAppTheme());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("storage", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-right"
      expand
      gap={12}
      offset={16}
      visibleToasts={3}
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          title: "group-[.toast]:font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-foreground",
          success: "group-[.toaster]:border-emerald-500/40",
          error: "group-[.toaster]:border-destructive/40",
          warning: "group-[.toaster]:border-amber-500/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
