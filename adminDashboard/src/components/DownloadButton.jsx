import { APP_DOWNLOAD_URL } from "../config";
import { DownloadIcon } from "./Icons";

/**
 * "Download App" button. Reads the APK link from VITE_APP_DOWNLOAD_URL.
 * When the link is not configured it renders a disabled button with a hint
 * instead of a dead link, so the page never looks broken.
 */
const DownloadButton = ({
  size = "md",
  variant = "solid",
  className = "",
  label = "Download App",
}) => {
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-3 text-sm",
    lg: "px-7 py-4 text-base",
  };
  const variants = {
    solid:
      "bg-brand-dark text-white hover:bg-brand shadow-brand hover:shadow-lg transform hover:scale-105",
    white:
      "bg-white text-brand-darker border border-brand-darker hover:bg-brand-50 shadow-lg hover:shadow-xl",
    outline: "border-2 border-white/80 text-white hover:bg-white/10",
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 ${sizes[size]} ${variants[variant]} ${className}`;

  if (!APP_DOWNLOAD_URL) {
    return (
      <button
        type="button"
        disabled
        title="Download link not configured yet (set VITE_APP_DOWNLOAD_URL)"
        className={`${cls} cursor-not-allowed opacity-60 hover:translate-y-0`}
      >
        <DownloadIcon className="h-5 w-5" />
        {label}
      </button>
    );
  }

  return (
    <a href={APP_DOWNLOAD_URL} target="_blank" rel="noreferrer" className={cls}>
      <DownloadIcon className="h-5 w-5" />
      {label}
    </a>
  );
};

export default DownloadButton;
