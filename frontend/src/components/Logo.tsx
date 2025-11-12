import logoImage from "../assets/TBT_logo.jpg";

type LogoProps = {
  className?: string;
  imageClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
};

export default function Logo({
  className = "",
  imageClassName = "h-9 w-9 rounded-full object-cover",
  labelClassName = "text-base font-semibold text-primary",
  showLabel = true,
}: LogoProps) {
  const wrapperClass = ["flex items-center gap-3", className].filter(Boolean).join(" ").trim();

  return (
    <div className={wrapperClass}>
      <img
        src={logoImage}
        alt="TBT logo"
        loading="lazy"
        className={imageClassName}
      />
      {showLabel ? <span className={labelClassName}>InvestPro</span> : null}
    </div>
  );
}

