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
      "bg-[#c44b00] border border-[#b24500] text-white shadow-[0_22px_60px_rgba(196,75,0,0.35)] hover:bg-[#e26b00] hover:shadow-[0_26px_70px_rgba(226,107,0,0.40)] transform hover:-translate-y-1",
    white:
      "bg-white text-brand-darker border border-brand-darker shadow-[0_12px_30px_rgba(0,0,0,0.12)] hover:bg-brand-50 hover:text-brand-dark",
    outline: "border-2 border-white/80 text-white hover:bg-white/10",
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide transition-all duration-200 ${sizes[size]} ${variants[variant]} ${className}`;

  if (!APP_DOWNLOAD_URL) {
    return (
      <button
        type="button"
        disabled
        title="Download link not configured yet (set VITE_APP_DOWNLOAD_URL)"
        className={`${cls} disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0`}
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
