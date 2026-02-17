import {
  SiAnthropic,
  SiGooglegemini,
  SiOllama,
  SiGithubcopilot,
  SiMistralai,
  SiOpenrouter,
} from "@icons-pack/react-simple-icons";

const FALLBACK_PROVIDERS: Record<
  string,
  { abbr: string; bg: string; text: string }
> = {
  openai: { abbr: "OA", bg: "bg-emerald-500/15", text: "text-emerald-500" },
  groq: { abbr: "Gr", bg: "bg-teal-500/15", text: "text-teal-500" },
  deepseek: { abbr: "Ds", bg: "bg-cyan-500/15", text: "text-cyan-500" },
  xai: { abbr: "xA", bg: "bg-slate-500/15", text: "text-slate-400" },
  openai_compatible: { abbr: "OC", bg: "bg-gray-500/15", text: "text-gray-400" },
};

const SIZE_MAP = {
  sm: 16,
  md: 24,
  lg: 32,
} as const;

const CONTAINER_MAP = {
  sm: "w-5 h-5 text-[9px]",
  md: "w-7 h-7 text-[10px]",
  lg: "w-9 h-9 text-xs",
} as const;

interface ProviderIconProps {
  providerId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ProviderIcon({
  providerId,
  size = "md",
  className = "",
}: ProviderIconProps) {
  const px = SIZE_MAP[size];
  const iconSize = Math.round(px * 0.65);

  // Providers with Simple Icons brand logos
  switch (providerId) {
    case "anthropic":
      return (
        <div className={`${CONTAINER_MAP[size]} rounded-lg flex items-center justify-center bg-amber-500/15 ${className}`}>
          <SiAnthropic size={iconSize} className="text-amber-600 dark:text-amber-400" />
        </div>
      );
    case "gemini":
      return (
        <div className={`${CONTAINER_MAP[size]} rounded-lg flex items-center justify-center bg-blue-500/15 ${className}`}>
          <SiGooglegemini size={iconSize} className="text-blue-500" />
        </div>
      );
    case "ollama":
      return (
        <div className={`${CONTAINER_MAP[size]} rounded-lg flex items-center justify-center bg-sky-500/15 ${className}`}>
          <SiOllama size={iconSize} className="text-sky-500" />
        </div>
      );
    case "github_copilot":
      return (
        <div className={`${CONTAINER_MAP[size]} rounded-lg flex items-center justify-center bg-slate-500/15 ${className}`}>
          <SiGithubcopilot size={iconSize} className="text-slate-600 dark:text-slate-300" />
        </div>
      );
    case "mistral":
      return (
        <div className={`${CONTAINER_MAP[size]} rounded-lg flex items-center justify-center bg-orange-500/15 ${className}`}>
          <SiMistralai size={iconSize} className="text-orange-500" />
        </div>
      );
    case "openrouter":
      return (
        <div className={`${CONTAINER_MAP[size]} rounded-lg flex items-center justify-center bg-violet-500/15 ${className}`}>
          <SiOpenrouter size={iconSize} className="text-violet-500" />
        </div>
      );
    default: {
      // Fallback: colored circle with 2-letter abbreviation
      const fallback = FALLBACK_PROVIDERS[providerId] || {
        abbr: providerId.slice(0, 2).toUpperCase(),
        bg: "bg-gray-500/15",
        text: "text-gray-500",
      };
      return (
        <div
          className={`${CONTAINER_MAP[size]} rounded-lg flex items-center justify-center font-bold ${fallback.bg} ${fallback.text} ${className}`}
        >
          {fallback.abbr}
        </div>
      );
    }
  }
}
